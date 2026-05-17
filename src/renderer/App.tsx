import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent
} from 'react';
import {
  createIdleFocusTimerState,
  FOCUS_TIMER_DURATIONS_MS,
  getFocusTimerActiveMode,
  type FocusTimerBaseMode,
  type FocusTimerState
} from '../shared/focusTimer';
import { defaultPetId, getPetConfig, petConfigs, type PetConfig, type PetState } from './pets';

const CLICK_MOVE_LIMIT = 6;
const DOUBLE_CLICK_DELAY_MS = 260;
const LONG_PRESS_DURATION_MS = 600;
const SPEECH_BUBBLE_DURATION_MS = 2200;
const AUTO_SPEECH_MIN_DELAY_MS = 45_000;
const AUTO_SPEECH_MAX_DELAY_MS = 90_000;
const FOCUS_COMPLETE_LINE = '专注完成啦，休息一下吧！';
const BREAK_COMPLETE_LINE = '休息结束，要继续吗？';
const CUSTOM_TIMER_MIN_MINUTES = 1;
const CUSTOM_TIMER_MAX_MINUTES = 180;
const FOCUS_TIMER_PRESET_DURATIONS_MS = {
  focus25: FOCUS_TIMER_DURATIONS_MS.focus,
  focus45: 45 * 60 * 1000,
  break5: FOCUS_TIMER_DURATIONS_MS.break,
  break10: 10 * 60 * 1000
};
type RunningDirection = 'right' | 'left';
type CustomTimerForm = {
  isOpen: boolean;
  mode: FocusTimerBaseMode;
  minutes: string;
  error: string | null;
};

function getAnimationName(petId: string, state: PetState) {
  return `pet-${petId}-${state}`;
}

function formatPercent(value: number) {
  return Number(value.toFixed(2));
}

function formatTimerTime(remainingMs: number) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getValidPetId(petId: string) {
  return petId in petConfigs ? petId : defaultPetId;
}

function buildPetAnimationCss(petConfig: PetConfig) {
  return Object.entries(petConfig.states)
    .map(([state, animation]) => {
      const segmentSize = 100 / animation.frames.length;
      const segments = animation.frames
        .map((frame, index) => {
          const start = formatPercent(index * segmentSize);
          const end = index === animation.frames.length - 1
            ? 100
            : formatPercent((index + 1) * segmentSize - 0.01);
          const x = frame.column * petConfig.frameWidth;
          const y = frame.row * petConfig.frameHeight;

          return `${start}%, ${end}% { background-position: -${x}px -${y}px; }`;
        })
        .join('\n');

      return `@keyframes ${getAnimationName(petConfig.id, state as PetState)} {\n${segments}\n}`;
    })
    .join('\n');
}

export default function App() {
  const [activePetId, setActivePetId] = useState(defaultPetId);
  const [petState, setPetState] = useState<PetState>('idle');
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [speechLine, setSpeechLine] = useState<string | null>(null);
  const [wavingRunId, setWavingRunId] = useState(0);
  const [jumpingRunId, setJumpingRunId] = useState(0);
  const [focusTimerState, setFocusTimerState] = useState<FocusTimerState>(() =>
    createIdleFocusTimerState()
  );
  const [customTimerForm, setCustomTimerForm] = useState<CustomTimerForm>({
    isOpen: false,
    mode: 'focus',
    minutes: '25',
    error: null
  });
  const [timerNow, setTimerNow] = useState(Date.now());
  const petButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previousPointerPosition = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const isPointerOverPet = useRef(false);
  const didMovePastClickLimit = useRef(false);
  const lastRunningDirection = useRef<RunningDirection>('right');
  const clickTimeoutId = useRef<number | null>(null);
  const longPressTimeoutId = useRef<number | null>(null);
  const didTriggerLongPress = useRef(false);
  const speechTimeoutId = useRef<number | null>(null);
  const autoSpeechTimeoutId = useRef<number | null>(null);
  const isStudyModeRef = useRef(false);
  const isWindowVisibleRef = useRef(true);
  const petStateRef = useRef<PetState>('idle');
  const speechLineRef = useRef<string | null>(null);
  const focusTimerStateRef = useRef<FocusTimerState>(focusTimerState);
  const currentPet = getPetConfig(activePetId);
  const petAnimationCss = useMemo(() => buildPetAnimationCss(currentPet), [currentPet]);

  useEffect(() => {
    isStudyModeRef.current = isStudyMode;
    window.desktopPet.setStudyMode(isStudyMode);
  }, [isStudyMode]);

  useEffect(() => {
    isWindowVisibleRef.current = isWindowVisible;
  }, [isWindowVisible]);

  useEffect(() => {
    petStateRef.current = petState;
  }, [petState]);

  useEffect(() => {
    speechLineRef.current = speechLine;
  }, [speechLine]);

  useEffect(() => {
    focusTimerStateRef.current = focusTimerState;
  }, [focusTimerState]);

  useEffect(() => {
    if (petState !== 'waving' && petState !== 'jumping') {
      return;
    }

    const animationDuration =
      petState === 'waving'
        ? currentPet.states.waving.durationMs
        : currentPet.states.jumping.durationMs;
    const timeoutId = window.setTimeout(() => {
      updatePetState(getRestState(isStudyModeRef.current, petState === 'jumping'));
    }, animationDuration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [petState, wavingRunId, jumpingRunId, activePetId]);

  useEffect(() => {
    return () => {
      if (clickTimeoutId.current !== null) {
        window.clearTimeout(clickTimeoutId.current);
      }

      clearLongPressTimer();

      if (speechTimeoutId.current !== null) {
        window.clearTimeout(speechTimeoutId.current);
      }

      clearAutoSpeechTimer();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    window.desktopPet.getWindowVisibility().then((nextIsVisible) => {
      if (isMounted) {
        setIsWindowVisible(nextIsVisible);
      }
    });

    const removeWindowVisibilityListener = window.desktopPet.onWindowVisibility((nextIsVisible) => {
      setIsWindowVisible(nextIsVisible);
    });

    return () => {
      isMounted = false;
      removeWindowVisibilityListener();
    };
  }, []);

  useEffect(() => {
    if (
      isStudyMode ||
      isFocusTimerBlockingAutoSpeech() ||
      !isWindowVisible ||
      petState !== 'idle' ||
      speechLine !== null
    ) {
      clearAutoSpeechTimer();
      return;
    }

    scheduleAutoSpeech();

    return () => {
      clearAutoSpeechTimer();
    };
  }, [isStudyMode, isWindowVisible, petState, speechLine]);

  useEffect(() => {
    return window.desktopPet.onMenuCommand((command) => {
      if (command === 'toggle-study') {
        clearPendingSingleClick();
        toggleStudyMode();
        return;
      }

      if (command === 'start-focus-25-timer') {
        startFocusTimer('focus', FOCUS_TIMER_PRESET_DURATIONS_MS.focus25);
        return;
      }

      if (command === 'start-focus-45-timer') {
        startFocusTimer('focus', FOCUS_TIMER_PRESET_DURATIONS_MS.focus45);
        return;
      }

      if (command === 'start-break-5-timer') {
        startFocusTimer('break', FOCUS_TIMER_PRESET_DURATIONS_MS.break5);
        return;
      }

      if (command === 'start-break-10-timer') {
        startFocusTimer('break', FOCUS_TIMER_PRESET_DURATIONS_MS.break10);
        return;
      }

      if (command === 'open-custom-focus-timer') {
        openCustomTimerForm();
        return;
      }

      if (command === 'toggle-focus-timer-pause') {
        toggleFocusTimerPause();
        return;
      }

      if (command === 'end-focus-timer') {
        endFocusTimer();
        return;
      }

      clearPendingSingleClick();
      isStudyModeRef.current = false;
      setIsStudyMode(false);
      updatePetState('idle');
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    window.desktopPet.getFocusTimerState().then((savedTimerState) => {
      if (isMounted) {
        restoreFocusTimerState(savedTimerState);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (focusTimerState.mode !== 'focus' && focusTimerState.mode !== 'break') {
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setTimerNow(now);

      const activeTimerState = focusTimerStateRef.current;
      const activeMode = getFocusTimerActiveMode(activeTimerState);

      if (
        (activeMode === 'focus' || activeMode === 'break') &&
        getFocusTimerRemainingMs(activeTimerState, now) <= 0
      ) {
        completeFocusTimer(activeMode);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [focusTimerState.mode, focusTimerState.endAt]);

  useEffect(() => {
    let isMounted = true;

    window.desktopPet.getActivePetId().then((savedPetId) => {
      if (isMounted) {
        setActivePetId(getValidPetId(savedPetId));
      }
    });

    const removeActivePetListener = window.desktopPet.onActivePetChanged((nextPetId) => {
      setActivePetId(getValidPetId(nextPetId));
    });

    return () => {
      isMounted = false;
      removeActivePetListener();
    };
  }, []);

  useEffect(() => {
    clearPendingSingleClick();
    hideSpeechBubble();
    updatePetState(getRestState());
    setWavingRunId((currentRunId) => currentRunId + 1);
  }, [activePetId]);

  useEffect(() => {
    function isPointInsidePet(event: globalThis.MouseEvent) {
      const button = petButtonRef.current;

      if (!button) {
        return false;
      }

      const rect = button.getBoundingClientRect();

      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function handleWindowMouseMove(event: globalThis.MouseEvent) {
      updatePointerOverPet(isPointInsidePet(event));
    }

    function handleWindowMouseLeave() {
      updatePointerOverPet(false);
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseleave', handleWindowMouseLeave);
    document.addEventListener('mouseleave', handleWindowMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseleave', handleWindowMouseLeave);
      document.removeEventListener('mouseleave', handleWindowMouseLeave);
    };
  }, []);

  function updatePetState(nextPetState: PetState) {
    petStateRef.current = nextPetState;
    setPetState(nextPetState);
  }

  function updateFocusTimerState(nextFocusTimerState: FocusTimerState, shouldPersist = true) {
    focusTimerStateRef.current = nextFocusTimerState;
    setFocusTimerState(nextFocusTimerState);

    if (shouldPersist) {
      window.desktopPet.setFocusTimerState(nextFocusTimerState);
    }
  }

  function getFocusTimerRemainingMs(timerState: FocusTimerState, now = Date.now()) {
    if (
      (timerState.mode === 'focus' || timerState.mode === 'break') &&
      timerState.endAt !== null
    ) {
      return Math.max(0, timerState.endAt - now);
    }

    return Math.max(0, timerState.remainingMs);
  }

  function isFocusTimerStudyLocked() {
    const activeMode = getFocusTimerActiveMode(focusTimerStateRef.current);
    return activeMode === 'focus';
  }

  function isFocusTimerBlockingAutoSpeech() {
    return focusTimerStateRef.current.mode === 'focus' || isFocusTimerStudyLocked();
  }

  function createRunningFocusTimerState(mode: FocusTimerBaseMode, durationMs: number) {
    const now = Date.now();

    return {
      mode,
      previousMode: null,
      durationMs,
      remainingMs: durationMs,
      endAt: now + durationMs,
      lastUpdatedAt: now
    } satisfies FocusTimerState;
  }

  function hasActiveFocusTimer() {
    return focusTimerStateRef.current.mode !== 'idle';
  }

  function openCustomTimerForm() {
    if (hasActiveFocusTimer()) {
      return;
    }

    setCustomTimerForm({
      isOpen: true,
      mode: 'focus',
      minutes: '25',
      error: null
    });
  }

  function closeCustomTimerForm() {
    setCustomTimerForm((currentForm) => ({
      ...currentForm,
      isOpen: false,
      error: null
    }));
  }

  function getCustomTimerMinutes() {
    const trimmedMinutes = customTimerForm.minutes.trim();

    if (!/^\d+$/.test(trimmedMinutes)) {
      return null;
    }

    const minutes = Number(trimmedMinutes);

    if (
      !Number.isInteger(minutes) ||
      minutes < CUSTOM_TIMER_MIN_MINUTES ||
      minutes > CUSTOM_TIMER_MAX_MINUTES
    ) {
      return null;
    }

    return minutes;
  }

  function startCustomTimer() {
    const minutes = getCustomTimerMinutes();

    if (minutes === null) {
      setCustomTimerForm((currentForm) => ({
        ...currentForm,
        error: '请输入 1 到 180 之间的整数分钟'
      }));
      return;
    }

    const mode = customTimerForm.mode;
    closeCustomTimerForm();
    startFocusTimer(mode, minutes * 60 * 1000);
  }

  function handleCustomTimerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startCustomTimer();
  }

  function startFocusTimer(mode: FocusTimerBaseMode, durationMs: number) {
    if (hasActiveFocusTimer()) {
      return;
    }

    const nextTimerState = createRunningFocusTimerState(mode, durationMs);
    updateFocusTimerState(nextTimerState);
    clearPendingSingleClick();
    clearLongPressTimer();
    hideSpeechBubble();
    closeCustomTimerForm();
    setTimerNow(Date.now());

    if (mode === 'focus') {
      isStudyModeRef.current = true;
      setIsStudyMode(true);
      updatePetState('study');
      return;
    }

    isStudyModeRef.current = false;
    setIsStudyMode(false);
    updatePetState(getRestState(false));
  }

  function toggleFocusTimerPause() {
    const currentTimerState = focusTimerStateRef.current;

    if (currentTimerState.mode === 'idle') {
      return;
    }

    const now = Date.now();

    if (currentTimerState.mode === 'paused') {
      const resumeMode = currentTimerState.previousMode;

      if (!resumeMode) {
        return;
      }

      updateFocusTimerState({
        mode: resumeMode,
        previousMode: null,
        durationMs: currentTimerState.durationMs,
        remainingMs: currentTimerState.remainingMs,
        endAt: now + currentTimerState.remainingMs,
        lastUpdatedAt: now
      });
      setTimerNow(now);
      return;
    }

    updateFocusTimerState({
      mode: 'paused',
      previousMode: currentTimerState.mode,
      durationMs: currentTimerState.durationMs,
      remainingMs: getFocusTimerRemainingMs(currentTimerState, now),
      endAt: null,
      lastUpdatedAt: now
    });
    setTimerNow(now);
  }

  function endFocusTimer() {
    updateFocusTimerState(createIdleFocusTimerState());
    closeCustomTimerForm();
    clearPendingSingleClick();
    clearLongPressTimer();
    isStudyModeRef.current = false;
    setIsStudyMode(false);
    updatePetState(getRestState(false));
  }

  function completeFocusTimer(mode: FocusTimerBaseMode) {
    const completedDurationMs = focusTimerStateRef.current.durationMs;

    updateFocusTimerState(createIdleFocusTimerState());
    isStudyModeRef.current = false;
    setIsStudyMode(false);
    updatePetState(getRestState(false));
    showSpeechBubble({
      line: mode === 'focus' ? FOCUS_COMPLETE_LINE : BREAK_COMPLETE_LINE,
      resetAutoTimer: true
    });
    window.desktopPet.recordCompletedTimer(mode, completedDurationMs);
    window.desktopPet.showFocusTimerNotification(mode);
  }

  function restoreFocusTimerState(savedTimerState: FocusTimerState) {
    const now = Date.now();
    const activeMode = getFocusTimerActiveMode(savedTimerState);

    if (
      (activeMode === 'focus' || activeMode === 'break') &&
      savedTimerState.mode !== 'paused' &&
      getFocusTimerRemainingMs(savedTimerState, now) <= 0
    ) {
      completeFocusTimer(activeMode);
      return;
    }

    updateFocusTimerState(savedTimerState, false);
    setTimerNow(now);

    if (activeMode === 'focus') {
      isStudyModeRef.current = true;
      setIsStudyMode(true);
      updatePetState('study');
    } else if (activeMode === 'break') {
      isStudyModeRef.current = false;
      setIsStudyMode(false);
      updatePetState(getRestState(false));
    }
  }

  function clearLongPressTimer() {
    if (longPressTimeoutId.current === null) {
      return;
    }

    window.clearTimeout(longPressTimeoutId.current);
    longPressTimeoutId.current = null;
  }

  function getScreenPosition(event: PointerEvent) {
    return {
      x: event.screenX,
      y: event.screenY
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = getScreenPosition(event);
    previousPointerPosition.current = pointerStart.current;
    isDragging.current = true;
    didMovePastClickLimit.current = false;
    didTriggerLongPress.current = false;
    window.desktopPet.startDrag(pointerStart.current);

    if (!isStudyModeRef.current) {
      clearLongPressTimer();
      longPressTimeoutId.current = window.setTimeout(() => {
        longPressTimeoutId.current = null;

        if (
          pointerStart.current &&
          !didMovePastClickLimit.current &&
          !isStudyModeRef.current &&
          petStateRef.current !== 'runningRight' &&
          petStateRef.current !== 'runningLeft'
        ) {
          didTriggerLongPress.current = true;
          clearPendingSingleClick();
          hideSpeechBubble();
          updatePetState('jumping');
          setJumpingRunId((currentRunId) => currentRunId + 1);
        }
      }, LONG_PRESS_DURATION_MS);
    }
  }

  function clearPendingSingleClick() {
    if (clickTimeoutId.current === null) {
      return;
    }

    window.clearTimeout(clickTimeoutId.current);
    clickTimeoutId.current = null;
  }

  function pickSpeechLine() {
    const nextIndex = Math.floor(Math.random() * currentPet.speechLines.length);
    return currentPet.speechLines[nextIndex];
  }

  function clearAutoSpeechTimer() {
    if (autoSpeechTimeoutId.current === null) {
      return;
    }

    window.clearTimeout(autoSpeechTimeoutId.current);
    autoSpeechTimeoutId.current = null;
  }

  function getRandomAutoSpeechDelay() {
    return (
      AUTO_SPEECH_MIN_DELAY_MS +
      Math.random() * (AUTO_SPEECH_MAX_DELAY_MS - AUTO_SPEECH_MIN_DELAY_MS)
    );
  }

  function canShowAutoSpeech() {
    return (
      !isStudyModeRef.current &&
      petStateRef.current === 'idle' &&
      speechLineRef.current === null &&
      isWindowVisibleRef.current &&
      !isDragging.current
    );
  }

  function scheduleAutoSpeech() {
    clearAutoSpeechTimer();

    if (isStudyModeRef.current || !isWindowVisibleRef.current) {
      return;
    }

    autoSpeechTimeoutId.current = window.setTimeout(() => {
      autoSpeechTimeoutId.current = null;

      if (canShowAutoSpeech()) {
        showSpeechBubble({ resetAutoTimer: false });
        return;
      }

      scheduleAutoSpeech();
    }, getRandomAutoSpeechDelay());
  }

  function hideSpeechBubble() {
    if (speechTimeoutId.current !== null) {
      window.clearTimeout(speechTimeoutId.current);
      speechTimeoutId.current = null;
    }

    setSpeechLine(null);
  }

  function showSpeechBubble({ line, resetAutoTimer = true }: {
    line?: string;
    resetAutoTimer?: boolean;
  } = {}) {
    if (resetAutoTimer) {
      clearAutoSpeechTimer();
    }

    if (speechTimeoutId.current !== null) {
      window.clearTimeout(speechTimeoutId.current);
    }

    setSpeechLine(line ?? pickSpeechLine());
    speechTimeoutId.current = window.setTimeout(() => {
      setSpeechLine(null);
      speechTimeoutId.current = null;
    }, SPEECH_BUBBLE_DURATION_MS);
  }

  function getRestState(
    nextIsStudyMode = isStudyModeRef.current,
    allowShyWhilePressed = false
  ): PetState {
    if (nextIsStudyMode) {
      return 'study';
    }

    const canReturnToShy = !isDragging.current || allowShyWhilePressed;

    return isPointerOverPet.current && canReturnToShy ? 'shy' : 'idle';
  }

  function returnToRestState() {
    updatePetState(getRestState());
  }

  function handleConfirmedSingleClick() {
    if (isStudyModeRef.current || isFocusTimerStudyLocked()) {
      return;
    }

    console.log('clicked');
    clearLongPressTimer();
    updatePetState('waving');
    setWavingRunId((currentRunId) => currentRunId + 1);
    showSpeechBubble();
  }

  function toggleStudyMode() {
    if (isFocusTimerStudyLocked()) {
      return;
    }

    setIsStudyMode((currentStudyMode) => {
      const nextStudyMode = !currentStudyMode;
      isStudyModeRef.current = nextStudyMode;
      clearLongPressTimer();
      updatePetState(getRestState(nextStudyMode));

      if (nextStudyMode) {
        hideSpeechBubble();
      }

      return nextStudyMode;
    });
  }

  function handlePetClick() {
    if (clickTimeoutId.current !== null) {
      clearPendingSingleClick();
      toggleStudyMode();
      return;
    }

    clickTimeoutId.current = window.setTimeout(() => {
      clickTimeoutId.current = null;
      handleConfirmedSingleClick();
    }, DOUBLE_CLICK_DELAY_MS);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isDragging.current || !pointerStart.current) {
      return;
    }

    const nextPosition = getScreenPosition(event);
    const movedX = Math.abs(nextPosition.x - pointerStart.current.x);
    const movedY = Math.abs(nextPosition.y - pointerStart.current.y);
    const deltaX = previousPointerPosition.current
      ? nextPosition.x - previousPointerPosition.current.x
      : nextPosition.x - pointerStart.current.x;

    if (movedX > CLICK_MOVE_LIMIT || movedY > CLICK_MOVE_LIMIT) {
      didMovePastClickLimit.current = true;
      clearLongPressTimer();
      clearPendingSingleClick();

      if (deltaX > 0) {
        lastRunningDirection.current = 'right';
      } else if (deltaX < 0) {
        lastRunningDirection.current = 'left';
      }

      updatePetState(
        lastRunningDirection.current === 'right' ? 'runningRight' : 'runningLeft'
      );
    }

    previousPointerPosition.current = nextPosition;
    window.desktopPet.moveDrag(nextPosition);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    if (!pointerStart.current) {
      return;
    }

    const endPosition = getScreenPosition(event);
    const movedX = Math.abs(endPosition.x - pointerStart.current.x);
    const movedY = Math.abs(endPosition.y - pointerStart.current.y);
    const isClick =
      !didMovePastClickLimit.current &&
      movedX <= CLICK_MOVE_LIMIT &&
      movedY <= CLICK_MOVE_LIMIT;

    isDragging.current = false;
    pointerStart.current = null;
    previousPointerPosition.current = null;
    didMovePastClickLimit.current = false;
    window.desktopPet.endDrag();

    if (didTriggerLongPress.current) {
      didTriggerLongPress.current = false;
    } else if (isClick) {
      handlePetClick();
    } else {
      returnToRestState();
    }

    clearLongPressTimer();
  }

  function handlePointerCancel() {
    clearLongPressTimer();
    didTriggerLongPress.current = false;
    isDragging.current = false;
    pointerStart.current = null;
    previousPointerPosition.current = null;
    didMovePastClickLimit.current = false;
    returnToRestState();
    window.desktopPet.endDrag();
  }

  function updatePointerOverPet(nextIsPointerOverPet: boolean) {
    if (isPointerOverPet.current === nextIsPointerOverPet) {
      return;
    }

    isPointerOverPet.current = nextIsPointerOverPet;

    if (nextIsPointerOverPet) {
      if (
        !isStudyModeRef.current &&
        !isDragging.current &&
        petStateRef.current === 'idle'
      ) {
        updatePetState('shy');
      }

      return;
    }

    if (petStateRef.current === 'shy') {
      updatePetState('idle');
    }
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    clearPendingSingleClick();
    window.desktopPet.showContextMenu({ isStudyMode: isStudyModeRef.current });
  }

  const currentAnimation = currentPet.states[petState];
  const petButtonStyle = {
    '--pet-scale': String(currentPet.scale),
    '--pet-frame-width': `${currentPet.frameWidth}px`,
    '--pet-frame-height': `${currentPet.frameHeight}px`
  } as CSSProperties;
  const petSpriteStyle = {
    backgroundImage: `url(${currentPet.spritesheet})`,
    '--pet-sheet-width': `${currentPet.sheetWidth}px`,
    '--pet-sheet-height': `${currentPet.sheetHeight}px`,
    '--pet-animation-name': getAnimationName(currentPet.id, petState),
    '--pet-animation-duration': `${currentAnimation.durationMs}ms`,
    '--pet-animation-iteration': currentAnimation.loop ? 'infinite' : '1',
    '--pet-animation-fill-mode': currentAnimation.fillMode ?? 'none'
  } as CSSProperties;
  const timerRemainingMs = getFocusTimerRemainingMs(focusTimerState, timerNow);
  const shouldShowTimer = focusTimerState.mode !== 'idle';
  const timerLabel = `${formatTimerTime(timerRemainingMs)}${
    focusTimerState.mode === 'paused' ? ' 已暂停' : ''
  }`;

  return (
    <main className="pet-stage">
      <style>{petAnimationCss}</style>
      {customTimerForm.isOpen ? (
        <div className="timer-modal" role="dialog" aria-label="自定义计时">
          <form className="timer-modal__panel" onSubmit={handleCustomTimerSubmit}>
            <div className="timer-modal__title">自定义计时</div>
            <div className="timer-modal__tabs" aria-label="计时类型">
              <button
                className={`timer-modal__tab ${
                  customTimerForm.mode === 'focus' ? 'timer-modal__tab--active' : ''
                }`}
                type="button"
                onClick={() => {
                  setCustomTimerForm((currentForm) => ({
                    ...currentForm,
                    mode: 'focus',
                    error: null
                  }));
                }}
              >
                专注
              </button>
              <button
                className={`timer-modal__tab ${
                  customTimerForm.mode === 'break' ? 'timer-modal__tab--active' : ''
                }`}
                type="button"
                onClick={() => {
                  setCustomTimerForm((currentForm) => ({
                    ...currentForm,
                    mode: 'break',
                    error: null
                  }));
                }}
              >
                休息
              </button>
            </div>
            <label className="timer-modal__field">
              <span>时长（分钟）</span>
              <input
                inputMode="numeric"
                min={CUSTOM_TIMER_MIN_MINUTES}
                max={CUSTOM_TIMER_MAX_MINUTES}
                pattern="[0-9]*"
                type="number"
                value={customTimerForm.minutes}
                onChange={(event) => {
                  setCustomTimerForm((currentForm) => ({
                    ...currentForm,
                    minutes: event.target.value,
                    error: null
                  }));
                }}
              />
            </label>
            {customTimerForm.error ? (
              <div className="timer-modal__error">{customTimerForm.error}</div>
            ) : null}
            <div className="timer-modal__actions">
              <button type="submit">开始</button>
              <button type="button" onClick={closeCustomTimerForm}>
                取消
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {shouldShowTimer ? (
        <div className="timer-badge">
          {timerLabel}
        </div>
      ) : null}
      {speechLine ? <div className="speech-bubble">{speechLine}</div> : null}
      <button
        ref={petButtonRef}
        className="pet-button"
        aria-label={`${currentPet.displayName} desktop pet`}
        style={petButtonStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
      >
        <span
          key={`${currentPet.id}-${petState}-${wavingRunId}-${jumpingRunId}`}
          className={`pet-sprite pet-sprite--${petState}`}
          style={petSpriteStyle}
        />
      </button>
    </main>
  );
}
