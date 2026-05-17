import jiyiSpritesheet from '../assets/jiyi-spritesheet.webp';
import type { PetConfig, PetFrame } from './types';

const frame = (column: number, row: number): PetFrame => ({ column, row });

export const jiyiPetConfig: PetConfig = {
  id: 'jiyi',
  displayName: '吉伊',
  spritesheet: jiyiSpritesheet,
  sheetWidth: 1536,
  sheetHeight: 1872,
  frameWidth: 192,
  frameHeight: 208,
  scale: 0.6,
  states: {
    idle: {
      durationMs: 2600,
      loop: true,
      frames: [
        frame(0, 0),
        frame(1, 0),
        frame(2, 0),
        frame(3, 0),
        frame(4, 0),
        frame(5, 0),
        frame(4, 0),
        frame(3, 0),
        frame(1, 0),
        frame(0, 0)
      ]
    },
    shy: {
      durationMs: 1800,
      loop: true,
      frames: [
        frame(0, 6),
        frame(1, 6),
        frame(2, 6),
        frame(3, 6),
        frame(4, 6),
        frame(5, 6)
      ]
    },
    waving: {
      durationMs: 1200,
      loop: false,
      fillMode: 'forwards',
      frames: [
        frame(0, 3),
        frame(1, 3),
        frame(0, 3),
        frame(1, 3),
        frame(3, 3)
      ]
    },
    jumping: {
      durationMs: 900,
      loop: false,
      fillMode: 'forwards',
      frames: [
        frame(0, 4),
        frame(1, 4),
        frame(2, 4),
        frame(3, 4),
        frame(4, 4)
      ]
    },
    runningRight: {
      durationMs: 1200,
      loop: true,
      frames: [
        frame(0, 1),
        frame(1, 1),
        frame(2, 1),
        frame(3, 1),
        frame(4, 1),
        frame(5, 1),
        frame(6, 1),
        frame(7, 1)
      ]
    },
    runningLeft: {
      durationMs: 1200,
      loop: true,
      frames: [
        frame(0, 2),
        frame(1, 2),
        frame(2, 2),
        frame(3, 2),
        frame(4, 2),
        frame(5, 2),
        frame(6, 2),
        frame(7, 2)
      ]
    },
    study: {
      durationMs: 2000,
      loop: true,
      frames: [
        frame(0, 8),
        frame(1, 8),
        frame(2, 8),
        frame(3, 8),
        frame(4, 8),
        frame(5, 8)
      ]
    }
  },
  speechLines: [
    '今天也要加油呀！',
    '摸摸吉伊～',
    '一起认真一会儿吧',
    '嘿嘿',
    '你已经很棒啦',
    '休息一下也没关系',
    '吉伊在这里陪你'
  ]
};
