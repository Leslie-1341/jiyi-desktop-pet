export {};

declare global {
  interface Window {
    jiyiPet: {
      startDrag: (position: { x: number; y: number }) => void;
      moveDrag: (position: { x: number; y: number }) => void;
      endDrag: () => void;
    };
  }
}
