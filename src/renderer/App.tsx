import { MouseEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import jiyiSpritesheet from './assets/jiyi-spritesheet.webp';

const CLICK_MOVE_LIMIT = 6;
const DOUBLE_CLICK_DELAY_MS = 260;
const SPEECH_BUBBLE_DURATION_MS = 2200;
const AUTO_SPEECH_MIN_DELAY_MS = 45_000;
const AUTO_SPEECH_MAX_DELAY_MS = 90_000;
const WAVING_DURATION_MS = 1200;
const SPRITESHEET_STYLE = {
  backgroundImage: `url(${jiyiSpritesheet})`
};
type PetState = 'idle' | 'waving' | 'runningRight' | 'runningLeft' | 'study';
type RunningDirection = 'right' | 'left';

const PET_STATE_CLASS: Record<PetState, string> = {
  idle: 'idle',
  waving: 'waving',
  runningRight: 'running-right',
  runningLeft: 'running-left',
  study: 'study'
};

const SPEECH_LINES = [
  '今天也要加油呀！',
  '摸摸吉伊～',
  '一起认真一会儿吧',
  '嘿嘿',
  '你已经很棒啦',
  '休息一下也没关系',
  '吉伊在这里陪你'
];

export default function App() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [speechLine, setSpeechLine] = useState<string | null>(null);
  const [wavingRunId, setWavingRunId] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previousPointerPosition = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
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
    window.jiyiPet.setStudyMode(isStudyMode);
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
      setPetState(isStudyModeRef.current ? 'study' : 'idle');
    }, WAVING_DURATION_MS);

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

    window.jiyiPet.getWindowVisibility().then((nextIsVisible) => {
      if (isMounted) {
        setIsWindowVisible(nextIsVisible);
      }
    });

    const removeWindowVisibilityListener = window.jiyiPet.onWindowVisibility((nextIsVisible) => {
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
    return window.jiyiPet.onMenuCommand((command) => {
      if (command === 'toggle-study') {
        clearPendingSingleClick();
        toggleStudyMode();
        return;
      }

      clearPendingSingleClick();
      isStudyModeRef.current = false;
      setIsStudyMode(false);
      setPetState('idle');
    });
  }, []);

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
    window.jiyiPet.startDrag(pointerStart.current);
  }

  function clearPendingSingleClick() {
    if (clickTimeoutId.current === null) {
      return;
    }

    window.clearTimeout(clickTimeoutId.current);
    clickTimeoutId.current = null;
  }

  function pickSpeechLine() {
    const nextIndex = Math.floor(Math.random() * SPEECH_LINES.length);
    return SPEECH_LINES[nextIndex];
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

  function returnToRestState() {
    setPetState(isStudyModeRef.current ? 'study' : 'idle');
  }

  function handleConfirmedSingleClick() {
    if (isStudyModeRef.current) {
      return;
    }

    console.log('clicked');
    setPetState('waving');
    setWavingRunId((currentRunId) => currentRunId + 1);
    showSpeechBubble();
  }

  function toggleStudyMode() {
    setIsStudyMode((currentStudyMode) => {
      const nextStudyMode = !currentStudyMode;
      isStudyModeRef.current = nextStudyMode;
      setPetState(nextStudyMode ? 'study' : 'idle');

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

      setPetState(
        lastRunningDirection.current === 'right' ? 'runningRight' : 'runningLeft'
      );
    }

    previousPointerPosition.current = nextPosition;
    window.jiyiPet.moveDrag(nextPosition);
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
    window.jiyiPet.endDrag();

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
    window.jiyiPet.endDrag();
  }

  function handleContextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    clearPendingSingleClick();
    window.jiyiPet.showContextMenu({ isStudyMode: isStudyModeRef.current });
  }

  return (
    <main className="pet-stage">
      {speechLine ? <div className="speech-bubble">{speechLine}</div> : null}
      <button
        className="pet-button"
        aria-label="Jiyi desktop pet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
      >
        <span
          key={`${petState}-${wavingRunId}`}
          className={`pet-sprite pet-sprite--${PET_STATE_CLASS[petState]}`}
          style={SPRITESHEET_STYLE}
        />
      </button>
    </main>
  );
}
