import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jiyiPet', {
  startDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-start', position);
  },
  moveDrag: (position: { x: number; y: number }) => {
    ipcRenderer.send('pet-drag-move', position);
  },
  endDrag: () => {
    ipcRenderer.send('pet-drag-end');
  }
});
