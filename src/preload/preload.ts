import { contextBridge, ipcRenderer } from 'electron';

type PetMenuCommand = 'toggle-study' | 'back-to-idle';

contextBridge.exposeInMainWorld('desktopPet', {
  startDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-start', position);
  },
  moveDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-move', position);
  },
  endDrag: () => {
    ipcRenderer.send('pet-drag-end');
  },
  showContextMenu: (state: { isStudyMode: boolean }) => {
    ipcRenderer.send('pet-show-context-menu', state);
  },
  setStudyMode: (isStudyMode: boolean) => {
    ipcRenderer.send('pet-study-mode-changed', isStudyMode);
  },
  getWindowVisibility: () => {
    return ipcRenderer.invoke('pet-get-window-visibility') as Promise<boolean>;
  },
  onWindowVisibility: (callback: (isVisible: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isVisible: boolean) => {
      callback(isVisible);
    };

    ipcRenderer.on('pet-window-visibility-changed', listener);

    return () => {
      ipcRenderer.removeListener('pet-window-visibility-changed', listener);
    };
  },
  onMenuCommand: (callback: (command: PetMenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: PetMenuCommand) => {
      callback(command);
    };

    ipcRenderer.on('pet-menu-command', listener);

    return () => {
      ipcRenderer.removeListener('pet-menu-command', listener);
    };
  }
});
