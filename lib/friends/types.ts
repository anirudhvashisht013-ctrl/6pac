import type { WorkoutTemplate } from "@/lib/types";

export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export type FriendUserSummary = {
  uid: string;
  friendRefId: string | null;
  fullName: string | null;
  email: string | null;
};

export type FriendRequestView = {
  pairKey: string;
  status: FriendRequestStatus;
  requesterUid: string;
  receiverUid: string;
  requestedAt: string | null;
  respondedAt: string | null;
  otherUser: FriendUserSummary;
};

export type FriendSummary = FriendUserSummary & {
  sinceAt: string | null;
  copiedMyWorkoutsCount: number;
};

export type FriendsDashboard = {
  myFriendRefId: string;
  incoming: FriendRequestView[];
  sent: FriendRequestView[];
  friends: FriendSummary[];
  fromCache: boolean;
};

export type FriendSearchResult =
  | { ok: true; user: FriendUserSummary }
  | { ok: false; code: "invalid_id" | "not_found" | "self" };

export type SendFriendRequestResult =
  | { ok: true; targetUid: string }
  | {
      ok: false;
      code:
        | "invalid_id"
        | "not_found"
        | "self"
        | "already_friends"
        | "duplicate_request"
        | "incoming_pending"
        | "failed";
    };

export type FriendActionResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "invalid_state" | "failed" };

export type SharedWorkoutView = {
  id: string;
  ownerUid: string;
  templateId: string;
  template: WorkoutTemplate;
  updatedAt: string | null;
  createdAt: string | null;
};
