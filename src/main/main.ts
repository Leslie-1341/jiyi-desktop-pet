import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, Notification } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  createIdleFocusTimerState,
  type FocusTimerBaseMode,
  type FocusTimerNotificationKind,
  type FocusTimerPreferences,
  type FocusTimerState
} from '../shared/focusTimer';
import { defaultPetId, isKnownPetId, petRegistry } from '../shared/petRegistry';

type DragState = {
  startMouseX: number;
  startMouseY: number;
  startWindowX: number;
  startWindowY: number;
};

type PetContextMenuState = {
  isStudyMode: boolean;
};

type WindowState = {
  x: number;
  y: number;
};

type PetMenuCommand =
  | 'toggle-study'
  | 'back-to-idle'
  | 'start-focus-25-timer'
  | 'start-focus-45-timer'
  | 'start-break-5-timer'
  | 'start-break-10-timer'
  | 'open-custom-focus-timer'
  | 'toggle-focus-timer-pause'
  | 'end-focus-timer';

type PetPreferences = {
  activePetId: string;
};

type FocusStats = {
  todayDate: string;
  todayCompletedFocusCount: number;
  todayFocusMinutes: number;
  todayCompletedBreakCount: number;
  todayBreakMinutes: number;
};

const PET_WINDOW_SIZE = {
  width: 220,
  height: 300
};

let petWindow: BrowserWindow | null = null;
let dragState: DragState | null = null;
let tray: Tray | null = null;
let isStudyMode = false;
let activePetId = defaultPetId;
let focusTimerState = createIdleFocusTimerState();
let focusStats: FocusStats | null = null;
let focusTimerPreferences: FocusTimerPreferences = { autoAdvance: false };

const isDev = !app.isPackaged;

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function getPetPreferencesPath() {
  return path.join(app.getPath('userData'), 'pet-preferences.json');
}

function getFocusTimerStatePath() {
  return path.join(app.getPath('userData'), 'focus-timer.json');
}

function getFocusStatsPath() {
  return path.join(app.getPath('userData'), 'focus-stats.json');
}

function getFocusTimerPreferencesPath() {
  return path.join(app.getPath('userData'), 'focus-preferences.json');
}

function isFocusTimerPreferences(value: unknown): value is FocusTimerPreferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const preferences = value as Partial<FocusTimerPreferences>;
  return typeof preferences.autoAdvance === 'boolean';
}

function readFocusTimerPreferences() {
  try {
    const rawPreferences = fs.readFileSync(getFocusTimerPreferencesPath(), 'utf8');
    const parsedPreferences = JSON.parse(rawPreferences);

    if (isFocusTimerPreferences(parsedPreferences)) {
      return parsedPreferences;
    }
  } catch {
    return { autoAdvance: false };
  }

  return { autoAdvance: false };
}

function saveFocusTimerPreferences() {
  try {
    fs.writeFileSync(
      getFocusTimerPreferencesPath(),
      `${JSON.stringify(focusTimerPreferences, null, 2)}\n`
    );
  } catch (error) {
    console.error('Failed to save focus timer preferences:', error);
  }
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createDefaultFocusStats(todayDate = getLocalDateKey()): FocusStats {
  return {
    todayDate,
    todayCompletedFocusCount: 0,
    todayFocusMinutes: 0,
    todayCompletedBreakCount: 0,
    todayBreakMinutes: 0
  };
}

function isFocusStats(value: unknown): value is FocusStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const stats = value as Partial<FocusStats>;

  return (
    typeof stats.todayDate === 'string' &&
    typeof stats.todayCompletedFocusCount === 'number' &&
    typeof stats.todayFocusMinutes === 'number' &&
    typeof stats.todayCompletedBreakCount === 'number' &&
    typeof stats.todayBreakMinutes === 'number'
  );
}

function normalizeFocusStatsForToday(stats: FocusStats) {
  const todayDate = getLocalDateKey();

  if (stats.todayDate === todayDate) {
    return stats;
  }

  return createDefaultFocusStats(todayDate);
}

function readFocusStats() {
  try {
    const rawStats = fs.readFileSync(getFocusStatsPath(), 'utf8');
    const parsedStats = JSON.parse(rawStats);

    if (isFocusStats(parsedStats)) {
      return normalizeFocusStatsForToday(parsedStats);
    }
  } catch {
    return createDefaultFocusStats();
  }

  return createDefaultFocusStats();
}

function getFocusStats() {
  focusStats = normalizeFocusStatsForToday(focusStats ?? readFocusStats());
  return focusStats;
}

function saveFocusStats() {
  try {
    fs.writeFileSync(getFocusStatsPath(), `${JSON.stringify(getFocusStats(), null, 2)}\n`);
  } catch (error) {
    console.error('Failed to save focus stats:', error);
  }
}

function recordCompletedTimer(mode: FocusTimerBaseMode, durationMs: number) {
  const completedMinutes = Math.max(1, Math.round(durationMs / 60_000));
  const nextStats = { ...getFocusStats() };

  if (mode === 'focus') {
    nextStats.todayCompletedFocusCount += 1;
    nextStats.todayFocusMinutes += completedMinutes;
  } else {
    nextStats.todayCompletedBreakCount += 1;
    nextStats.todayBreakMinutes += completedMinutes;
  }

  focusStats = nextStats;
  saveFocusStats();
}

function isFocusTimerState(value: unknown): value is FocusTimerState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const timer = value as Partial<FocusTimerState>;
  const validMode =
    timer.mode === 'idle' ||
    timer.mode === 'focus' ||
    timer.mode === 'break' ||
    timer.mode === 'paused';
  const validPreviousMode =
    timer.previousMode === null ||
    timer.previousMode === 'focus' ||
    timer.previousMode === 'break';

  return (
    validMode &&
    validPreviousMode &&
    typeof timer.durationMs === 'number' &&
    typeof timer.remainingMs === 'number' &&
    (typeof timer.endAt === 'number' || timer.endAt === null) &&
    typeof timer.lastUpdatedAt === 'number'
  );
}

function readFocusTimerState() {
  try {
    const rawState = fs.readFileSync(getFocusTimerStatePath(), 'utf8');
    const parsedState = JSON.parse(rawState);

    if (isFocusTimerState(parsedState)) {
      return parsedState;
    }
  } catch {
    return null;
  }

  return null;
}

function saveFocusTimerState() {
  try {
    fs.writeFileSync(getFocusTimerStatePath(), `${JSON.stringify(focusTimerState, null, 2)}\n`);
  } catch (error) {
    console.error('Failed to save focus timer state:', error);
  }
}

function readPetPreferences() {
  try {
    const rawPreferences = fs.readFileSync(getPetPreferencesPath(), 'utf8');
    const parsedPreferences = JSON.parse(rawPreferences) as Partial<PetPreferences>;

    if (
      typeof parsedPreferences.activePetId === 'string' &&
      isKnownPetId(parsedPreferences.activePetId)
    ) {
      return parsedPreferences as PetPreferences;
    }
  } catch {
    return null;
  }

  return null;
}

function savePetPreferences() {
  const preferences: PetPreferences = {
    activePetId
  };

  try {
    fs.writeFileSync(getPetPreferencesPath(), `${JSON.stringify(preferences, null, 2)}\n`);
  } catch (error) {
    console.error('Failed to save pet preferences:', error);
  }
}

function getDefaultWindowPosition() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;

  return {
    x: x + width - PET_WINDOW_SIZE.width - 40,
    y: y + height - PET_WINDOW_SIZE.height - 60
  };
}

function isWindowPositionVisible(windowState: WindowState) {
  const windowBounds = {
    ...windowState,
    ...PET_WINDOW_SIZE
  };

  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    const intersectsHorizontally =
      windowBounds.x < area.x + area.width && windowBounds.x + windowBounds.width > area.x;
    const intersectsVertically =
      windowBounds.y < area.y + area.height && windowBounds.y + windowBounds.height > area.y;

    return intersectsHorizontally && intersectsVertically;
  });
}

function readSavedWindowState() {
  try {
    const rawState = fs.readFileSync(getWindowStatePath(), 'utf8');
    const parsedState = JSON.parse(rawState) as Partial<WindowState>;

    if (typeof parsedState.x !== 'number' || typeof parsedState.y !== 'number') {
      return null;
    }

    const windowState = {
      x: Math.round(parsedState.x),
      y: Math.round(parsedState.y)
    };

    return isWindowPositionVisible(windowState) ? windowState : null;
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!petWindow) {
    return;
  }

  const [x, y] = petWindow.getPosition();
  const windowState: WindowState = { x, y };

  try {
    fs.writeFileSync(getWindowStatePath(), `${JSON.stringify(windowState, null, 2)}\n`);
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

function resolveTrayIconPath() {
  if (isDev) {
    return path.join(app.getAppPath(), 'src/main/assets/petTrayTemplate.png');
  }

  return path.join(process.resourcesPath, 'petTrayTemplate.png');
}

function sendPetMenuCommand(command: PetMenuCommand) {
  petWindow?.webContents.send('pet-menu-command', command);
}

function sendWindowVisibility() {
  petWindow?.webContents.send('pet-window-visibility-changed', Boolean(petWindow?.isVisible()));
}

function sendActivePetChanged() {
  petWindow?.webContents.send('pet-active-pet-changed', activePetId);
}

function sendFocusTimerPreferencesChanged() {
  petWindow?.webContents.send('pet-focus-timer-preferences-changed', focusTimerPreferences);
}

function setActivePetId(nextPetId: string) {
  if (!isKnownPetId(nextPetId)) {
    return;
  }

  activePetId = nextPetId;
  savePetPreferences();
  sendActivePetChanged();
}

function setFocusTimerState(nextFocusTimerState: FocusTimerState) {
  focusTimerState = nextFocusTimerState;
  saveFocusTimerState();
}

function setFocusTimerAutoAdvance(autoAdvance: boolean) {
  focusTimerPreferences = { autoAdvance };
  saveFocusTimerPreferences();
  sendFocusTimerPreferencesChanged();
}

function showFocusTimerNotification(kind: FocusTimerNotificationKind) {
  try {
    const title = kind === 'focus' ? '专注完成' : '休息结束';
    const body = kind === 'focus' ? '专注完成啦，休息一下吧！' : '休息结束，要继续吗？';
    new Notification({ title, body }).show();
  } catch (error) {
    console.error('Failed to show focus timer notification:', error);
  }
}

function showPetWindow() {
  if (!petWindow) {
    createPetWindow();
    return;
  }

  petWindow.show();
  petWindow.focus();
}

function hidePetWindow() {
  petWindow?.hide();
}

function getOpenAtLogin() {
  return app.getLoginItemSettings().openAtLogin;
}

function toggleOpenAtLogin() {
  app.setLoginItemSettings({
    openAtLogin: !getOpenAtLogin()
  });

  showTrayMenu();
}

function buildControlMenu() {
  const isVisible = Boolean(petWindow?.isVisible());
  const openAtLogin = getOpenAtLogin();
  const hasActiveTimer = focusTimerState.mode !== 'idle';
  const pauseTimerLabel = focusTimerState.mode === 'paused' ? '继续当前计时' : '暂停当前计时';
  const todayFocusStats = getFocusStats();

  return Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏桌宠' : '显示桌宠',
      click: () => {
        if (petWindow?.isVisible()) {
          hidePetWindow();
          return;
        }

        showPetWindow();
      }
    },
    {
      label: isStudyMode ? '退出学习模式' : '进入学习模式',
      click: () => {
        sendPetMenuCommand('toggle-study');
      }
    },
    {
      label: '回到待机',
      click: () => {
        sendPetMenuCommand('back-to-idle');
      }
    },
    {
      label: '切换桌宠',
      submenu: petRegistry.map((pet) => ({
        label: pet.displayName,
        type: 'radio' as const,
        checked: pet.id === activePetId,
        click: () => {
          setActivePetId(pet.id);
          showTrayMenu();
        }
      }))
    },
    {
      label: '专注计时',
      submenu: [
        {
          label: '开始 25 分钟专注',
          enabled: !hasActiveTimer,
          click: () => {
            sendPetMenuCommand('start-focus-25-timer');
          }
        },
        {
          label: '开始 45 分钟专注',
          enabled: !hasActiveTimer,
          click: () => {
            sendPetMenuCommand('start-focus-45-timer');
          }
        },
        {
          label: '开始 5 分钟休息',
          enabled: !hasActiveTimer,
          click: () => {
            sendPetMenuCommand('start-break-5-timer');
          }
        },
        {
          label: '开始 10 分钟休息',
          enabled: !hasActiveTimer,
          click: () => {
            sendPetMenuCommand('start-break-10-timer');
          }
        },
        {
          label: '自定义计时...',
          enabled: !hasActiveTimer,
          click: () => {
            sendPetMenuCommand('open-custom-focus-timer');
          }
        },
        {
          label: '自动进入下一阶段',
          type: 'checkbox',
          checked: focusTimerPreferences.autoAdvance,
          click: (menuItem) => {
            setFocusTimerAutoAdvance(menuItem.checked);
            showTrayMenu();
          }
        },
        { type: 'separator' },
        {
          label: pauseTimerLabel,
          enabled: hasActiveTimer,
          click: () => {
            sendPetMenuCommand('toggle-focus-timer-pause');
          }
        },
        {
          label: '结束当前计时',
          enabled: hasActiveTimer,
          click: () => {
            sendPetMenuCommand('end-focus-timer');
          }
        },
        { type: 'separator' },
        {
          label: `今日专注：${todayFocusStats.todayCompletedFocusCount} 次 · ${todayFocusStats.todayFocusMinutes} 分钟`,
          enabled: false
        },
        {
          label: `今日休息：${todayFocusStats.todayCompletedBreakCount} 次 · ${todayFocusStats.todayBreakMinutes} 分钟`,
          enabled: false
        }
      ]
    },
    { type: 'separator' },
    {
      label: '登录时自动启动',
      type: 'checkbox',
      checked: openAtLogin,
      click: toggleOpenAtLogin
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        app.quit();
      }
    }
  ]);
}

function showTrayMenu() {
  tray?.popUpContextMenu(buildControlMenu());
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(resolveTrayIconPath());
  trayIcon.setTemplateImage(true);

  tray = new Tray(trayIcon);
  tray.setToolTip('桌宠助手');
  tray.on('click', showTrayMenu);
  tray.on('right-click', showTrayMenu);
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: PET_WINDOW_SIZE.width,
    height: PET_WINDOW_SIZE.height,
    transparent: true,
    frame: false,
    resizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const initialPosition = readSavedWindowState() ?? getDefaultWindowPosition();
  petWindow.setPosition(initialPosition.x, initialPosition.y);

  if (isDev) {
    petWindow.loadURL('http://127.0.0.1:5173');
    petWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    petWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  petWindow.on('closed', () => {
    petWindow = null;
    dragState = null;
  });

  petWindow.on('show', sendWindowVisibility);
  petWindow.on('hide', sendWindowVisibility);
  petWindow.webContents.on('did-finish-load', () => {
    sendWindowVisibility();
    sendActivePetChanged();
    sendFocusTimerPreferencesChanged();
  });
}

app.whenReady().then(() => {
  activePetId = readPetPreferences()?.activePetId ?? defaultPetId;
  focusTimerState = readFocusTimerState() ?? createIdleFocusTimerState();
  focusStats = readFocusStats();
  focusTimerPreferences = readFocusTimerPreferences();
  createPetWindow();
  createTray();

  app.on('activate', () => {
    showPetWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('pet-drag-start', (_event, mousePosition: { x: number; y: number }) => {
  if (!petWindow) {
    return;
  }

  const [startWindowX, startWindowY] = petWindow.getPosition();
  dragState = {
    startMouseX: mousePosition.x,
    startMouseY: mousePosition.y,
    startWindowX,
    startWindowY
  };
});

ipcMain.on('pet-drag-move', (_event, mousePosition: { x: number; y: number }) => {
  if (!petWindow || !dragState) {
    return;
  }

  const nextX = dragState.startWindowX + mousePosition.x - dragState.startMouseX;
  const nextY = dragState.startWindowY + mousePosition.y - dragState.startMouseY;
  petWindow.setPosition(Math.round(nextX), Math.round(nextY));
});

ipcMain.on('pet-drag-end', () => {
  saveWindowState();
  dragState = null;
});

ipcMain.on('pet-study-mode-changed', (_event, nextIsStudyMode: boolean) => {
  isStudyMode = nextIsStudyMode;
});

ipcMain.handle('pet-get-window-visibility', () => Boolean(petWindow?.isVisible()));

ipcMain.handle('pet-get-active-pet-id', () => activePetId);

ipcMain.on('pet-set-active-pet-id', (_event, nextPetId: string) => {
  setActivePetId(nextPetId);
});

ipcMain.handle('pet-get-focus-timer-state', () => focusTimerState);

ipcMain.handle('pet-get-focus-timer-preferences', () => focusTimerPreferences);

ipcMain.on('pet-set-focus-timer-state', (_event, nextFocusTimerState: FocusTimerState) => {
  if (!isFocusTimerState(nextFocusTimerState)) {
    return;
  }

  setFocusTimerState(nextFocusTimerState);
});

ipcMain.on('pet-show-focus-timer-notification', (_event, kind: FocusTimerNotificationKind) => {
  showFocusTimerNotification(kind);
});

ipcMain.on('pet-record-completed-timer', (_event, mode: FocusTimerBaseMode, durationMs: number) => {
  if ((mode !== 'focus' && mode !== 'break') || !Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }

  recordCompletedTimer(mode, durationMs);
});

ipcMain.on('pet-show-context-menu', (event, menuState: PetContextMenuState) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);

  if (!sourceWindow) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: menuState.isStudyMode ? '退出学习模式' : '进入学习模式',
      click: () => {
        sendPetMenuCommand('toggle-study');
      }
    },
    {
      label: '回到待机',
      click: () => {
        sendPetMenuCommand('back-to-idle');
      }
    },
    { type: 'separator' },
    {
      label: '隐藏桌宠',
      click: () => {
        hidePetWindow();
      }
    },
    {
      label: '退出应用',
      click: () => {
        app.quit();
      }
    }
  ]);

  menu.popup({ window: sourceWindow });
});
