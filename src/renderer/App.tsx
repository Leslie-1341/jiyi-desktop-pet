import { PointerEvent, useRef } from 'react';
import jiyiSpritesheet from './assets/jiyi-spritesheet.webp';

const CLICK_MOVE_LIMIT = 4;
const IDLE_FIRST_FRAME_STYLE = {
  backgroundImage: `url(${jiyiSpritesheet})`
};

export default function App() {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  function getScreenPosition(event: PointerEvent) {
    return {
      x: event.screenX,
      y: event.screenY
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = getScreenPosition(event);
    isDragging.current = true;
    window.jiyiPet.startDrag(pointerStart.current);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isDragging.current) {
      return;
    }

    window.jiyiPet.moveDrag(getScreenPosition(event));
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStart.current) {
      return;
    }

    const endPosition = getScreenPosition(event);
    const movedX = Math.abs(endPosition.x - pointerStart.current.x);
    const movedY = Math.abs(endPosition.y - pointerStart.current.y);

    isDragging.current = false;
    pointerStart.current = null;
    window.jiyiPet.endDrag();

    if (movedX <= CLICK_MOVE_LIMIT && movedY <= CLICK_MOVE_LIMIT) {
      console.log('clicked');
    }
  }

  function handlePointerCancel() {
    isDragging.current = false;
    pointerStart.current = null;
    window.jiyiPet.endDrag();
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
      >
        <span className="pet-sprite" style={IDLE_FIRST_FRAME_STYLE} />
      </button>
    </main>
  );
}
