import { getIsOnline } from "@/lib/network";
import { syncMirrorNow } from "@/lib/sync/mirrorQueue";
import { reconcileCloudToLocal } from "@/lib/sync/reconcile";

const inFlight = new Map<string, Promise<void>>();

export async function syncNow(uid: string): Promise<void> {
  const existing = inFlight.get(uid);
  if (existing) return existing;

  const run = (async () => {
    // Push pending local writes first.
    await syncMirrorNow();

    // Then pull latest from cloud if connected.
    if (getIsOnline()) {
      await reconcileCloudToLocal(uid, { force: true });
    }
  })().finally(() => {
    inFlight.delete(uid);
  });

  inFlight.set(uid, run);
  return run;
}
