export {};

type PetMenuCommand = 'toggle-study' | 'back-to-idle';

declare global {
  interface Window {
    desktopPet: {
      startDrag: (position: { x: number; y: number }) => void;
      moveDrag: (position: { x: number; y: number }) => void;
      endDrag: () => void;
      showContextMenu: (state: { isStudyMode: boolean }) => void;
      setStudyMode: (isStudyMode: boolean) => void;
      getWindowVisibility: () => Promise<boolean>;
      getActivePetId: () => Promise<string>;
      setActivePetId: (petId: string) => void;
      onActivePetChanged: (callback: (petId: string) => void) => () => void;
      onWindowVisibility: (callback: (isVisible: boolean) => void) => () => void;
      onMenuCommand: (callback: (command: PetMenuCommand) => void) => () => void;
    };
  }
}
