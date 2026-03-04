import test from "node:test";
import assert from "node:assert/strict";
import { FeedbackQueue, type FeedbackQueueEffect } from "@/lib/feedback/queue";

async function runEffects(effects: FeedbackQueueEffect[]) {
  for (const effect of effects) {
    await effect.run();
  }
}

test("undo action prevents commit effect", async () => {
  let committed = false;
  let undone = false;
  const queue = new FeedbackQueue(() => 1000);

  queue.enqueue({
    id: "u1",
    kind: "undo",
    message: "Delete meal",
    tone: "warning",
    durationMs: 10000,
    onUndo: () => {
      undone = true;
    },
    onCommit: () => {
      committed = true;
    },
  });

  const transition = queue.undoCurrent();
  await runEffects(transition.effects);

  assert.equal(undone, true);
  assert.equal(committed, false);
  assert.equal(transition.current, null);
});

test("timeout expiration triggers commit effect", async () => {
  let committed = false;
  const queue = new FeedbackQueue(() => 2000);

  queue.enqueue({
    id: "u2",
    kind: "undo",
    message: "Delete workout",
    tone: "warning",
    durationMs: 10000,
    onUndo: () => undefined,
    onCommit: () => {
      committed = true;
    },
  });

  const transition = queue.expireCurrent();
  await runEffects(transition.effects);

  assert.equal(committed, true);
  assert.equal(transition.current, null);
});

test("queue remains FIFO when multiple items are enqueued", () => {
  const queue = new FeedbackQueue(() => 3000);

  queue.enqueue({
    id: "t1",
    kind: "toast",
    message: "First",
    tone: "info",
    durationMs: 2200,
  });

  queue.enqueue({
    id: "t2",
    kind: "toast",
    message: "Second",
    tone: "success",
    durationMs: 2200,
  });

  const s1 = queue.snapshot();
  assert.equal(s1.current?.id, "t1");
  assert.equal(s1.pendingCount, 1);

  const s2 = queue.dismissCurrent();
  assert.equal(s2.current?.id, "t2");
  assert.equal(s2.pendingCount, 0);
});
