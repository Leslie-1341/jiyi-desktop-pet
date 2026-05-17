export type PetState = 'idle' | 'shy' | 'waving' | 'runningRight' | 'runningLeft' | 'study';

export type PetFrame = {
  column: number;
  row: number;
};

export type PetAnimation = {
  durationMs: number;
  frames: PetFrame[];
  loop?: boolean;
  fillMode?: 'none' | 'forwards';
};

export type PetConfig = {
  id: string;
  displayName: string;
  spritesheet: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  states: Record<PetState, PetAnimation>;
  speechLines: string[];
};
