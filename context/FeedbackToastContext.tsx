import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FeedbackQueue,
  type FeedbackQueueItem,
  type FeedbackTone,
  type FeedbackUndoItem,
} from "@/lib/feedback/queue";

const DEFAULT_TOAST_MS = 2200;
const DEFAULT_ERROR_MS = 3000;
const DEFAULT_UNDO_MS = 10000;

type ShowToastInput = {
  message: string;
  tone: FeedbackTone;
  durationMs?: number;
};

type ShowUndoToastInput = {
  message: string;
  durationMs?: number;
  onUndo: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
  onCommitErrorMessage?: string;
};

type FeedbackToastContextValue = {
  current: FeedbackQueueItem | null;
  showToast: (input: ShowToastInput) => void;
  showUndoToast: (input: ShowUndoToastInput) => void;
  dismissCurrent: () => void;
  undoCurrent: () => void;
};

const FeedbackToastContext = createContext<FeedbackToastContextValue | null>(null);

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FeedbackToastProvider({ children }: { children: React.ReactNode }) {
  const queueRef = useRef(new FeedbackQueue());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [current, setCurrent] = useState<FeedbackQueueItem | null>(null);

  const runTransition = useCallback((transition: ReturnType<FeedbackQueue["enqueue"]>) => {
    setCurrent(transition.current);

    for (const effect of transition.effects) {
      void Promise.resolve(effect.run()).catch((err) => {
        if (effect.type === "commit" && effect.onErrorMessage) {
          const next = queueRef.current.enqueue({
            id: createId(),
            kind: "toast",
            message: effect.onErrorMessage,
            tone: "error",
            durationMs: DEFAULT_ERROR_MS,
          });
          setCurrent(next.current);
        }
        console.warn("feedback effect failed", err);
      });
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!current) return;
    timerRef.current = setTimeout(() => {
      runTransition(queueRef.current.expireCurrent());
    }, current.durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [current, runTransition]);

  const showToast = useCallback(
    ({ message, tone, durationMs }: ShowToastInput) => {
      const ms = durationMs ?? (tone === "error" ? DEFAULT_ERROR_MS : DEFAULT_TOAST_MS);
      runTransition(
        queueRef.current.enqueue({
          id: createId(),
          kind: "toast",
          message,
          tone,
          durationMs: ms,
        })
      );
    },
    [runTransition]
  );

  const showUndoToast = useCallback(
    ({ message, durationMs, onUndo, onCommit, onCommitErrorMessage }: ShowUndoToastInput) => {
      const item: FeedbackUndoItem = {
        id: createId(),
        kind: "undo",
        message,
        tone: "warning",
        durationMs: durationMs ?? DEFAULT_UNDO_MS,
        onUndo,
        onCommit,
        onCommitErrorMessage,
      };
      runTransition(queueRef.current.enqueue(item));
    },
    [runTransition]
  );

  const dismissCurrent = useCallback(() => {
    runTransition(queueRef.current.dismissCurrent());
  }, [runTransition]);

  const undoCurrent = useCallback(() => {
    runTransition(queueRef.current.undoCurrent());
  }, [runTransition]);

  const value = useMemo<FeedbackToastContextValue>(
    () => ({
      current,
      showToast,
      showUndoToast,
      dismissCurrent,
      undoCurrent,
    }),
    [current, showToast, showUndoToast, dismissCurrent, undoCurrent]
  );

  return <FeedbackToastContext.Provider value={value}>{children}</FeedbackToastContext.Provider>;
}

export function useFeedbackToast() {
  const ctx = useContext(FeedbackToastContext);
  if (!ctx) {
    throw new Error("useFeedbackToast must be used within FeedbackToastProvider");
  }

  return {
    showToast: ctx.showToast,
    showUndoToast: ctx.showUndoToast,
  };
}

export function useFeedbackToastState() {
  const ctx = useContext(FeedbackToastContext);
  if (!ctx) {
    throw new Error("useFeedbackToastState must be used within FeedbackToastProvider");
  }
  return ctx;
}
