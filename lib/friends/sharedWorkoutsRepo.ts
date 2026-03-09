import { db } from "@/lib/firebase";
import type { WorkoutTemplate } from "@/lib/types";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

const SHARED_WORKOUTS_COLLECTION = "shared_workouts_v1";

function sharedWorkoutDocId(ownerUid: string, templateId: string): string {
  return `${ownerUid}__${templateId}`;
}

export async function syncSharedWorkoutTemplate(
  ownerUid: string,
  template: WorkoutTemplate
): Promise<void> {
  const ref = doc(db, SHARED_WORKOUTS_COLLECTION, sharedWorkoutDocId(ownerUid, template.id));

  if (!template.sharedWithFriends) {
    await deleteDoc(ref);
    return;
  }

  await setDoc(
    ref,
    {
      ownerUid,
      templateId: template.id,
      template,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      sourceUpdatedAt: template.updatedAt,
    },
    { merge: true }
  );
}

export async function removeSharedWorkoutTemplate(ownerUid: string, templateId: string): Promise<void> {
  const ref = doc(db, SHARED_WORKOUTS_COLLECTION, sharedWorkoutDocId(ownerUid, templateId));
  await deleteDoc(ref);
}
