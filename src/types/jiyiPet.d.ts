export {};

type PetMenuCommand = 'toggle-study' | 'back-to-idle';

declare global {
  interface Window {
    jiyiPet: {
      startDrag: (position: { x: number; y: number }) => void;
      moveDrag: (position: { x: number; y: number }) => void;
      endDrag: () => void;
      showContextMenu: (state: { isStudyMode: boolean }) => void;
      setStudyMode: (isStudyMode: boolean) => void;
      getWindowVisibility: () => Promise<boolean>;
      onWindowVisibility: (callback: (isVisible: boolean) => void) => () => void;
      onMenuCommand: (callback: (command: PetMenuCommand) => void) => () => void;
    };
  }
}
