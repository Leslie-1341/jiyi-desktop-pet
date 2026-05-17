export type FocusTimerBaseMode = 'focus' | 'break';
export type FocusTimerMode = 'idle' | FocusTimerBaseMode | 'paused';

export type FocusTimerState = {
  mode: FocusTimerMode;
  previousMode: FocusTimerBaseMode | null;
  remainingMs: number;
  endAt: number | null;
  lastUpdatedAt: number;
};

export type FocusTimerNotificationKind = FocusTimerBaseMode;

export const FOCUS_TIMER_DURATIONS_MS = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000
} satisfies Record<FocusTimerBaseMode, number>;

export function createIdleFocusTimerState(lastUpdatedAt = Date.now()): FocusTimerState {
  return {
    mode: 'idle',
    previousMode: null,
    remainingMs: 0,
    endAt: null,
    lastUpdatedAt
  };
}

export function getFocusTimerActiveMode(timer: FocusTimerState) {
  return timer.mode === 'paused' ? timer.previousMode : timer.mode;
}
