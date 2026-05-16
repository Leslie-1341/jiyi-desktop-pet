import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen } from 'electron';
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

let petWindow: BrowserWindow | null = null;
let dragState: DragState | null = null;
let tray: Tray | null = null;
let isStudyMode = false;

const isDev = !app.isPackaged;

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

function buildControlMenu() {
  const isVisible = Boolean(petWindow?.isVisible());

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
    width: 220,
    height: 220,
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

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  petWindow.setPosition(width - 260, height - 280);

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
