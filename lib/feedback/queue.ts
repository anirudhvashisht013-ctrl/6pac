export type FeedbackTone = "success" | "info" | "warning" | "error";

export type FeedbackToastItem = {
  id: string;
  kind: "toast";
  message: string;
  tone: FeedbackTone;
  durationMs: number;
};

export type FeedbackUndoItem = {
  id: string;
  kind: "undo";
  message: string;
  tone: FeedbackTone;
  durationMs: number;
  onUndo: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
  onCommitErrorMessage?: string;
  startedAt?: number;
};

export type FeedbackQueueItem = FeedbackToastItem | FeedbackUndoItem;

export type FeedbackQueueEffect =
  | {
      type: "undo";
      run: () => void | Promise<void>;
    }
  | {
      type: "commit";
      run: () => void | Promise<void>;
      onErrorMessage?: string;
    };

export type FeedbackQueueSnapshot = {
  current: FeedbackQueueItem | null;
  pendingCount: number;
};

export type FeedbackQueueTransition = FeedbackQueueSnapshot & {
  effects: FeedbackQueueEffect[];
};

function withStartedAt(item: FeedbackQueueItem, now: number): FeedbackQueueItem {
  if (item.kind !== "undo") return item;
  return { ...item, startedAt: now };
}

export class FeedbackQueue {
  private current: FeedbackQueueItem | null = null;
  private pending: FeedbackQueueItem[] = [];
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  enqueue(item: FeedbackQueueItem): FeedbackQueueTransition {
    if (!this.current) {
      this.current = withStartedAt(item, this.now());
    } else {
      this.pending.push(item);
    }
    return this.transition([]);
  }

  dismissCurrent(): FeedbackQueueTransition {
    if (!this.current) return this.transition([]);
    this.advance();
    return this.transition([]);
  }

  expireCurrent(): FeedbackQueueTransition {
    if (!this.current) return this.transition([]);

    const current = this.current;
    this.advance();

    if (current.kind === "undo") {
      return this.transition([
        {
          type: "commit",
          run: current.onCommit,
          onErrorMessage: current.onCommitErrorMessage,
        },
      ]);
    }

    return this.transition([]);
  }

  undoCurrent(): FeedbackQueueTransition {
    if (!this.current || this.current.kind !== "undo") return this.transition([]);

    const current = this.current;
    this.advance();
    return this.transition([{ type: "undo", run: current.onUndo }]);
  }

  snapshot(): FeedbackQueueSnapshot {
    return {
      current: this.current,
      pendingCount: this.pending.length,
    };
  }

  private advance() {
    const next = this.pending.shift() || null;
    this.current = next ? withStartedAt(next, this.now()) : null;
  }

  private transition(effects: FeedbackQueueEffect[]): FeedbackQueueTransition {
    const snap = this.snapshot();
    return {
      ...snap,
      effects,
    };
  }
}
