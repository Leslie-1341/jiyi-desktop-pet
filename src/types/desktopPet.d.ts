export {};

import type {
  FocusTimerBaseMode,
  FocusTimerNotificationKind,
  FocusTimerPreferences,
  FocusTimerState
} from '../shared/focusTimer';

type PetMenuCommand =
  | 'toggle-study'
  | 'back-to-idle'
  | 'start-focus-25-timer'
  | 'start-focus-45-timer'
  | 'start-break-5-timer'
  | 'start-break-10-timer'
  | 'open-custom-focus-timer'
  | 'toggle-focus-timer-pause'
  | 'end-focus-timer';

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
      getFocusTimerState: () => Promise<FocusTimerState>;
      getFocusTimerPreferences: () => Promise<FocusTimerPreferences>;
      onFocusTimerPreferencesChanged: (
        callback: (preferences: FocusTimerPreferences) => void
      ) => () => void;
      setFocusTimerState: (timerState: FocusTimerState) => void;
      showFocusTimerNotification: (kind: FocusTimerNotificationKind) => void;
      recordCompletedTimer: (mode: FocusTimerBaseMode, durationMs: number) => void;
      onWindowVisibility: (callback: (isVisible: boolean) => void) => () => void;
      onMenuCommand: (callback: (command: PetMenuCommand) => void) => () => void;
    };
  }
}
