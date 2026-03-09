import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { C } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useFeedbackToast } from "@/context/FeedbackToastContext";
import { normalizeFriendRefId } from "@/lib/friends/id";
import {
  acceptFriendRequest,
  cancelSentFriendRequest,
  declineFriendRequest,
  loadFriendsDashboard,
  searchUserByFriendRefId,
  sendFriendRequestByRefId,
  subscribeFriendsDashboard,
} from "@/lib/friends/service";
import type { FriendRequestView, FriendSearchResult, FriendSummary, FriendsDashboard } from "@/lib/friends/types";
import { subscribeDataEvents } from "@/lib/dataEvents";
import { workoutsRepo } from "@/lib/storage";
import type { WorkoutTemplate } from "@/lib/types";

type TabKey = "friends" | "incoming" | "search";
type RequestAction = "accept" | "decline" | "cancel";

function friendlyName(name: string | null, email: string | null): string {
  const trimmed = (name || "").trim();
  if (trimmed.length > 0) return trimmed;
  const left = (email || "").split("@")[0] || "";
  if (left.length > 0) return left;
  return "User";
}

function formatWhen(value: string | null): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
}

function mapSearchError(code: "invalid_id" | "not_found" | "self"): string {
  if (code === "invalid_id") return "Enter a valid Friend ID (example: ABC-123).";
  if (code === "self") return "This is your own Friend ID.";
  return "No user found for this Friend ID.";
}

function mapRequestError(
  code: "invalid_id" | "not_found" | "self" | "already_friends" | "duplicate_request" | "incoming_pending" | "failed"
): string {
  if (code === "invalid_id") return "Enter a valid Friend ID (example: ABC-123).";
  if (code === "self") return "You cannot send a friend request to yourself.";
  if (code === "not_found") return "No user found for this Friend ID.";
  if (code === "already_friends") return "You are already friends with this user.";
  if (code === "duplicate_request") return "You already sent a pending request to this user.";
  if (code === "incoming_pending") return "This user already sent you a request. Accept it in Incoming Requests.";
  return "Unable to complete this action right now.";
}

function applyLocalRequestSuccess(
  dashboard: FriendsDashboard,
  pairKey: string,
  action: RequestAction
): FriendsDashboard {
  if (action === "cancel") {
    return {
      ...dashboard,
      sent: dashboard.sent.filter((item) => item.pairKey !== pairKey),
    };
  }

  if (action === "decline") {
    return {
      ...dashboard,
      incoming: dashboard.incoming.filter((item) => item.pairKey !== pairKey),
    };
  }

  const acceptedRequest = dashboard.incoming.find((item) => item.pairKey === pairKey) || null;
  const nextIncoming = dashboard.incoming.filter((item) => item.pairKey !== pairKey);

  if (!acceptedRequest) {
    return {
      ...dashboard,
      incoming: nextIncoming,
    };
  }

  const newFriend: FriendSummary = {
    ...acceptedRequest.otherUser,
    sinceAt: new Date().toISOString(),
    copiedMyWorkoutsCount: 0,
  };

  const exists = dashboard.friends.some((item) => item.uid === newFriend.uid);

  return {
    ...dashboard,
    incoming: nextIncoming,
    friends: exists ? dashboard.friends : [newFriend, ...dashboard.friends],
  };
}

export default function ProfileFriendsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useFeedbackToast();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<FriendsDashboard | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("friends");

  const [searchText, setSearchText] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResult, setSearchResult] = useState<FriendSearchResult | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [requestActionKey, setRequestActionKey] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [sharingSearch, setSharingSearch] = useState("");
  const [sharingExpanded, setSharingExpanded] = useState(false);
  const [shareToggleTemplateId, setShareToggleTemplateId] = useState<string | null>(null);
  const [selectAllBusy, setSelectAllBusy] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setTemplatesLoading(true);
    try {
      const data = await workoutsRepo.getAll(user.id);
      setTemplates([...data].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.warn("load templates for sharing failed", error);
    } finally {
      setTemplatesLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      let active = true;
      setLoading(true);

      void loadFriendsDashboard(user.id)
        .then((data) => {
          if (!active) return;
          setDashboard(data);
          setLoading(false);
        })
        .catch((error) => {
          if (!active) return;
          setLoading(false);
          console.warn("friends initial load failed", error);
          showToast({ message: "Unable to load friends right now.", tone: "error" });
        });

      void loadTemplates();

      const unsubRealtime = subscribeFriendsDashboard(user.id, {
        onData: (data) => {
          if (!active) return;
          setDashboard(data);
          setLoading(false);
        },
        onError: (error) => {
          if (!active) return;
          console.warn("friends realtime subscription failed", error);
        },
      });

      const unsubData = subscribeDataEvents((event) => {
        if (event.uid === user.id && event.source === "workouts") {
          void loadTemplates();
        }
      });

      return () => {
        active = false;
        unsubRealtime();
        unsubData();
      };
    }, [loadTemplates, showToast, user])
  );

  const doSearch = useCallback(async () => {
    if (!user) return;

    const normalized = normalizeFriendRefId(searchText);
    setSearchText(normalized);
    setSearchResult(null);
    setSearchBusy(true);

    try {
      const result = await searchUserByFriendRefId(user.id, normalized);
      setSearchResult(result);
      if (!result.ok) {
        showToast({ message: mapSearchError(result.code), tone: "warning" });
      }
    } catch (error) {
      showToast({ message: "Unable to search right now.", tone: "error" });
      console.warn("friend search failed", error);
    } finally {
      setSearchBusy(false);
    }
  }, [searchText, showToast, user]);

  const doSendRequest = useCallback(async () => {
    if (!user) return;
    setSendBusy(true);

    try {
      const result = await sendFriendRequestByRefId(user.id, searchText);
      if (!result.ok) {
        showToast({ message: mapRequestError(result.code), tone: "warning" });
        return;
      }
      showToast({ message: "Friend request sent", tone: "success" });
      setSearchText("");
      setSearchResult(null);
    } catch (error) {
      showToast({ message: "Unable to send request right now.", tone: "error" });
      console.warn("send friend request failed", error);
    } finally {
      setSendBusy(false);
    }
  }, [searchText, showToast, user]);

  const runRequestAction = useCallback(
    async (
      item: FriendRequestView,
      action: RequestAction,
      runner: () => Promise<{ ok: boolean }>,
      successMessage: string
    ) => {
      setRequestActionKey(item.pairKey);
      try {
        const result = await runner();
        if (!result.ok) {
          showToast({ message: "Request is no longer in a valid state.", tone: "warning" });
          return;
        }

        setDashboard((prev) => (prev ? applyLocalRequestSuccess(prev, item.pairKey, action) : prev));
        showToast({ message: successMessage, tone: "success" });
      } catch (error) {
        showToast({ message: "Unable to update request right now.", tone: "error" });
        console.warn("request action failed", error);
      } finally {
        setRequestActionKey(null);
      }
    },
    [showToast]
  );

  const copyMyFriendId = useCallback(() => {
    if (!dashboard?.myFriendRefId) return;
    Clipboard.setString(dashboard.myFriendRefId);
    showToast({ message: "Friend ID copied", tone: "success" });
  }, [dashboard?.myFriendRefId, showToast]);

  const shareMyFriendId = useCallback(async () => {
    if (!dashboard?.myFriendRefId) return;
    try {
      await Share.share({
        message: `Add me on 6Pac. Friend ID: ${dashboard.myFriendRefId}`,
      });
    } catch (error) {
      showToast({ message: "Unable to open share sheet.", tone: "error" });
      console.warn("share friend id failed", error);
    }
  }, [dashboard?.myFriendRefId, showToast]);

  const onToggleWorkoutSharing = useCallback(
    async (template: WorkoutTemplate, next: boolean) => {
      if (!user) return;
      setShareToggleTemplateId(template.id);

      const now = new Date().toISOString();
      const updated: WorkoutTemplate = {
        ...template,
        sharedWithFriends: next,
        updatedAt: now,
      };

      setTemplates((prev) => prev.map((item) => (item.id === template.id ? updated : item)));

      try {
        await workoutsRepo.save(user.id, updated);
      } catch (error) {
        setTemplates((prev) => prev.map((item) => (item.id === template.id ? template : item)));
        showToast({ message: "Unable to update sharing right now.", tone: "error" });
        console.warn("toggle workout sharing failed", error);
      } finally {
        setShareToggleTemplateId(null);
      }
    },
    [showToast, user]
  );

  const onToggleSelectAll = useCallback(
    async (next: boolean) => {
      if (!user) return;

      const toUpdate = templates.filter((template) => (template.sharedWithFriends !== false) !== next);
      if (toUpdate.length === 0) return;

      setSelectAllBusy(true);
      const now = new Date().toISOString();

      setTemplates((prev) =>
        prev.map((item) => ({
          ...item,
          sharedWithFriends: next,
          updatedAt: now,
        }))
      );

      try {
        for (const template of toUpdate) {
          await workoutsRepo.save(user.id, {
            ...template,
            sharedWithFriends: next,
            updatedAt: now,
          });
        }
      } catch (error) {
        void loadTemplates();
        showToast({ message: "Unable to update all workout sharing settings.", tone: "error" });
        console.warn("select all sharing failed", error);
      } finally {
        setSelectAllBusy(false);
      }
    },
    [loadTemplates, showToast, templates, user]
  );

  const filteredTemplates = useMemo(() => {
    const q = sharingSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((template) => {
      const hay = `${template.name} ${template.notes || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sharingSearch, templates]);

  const allSelected = templates.length > 0 && templates.every((template) => template.sharedWithFriends !== false);

  const canSearch = searchText.trim().length >= 3;
  const canSend = searchResult?.ok === true;

  const buddiesSinceLabel = (sinceAt: string | null): string => {
    if (!sinceAt) return "You are 6Pac buddies.";
    const started = new Date(sinceAt);
    if (Number.isNaN(started.getTime())) return "You are 6Pac buddies.";
    const diffMs = Date.now() - started.getTime();
    const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    return `You are 6Pac buddies since ${days} day${days === 1 ? "" : "s"}.`;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (!user || !dashboard) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={styles.emptyText}>Unable to load friends.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Friends</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Friend ID</Text>
          <Text style={styles.friendId}>{dashboard.myFriendRefId}</Text>
          <Text style={styles.cardSub}>Share this ID so others can add you.</Text>
          <View style={styles.inlineButtonsRow}>
            <Pressable style={styles.inlineBtn} onPress={copyMyFriendId}>
              <Ionicons name="copy-outline" size={14} color={C.primary} />
              <Text style={styles.inlineBtnText}>Copy</Text>
            </Pressable>
            <Pressable style={styles.inlineBtn} onPress={() => { void shareMyFriendId(); }}>
              <Ionicons name="share-social-outline" size={14} color={C.primary} />
              <Text style={styles.inlineBtnText}>Share</Text>
            </Pressable>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>{dashboard.friends.length} friend{dashboard.friends.length === 1 ? "" : "s"}</Text>
            <Text style={styles.statsText}>{dashboard.incoming.length} incoming</Text>
            <Text style={styles.statsText}>{dashboard.sent.length} sent</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={({ pressed }) => [styles.tabBtn, activeTab === "friends" && styles.tabBtnActive, pressed && { opacity: 0.85 }]}
            onPress={() => setActiveTab("friends")}
          >
            <Text style={[styles.tabBtnText, activeTab === "friends" && styles.tabBtnTextActive]}>Added Friends</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tabBtn, activeTab === "incoming" && styles.tabBtnActive, pressed && { opacity: 0.85 }]}
            onPress={() => setActiveTab("incoming")}
          >
            <Text style={[styles.tabBtnText, activeTab === "incoming" && styles.tabBtnTextActive]}>Incoming Requests</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tabBtn, activeTab === "search" && styles.tabBtnActive, pressed && { opacity: 0.85 }]}
            onPress={() => setActiveTab("search")}
          >
            <Text style={[styles.tabBtnText, activeTab === "search" && styles.tabBtnTextActive]}>Search Friends</Text>
          </Pressable>
        </View>

        {activeTab === "friends" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Added Friends</Text>
              {dashboard.friends.length === 0 ? (
                <Text style={styles.emptyText}>No friends yet.</Text>
              ) : (
                dashboard.friends.map((friend) => (
                  <Pressable
                    key={friend.uid}
                    style={({ pressed }) => [styles.friendCard, pressed && { opacity: 0.92 }]}
                    onPress={() =>
                      router.push({
                        pathname: "/profile-friend-workouts",
                        params: {
                          friendUid: friend.uid,
                          friendName: friendlyName(friend.fullName, friend.email),
                        },
                      } as any)
                    }
                  >
                    <View style={styles.friendTopRow}>
                      <Text style={styles.rowName}>{friendlyName(friend.fullName, friend.email)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                    </View>
                    <Text style={styles.rowMeta}>{friend.friendRefId || "No ID"}</Text>
                    <Text style={styles.rowMeta}>{buddiesSinceLabel(friend.sinceAt)}</Text>
                    <View style={styles.friendCopiedPill}>
                      <Ionicons name="people-outline" size={12} color={C.primary} />
                      <Text style={styles.friendCopiedText}>{friend.copiedMyWorkoutsCount || 0} copied your workouts</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.sectionHeaderPressable, pressed && { opacity: 0.85 }]}
                onPress={() => setSharingExpanded((prev) => !prev)}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.cardTitle}>My Workout Sharing</Text>
                  <View style={styles.sectionHeaderRight}>
                    {selectAllBusy ? <ActivityIndicator size="small" color={C.primary} /> : null}
                    <Ionicons
                      name={sharingExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={C.textMuted}
                    />
                  </View>
                </View>
              </Pressable>

              {sharingExpanded ? (
                <>
                  <View style={styles.selectAllRow}>
                    <Text style={styles.rowMeta}>Select all</Text>
                    <Switch
                      value={allSelected}
                      onValueChange={(value) => {
                        void onToggleSelectAll(value);
                      }}
                      trackColor={{ false: C.border, true: C.primary + "66" }}
                      thumbColor={allSelected ? C.primary : C.textMuted}
                    />
                  </View>

                  {templatesLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={C.primary} />
                    </View>
                  ) : templates.length === 0 ? (
                    <View style={styles.emptyWrap}>
                      <Text style={styles.emptyText}>No workouts yet. Add a workout to start sharing.</Text>
                      <Pressable
                        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                        onPress={() => router.push({ pathname: "/editor", params: { id: "new" } } as any)}
                      >
                        <Ionicons name="add" size={14} color={C.bg} />
                        <Text style={styles.primaryBtnText}>Add Workout</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        value={sharingSearch}
                        onChangeText={setSharingSearch}
                        placeholder="Search workouts"
                        placeholderTextColor={C.textMuted}
                        style={styles.input}
                      />

                      {filteredTemplates.length === 0 ? (
                        <Text style={styles.emptyText}>No workouts match this search.</Text>
                      ) : (
                        filteredTemplates.map((template) => (
                          <View key={template.id} style={styles.rowCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rowName}>{template.name}</Text>
                              <Text style={styles.rowMeta}>{template.sharedWithFriends ? "Shared" : "Private"}</Text>
                            </View>
                            {shareToggleTemplateId === template.id ? (
                              <ActivityIndicator size="small" color={C.primary} />
                            ) : (
                              <Switch
                                value={template.sharedWithFriends !== false}
                                onValueChange={(value) => {
                                  void onToggleWorkoutSharing(template, value);
                                }}
                                trackColor={{ false: C.border, true: C.primary + "66" }}
                                thumbColor={template.sharedWithFriends ? C.primary : C.textMuted}
                              />
                            )}
                          </View>
                        ))
                      )}
                    </>
                  )}
                </>
              ) : null}
            </View>
          </>
        ) : null}

        {activeTab === "incoming" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Incoming Requests</Text>
            {dashboard.incoming.length === 0 ? (
              <Text style={styles.emptyText}>No incoming requests.</Text>
            ) : (
              dashboard.incoming.map((request) => (
                <View key={request.pairKey} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{friendlyName(request.otherUser.fullName, request.otherUser.email)}</Text>
                    <Text style={styles.rowMeta}>
                      {request.otherUser.friendRefId || "No ID"}
                      {request.requestedAt ? ` • ${formatWhen(request.requestedAt)}` : ""}
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.85 }]}
                      disabled={requestActionKey === request.pairKey}
                      onPress={() => {
                        void runRequestAction(
                          request,
                          "accept",
                          () => acceptFriendRequest(user.id, request.pairKey),
                          "Friend request accepted"
                        );
                      }}
                    >
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
                      disabled={requestActionKey === request.pairKey}
                      onPress={() => {
                        void runRequestAction(
                          request,
                          "decline",
                          () => declineFriendRequest(user.id, request.pairKey),
                          "Friend request declined"
                        );
                      }}
                    >
                      <Text style={styles.outlineBtnText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === "search" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Search by Friend ID</Text>
              <TextInput
                value={searchText}
                onChangeText={(value) => {
                  setSearchText(normalizeFriendRefId(value));
                  setSearchResult(null);
                }}
                placeholder="ABC-123"
                placeholderTextColor={C.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                style={styles.input}
              />

              <View style={styles.inlineButtonsRow}>
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, !canSearch && styles.disabled]}
                  disabled={!canSearch || searchBusy}
                  onPress={() => {
                    void doSearch();
                  }}
                >
                  {searchBusy ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : (
                    <>
                      <Ionicons name="search" size={14} color={C.bg} />
                      <Text style={styles.primaryBtnText}>Search</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.inlineBtn, pressed && { opacity: 0.85 }, (!canSend || sendBusy) && styles.disabled]}
                  disabled={!canSend || sendBusy}
                  onPress={() => {
                    void doSendRequest();
                  }}
                >
                  {sendBusy ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={14} color={C.primary} />
                      <Text style={styles.inlineBtnText}>Send Request</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {searchResult?.ok ? (
                <View style={styles.resultCard}>
                  <Text style={styles.rowName}>{friendlyName(searchResult.user.fullName, searchResult.user.email)}</Text>
                  <Text style={styles.rowMeta}>{searchResult.user.friendRefId || "No ID"}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sent Requests</Text>
              {dashboard.sent.length === 0 ? (
                <Text style={styles.emptyText}>No sent requests.</Text>
              ) : (
                dashboard.sent.map((request) => (
                  <View key={request.pairKey} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{friendlyName(request.otherUser.fullName, request.otherUser.email)}</Text>
                      <Text style={styles.rowMeta}>
                        {request.otherUser.friendRefId || "No ID"}
                        {request.requestedAt ? ` • ${formatWhen(request.requestedAt)}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
                      disabled={requestActionKey === request.pairKey}
                      onPress={() => {
                        void runRequestAction(
                          request,
                          "cancel",
                          () => cancelSentFriendRequest(user.id, request.pairKey),
                          "Friend request cancelled"
                        );
                      }}
                    >
                      <Text style={styles.outlineBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontFamily: "Outfit_500Medium", fontSize: 13, color: C.textSecondary },
  pageTitle: { fontFamily: "Outfit_700Bold", fontSize: 28, color: C.text },
  card: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: C.text },
  cardSub: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  friendId: { fontFamily: "Outfit_700Bold", fontSize: 24, color: C.primary, letterSpacing: 1 },
  inlineButtonsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inlineBtn: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  inlineBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.primary },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  statsText: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    borderColor: C.primary + "66",
    backgroundColor: C.primaryBg,
  },
  tabBtnText: { fontFamily: "Outfit_500Medium", fontSize: 12, color: C.textMuted, textAlign: "center" },
  tabBtnTextActive: { color: C.primary, fontFamily: "Outfit_600SemiBold" },
  rowCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  friendCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  friendTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: C.text },
  rowMeta: { fontFamily: "Outfit_400Regular", fontSize: 12, color: C.textMuted },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  acceptBtn: {
    minHeight: 34,
    minWidth: 68,
    borderRadius: 9,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  acceptBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.bg },
  outlineBtn: {
    minHeight: 34,
    minWidth: 68,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  outlineBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: C.text,
  },
  primaryBtn: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: C.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  primaryBtnText: { fontFamily: "Outfit_600SemiBold", fontSize: 12, color: C.bg },
  resultCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary + "55",
    backgroundColor: C.primaryBg,
    padding: 10,
    gap: 2,
  },
  sectionHeaderPressable: {
    borderRadius: 10,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  friendCopiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary + "55",
    backgroundColor: C.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  friendCopiedText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    color: C.primary,
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loadingRow: { minHeight: 50, alignItems: "center", justifyContent: "center" },
  emptyWrap: { gap: 10 },
  emptyText: { fontFamily: "Outfit_400Regular", fontSize: 13, color: C.textMuted },
  disabled: { opacity: 0.5 },
});
