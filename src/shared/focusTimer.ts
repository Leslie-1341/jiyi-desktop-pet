export type FocusTimerBaseMode = 'focus' | 'break';
export type FocusTimerMode = 'idle' | FocusTimerBaseMode | 'paused';

export type FocusTimerState = {
  mode: FocusTimerMode;
  previousMode: FocusTimerBaseMode | null;
  durationMs: number;
  remainingMs: number;
  endAt: number | null;
  lastUpdatedAt: number;
};

export type FocusTimerNotificationKind = FocusTimerBaseMode;

export type FocusTimerPreferences = {
  autoAdvance: boolean;
  defaultFocusMinutes: number;
  defaultBreakMinutes: number;
  longBreakEnabled: boolean;
  longBreakEveryFocusSessions: number;
  longBreakMinutes: number;
};

export type FocusStats = {
  todayDate: string;
  todayCompletedFocusCount: number;
  todayFocusMinutes: number;
  todayCompletedBreakCount: number;
  todayBreakMinutes: number;
};

export const FOCUS_TIMER_DURATIONS_MS = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000
} satisfies Record<FocusTimerBaseMode, number>;

export const FOCUS_TIMER_DEFAULT_PREFERENCES = {
  autoAdvance: false,
  defaultFocusMinutes: 25,
  defaultBreakMinutes: 5,
  longBreakEnabled: true,
  longBreakEveryFocusSessions: 4,
  longBreakMinutes: 15
} satisfies FocusTimerPreferences;

export function createIdleFocusTimerState(lastUpdatedAt = Date.now()): FocusTimerState {
  return {
    mode: 'idle',
    previousMode: null,
    durationMs: 0,
    remainingMs: 0,
    endAt: null,
    lastUpdatedAt
  };
}

export function getFocusTimerActiveMode(timer: FocusTimerState) {
  return timer.mode === 'paused' ? timer.previousMode : timer.mode;
}
