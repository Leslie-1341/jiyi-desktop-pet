import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

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

const PET_WINDOW_SIZE = {
  width: 220,
  height: 300
};

let petWindow: BrowserWindow | null = null;
let dragState: DragState | null = null;
let tray: Tray | null = null;
let isStudyMode = false;

const isDev = !app.isPackaged;

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
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

function sendPetMenuCommand(command: 'toggle-study' | 'back-to-idle') {
  petWindow?.webContents.send('pet-menu-command', command);
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

  return Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏吉伊' : '显示吉伊',
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
}

app.whenReady().then(() => {
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
      label: '隐藏吉伊',
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
