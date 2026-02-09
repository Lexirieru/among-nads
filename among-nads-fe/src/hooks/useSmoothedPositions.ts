import { useEffect, useRef, useState, useCallback } from 'react';

interface Pos { x: number; y: number; }

// Speed: how fast current position chases the target (higher = snappier)
// Moltbook-town uses ~50 px/s on a 960px canvas.
// Our coords are in % (0-100), so equivalent ~5 %/s base.
// We use lerp factor per frame instead: lerp = 1 - exp(-LERP_SPEED * dt)
// LERP_SPEED ~6 gives a smooth ~0.15s feel per movement.
const LERP_SPEED = 6;

/**
 * Smoothly interpolates player positions toward their target room coords.
 * Mimics the frame-by-frame lerp used in moltbook-town's Agent.update().
 *
 * @param targets  – Record<playerId, {x, y}> target positions (in %).
 * @returns        – Record<playerId, {x, y}> interpolated (current) positions.
 */
export function useSmoothedPositions(targets: Record<string, Pos>): Record<string, Pos> {
  // currentRef holds the live interpolated positions (mutated every frame, no re-render).
  const currentRef = useRef<Record<string, Pos>>({});
  // offsetRef holds a stable small random offset per player so they don't stack.
  const offsetRef = useRef<Record<string, Pos>>({});
  // lastTimeRef for delta-time calculation.
  const lastTimeRef = useRef<number>(0);
  // rafRef to cancel on unmount.
  const rafRef = useRef<number>(0);

  // Exposed state – updated each frame to trigger re-render.
  const [positions, setPositions] = useState<Record<string, Pos>>({});

  // Stable offset generator: assign once per player, keep forever.
  const getOffset = useCallback((id: string): Pos => {
    if (!offsetRef.current[id]) {
      offsetRef.current[id] = {
        x: (Math.random() - 0.5) * 5,  // ±2.5 %
        y: (Math.random() - 0.5) * 5,
      };
    }
    return offsetRef.current[id];
  }, []);

  useEffect(() => {
    let playerSetChanged = false;

    // Seed current positions instantly for any new players (avoids flying in from 0,0).
    Object.keys(targets).forEach((id) => {
      if (!currentRef.current[id]) {
        const offset = getOffset(id);
        currentRef.current[id] = {
          x: targets[id].x + offset.x,
          y: targets[id].y + offset.y,
        };
        playerSetChanged = true;
      }
    });

    // Clean up players that left.
    Object.keys(currentRef.current).forEach((id) => {
      if (!targets[id]) {
        delete currentRef.current[id];
        delete offsetRef.current[id];
        playerSetChanged = true;
      }
    });

    // If a player joined or left, immediately flush positions so they render
    // without waiting for a movement-triggered frame.
    if (playerSetChanged) {
      const immediate: Record<string, Pos> = {};
      Object.keys(currentRef.current).forEach((id) => {
        immediate[id] = { ...currentRef.current[id] };
      });
      setPositions(immediate);
    }

    const loop = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;

      // Clamp dt to avoid huge jumps if tab was backgrounded.
      const clampedDt = Math.min(dt, 0.1);

      const lerpFactor = 1 - Math.exp(-LERP_SPEED * clampedDt);
      let changed = false;

      const snapshot: Record<string, Pos> = {};

      Object.keys(targets).forEach((id) => {
        const offset = getOffset(id);
        const targetX = targets[id].x + offset.x;
        const targetY = targets[id].y + offset.y;

        if (!currentRef.current[id]) {
          // New player mid-game: start at target instantly.
          currentRef.current[id] = { x: targetX, y: targetY };
        }

        const cur = currentRef.current[id];
        const dx = targetX - cur.x;
        const dy = targetY - cur.y;

        // Only lerp if meaningfully far (< 0.05% = visually arrived).
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
          cur.x += dx * lerpFactor;
          cur.y += dy * lerpFactor;
          changed = true;
        }

        snapshot[id] = { x: cur.x, y: cur.y };
      });

      // Only push state update when something actually moved.
      if (changed) {
        setPositions({ ...snapshot });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [targets, getOffset]);

  return positions;
}
