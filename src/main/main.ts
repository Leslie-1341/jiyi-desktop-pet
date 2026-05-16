import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';

type DragState = {
  startMouseX: number;
  startMouseY: number;
  startWindowX: number;
  startWindowY: number;
};

let petWindow: BrowserWindow | null = null;
let dragState: DragState | null = null;

const isDev = !app.isPackaged;

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
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
