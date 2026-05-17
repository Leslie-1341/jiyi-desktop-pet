import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent } from 'react';
import { activePetConfig, type PetState } from './pets';

const CLICK_MOVE_LIMIT = 6;
const DOUBLE_CLICK_DELAY_MS = 260;
const SPEECH_BUBBLE_DURATION_MS = 2200;
const AUTO_SPEECH_MIN_DELAY_MS = 45_000;
const AUTO_SPEECH_MAX_DELAY_MS = 90_000;
const currentPet = activePetConfig;
type RunningDirection = 'right' | 'left';

function getAnimationName(petId: string, state: PetState) {
  return `pet-${petId}-${state}`;
}

function formatPercent(value: number) {
  return Number(value.toFixed(2));
}

function buildPetAnimationCss() {
  return Object.entries(currentPet.states)
    .map(([state, animation]) => {
      const segmentSize = 100 / animation.frames.length;
      const segments = animation.frames
        .map((frame, index) => {
          const start = formatPercent(index * segmentSize);
          const end = index === animation.frames.length - 1
            ? 100
            : formatPercent((index + 1) * segmentSize - 0.01);
          const x = frame.column * currentPet.frameWidth;
          const y = frame.row * currentPet.frameHeight;

          return `${start}%, ${end}% { background-position: -${x}px -${y}px; }`;
        })
        .join('\n');

      return `@keyframes ${getAnimationName(currentPet.id, state as PetState)} {\n${segments}\n}`;
    })
    .join('\n');
}

const petAnimationCss = buildPetAnimationCss();

export default function App() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [speechLine, setSpeechLine] = useState<string | null>(null);
  const [wavingRunId, setWavingRunId] = useState(0);
  const petButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previousPointerPosition = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const isPointerOverPet = useRef(false);
  const didMovePastClickLimit = useRef(false);
  const lastRunningDirection = useRef<RunningDirection>('right');
  const clickTimeoutId = useRef<number | null>(null);
  const speechTimeoutId = useRef<number | null>(null);
  const autoSpeechTimeoutId = useRef<number | null>(null);
  const isStudyModeRef = useRef(false);
  const isWindowVisibleRef = useRef(true);
  const petStateRef = useRef<PetState>('idle');
  const speechLineRef = useRef<string | null>(null);

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
    if (petState !== 'waving') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      updatePetState(getRestState());
    }, currentPet.states.waving.durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [petState, wavingRunId]);

  useEffect(() => {
    return () => {
      if (clickTimeoutId.current !== null) {
        window.clearTimeout(clickTimeoutId.current);
      }

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
    if (isStudyMode || !isWindowVisible || petState !== 'idle' || speechLine !== null) {
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

      clearPendingSingleClick();
      isStudyModeRef.current = false;
      setIsStudyMode(false);
      updatePetState('idle');
    });
  }, []);

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
    window.desktopPet.startDrag(pointerStart.current);
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

  function showSpeechBubble({ resetAutoTimer = true } = {}) {
    if (resetAutoTimer) {
      clearAutoSpeechTimer();
    }

    if (speechTimeoutId.current !== null) {
      window.clearTimeout(speechTimeoutId.current);
    }

    setSpeechLine(pickSpeechLine());
    speechTimeoutId.current = window.setTimeout(() => {
      setSpeechLine(null);
      speechTimeoutId.current = null;
    }, SPEECH_BUBBLE_DURATION_MS);
  }

  function getRestState(nextIsStudyMode = isStudyModeRef.current): PetState {
    if (nextIsStudyMode) {
      return 'study';
    }

    return isPointerOverPet.current && !isDragging.current ? 'shy' : 'idle';
  }

  function returnToRestState() {
    updatePetState(getRestState());
  }

  function handleConfirmedSingleClick() {
    if (isStudyModeRef.current) {
      return;
    }

    console.log('clicked');
    updatePetState('waving');
    setWavingRunId((currentRunId) => currentRunId + 1);
    showSpeechBubble();
  }

  function toggleStudyMode() {
    setIsStudyMode((currentStudyMode) => {
      const nextStudyMode = !currentStudyMode;
      isStudyModeRef.current = nextStudyMode;
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

    if (isClick) {
      handlePetClick();
    } else {
      returnToRestState();
    }
  }

  function handlePointerCancel() {
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

  return (
    <main className="pet-stage">
      <style>{petAnimationCss}</style>
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
          key={`${currentPet.id}-${petState}-${wavingRunId}`}
          className={`pet-sprite pet-sprite--${petState}`}
          style={petSpriteStyle}
        />
      </button>
    </main>
  );
}
