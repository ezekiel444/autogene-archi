import { useCallback, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

// --- Interfaces (Subtask 1.1) ---

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface HistoryStack {
  past: HistoryState[];
  present: HistoryState;
  future: HistoryState[];
}

const MAX_HISTORY_DEPTH = 50;

// --- Hook ---

export function useHistory(initialState: HistoryState) {
  const [history, setHistory] = useState<HistoryStack>({
    past: [],
    present: structuredClone(initialState),
    future: [],
  });

  // Subtask 1.5: canUndo/canRedo boolean flags
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Subtask 1.2: pushHistory — add current state to past, clear future, enforce max 50 depth
  // Subtask 1.6: Use structuredClone for deep state copies
  const setState = useCallback((newState: HistoryState) => {
    setHistory((prev) => {
      const past = [...prev.past, structuredClone(prev.present)];
      if (past.length > MAX_HISTORY_DEPTH) {
        past.shift();
      }
      return {
        past,
        present: structuredClone(newState),
        future: [],
      };
    });
  }, []);

  // Subtask 1.3: undo — pop from past into present, push old present to future
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = prev.past.slice(0, -1);
      const previous = prev.past[prev.past.length - 1];
      return {
        past: newPast,
        present: previous,
        future: [structuredClone(prev.present), ...prev.future],
      };
    });
  }, []);

  // Subtask 1.4: redo — shift from future into present, push old present to past
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...remainingFuture] = prev.future;
      return {
        past: [...prev.past, structuredClone(prev.present)],
        present: next,
        future: remainingFuture,
      };
    });
  }, []);

  // Subtask 1.5: recordSnapshot — push current present to past, clear future
  const recordSnapshot = useCallback(() => {
    setHistory((prev) => {
      const past = [...prev.past, structuredClone(prev.present)];
      if (past.length > MAX_HISTORY_DEPTH) {
        past.shift();
      }
      return {
        past,
        present: prev.present,
        future: [],
      };
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    recordSnapshot,
  };
}
