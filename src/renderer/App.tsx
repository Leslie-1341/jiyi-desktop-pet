import { MouseEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import jiyiSpritesheet from './assets/jiyi-spritesheet.webp';

const CLICK_MOVE_LIMIT = 6;
const DOUBLE_CLICK_DELAY_MS = 260;
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

export default function App() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [wavingRunId, setWavingRunId] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previousPointerPosition = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const didMovePastClickLimit = useRef(false);
  const lastRunningDirection = useRef<RunningDirection>('right');
  const clickTimeoutId = useRef<number | null>(null);
  const isStudyModeRef = useRef(false);

  useEffect(() => {
    isStudyModeRef.current = isStudyMode;
    window.jiyiPet.setStudyMode(isStudyMode);
  }, [isStudyMode]);

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
    };
  }, []);

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
  }

  function toggleStudyMode() {
    setIsStudyMode((currentStudyMode) => {
      const nextStudyMode = !currentStudyMode;
      isStudyModeRef.current = nextStudyMode;
      setPetState(nextStudyMode ? 'study' : 'idle');
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
