import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CareAction } from './careModel';
import { initialCareState, reduceCare } from './careController';
import type { CareEvent, CareState } from './careController';

/**
 * Runs the pure care state machine with real timers. Timers carry the interactionId they were
 * scheduled for; starting or cancelling an interaction clears every older timer, and unmounting
 * clears all of them, so no completion can land after a cancel, skin switch or navigation.
 */
export function useCareController(onComplete: (action: CareAction) => void) {
  const [state, setState] = useState<CareState>(initialCareState);
  const current = useRef<CareState>(state);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const complete = useRef(onComplete);
  useLayoutEffect(() => {
    complete.current = onComplete;
  });

  const dispatch = useCallback(function dispatch(event: CareEvent) {
    const { state: next, effects } = reduceCare(current.current, event);
    if (next.interactionId !== current.current.interactionId) {
      for (const [id, handle] of timers.current)
        if (id !== next.interactionId) {
          clearTimeout(handle);
          timers.current.delete(id);
        }
    }
    current.current = next;
    setState(next);
    for (const effect of effects) {
      if (effect.type === 'timer') {
        const handle = setTimeout(() => {
          timers.current.delete(effect.interactionId);
          dispatch({ type: 'scene-end', interactionId: effect.interactionId });
        }, effect.ms);
        timers.current.set(effect.interactionId, handle);
      } else complete.current(effect.action);
    }
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of pending.values()) clearTimeout(handle);
      pending.clear();
    };
  }, []);

  return [state, dispatch] as const;
}
