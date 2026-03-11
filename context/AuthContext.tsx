import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type FirebaseUser,
} from "@/lib/firebase";
import { ensureUserProfile, getUserProfile, markOnboardingDone } from "@/lib/userProfile";
import { ensureAutoBackupOnce } from "@/lib/backup/autoBackupOnce";
import { reconcileCloudToLocal } from "@/lib/sync/reconcile";
import { syncNow } from "@/lib/sync/syncNow";
import { getIsOnline, subscribeNetworkStatus } from "@/lib/network";
import { ensureExerciseLibraryInitialized } from "@/lib/exercises/libraryService";
import { ensureMyFriendRefId } from "@/lib/friends/service";
import { logError, logFirebase } from "@/lib/bootstrap/logger";

type AppUser = {
  id: string; // Firebase uid
  email: string;
};

type OnboardingUpdates = {
  fullName: string;
  dateOfBirth: string;
  sex: "male" | "female" | "other";
  currentWeightKg: number;
  goalType: "lean" | "recomp" | "buffed";
};

export interface AuthContextValue {
  user: AppUser | null;

  /**
   * True while Firebase auth restores and (if logged-in) profile is fetched.
   */
  isLoading: boolean;

  /**
   * Derived from Firestore users/{uid}.onboardingDone.
   */
  isProfileComplete: boolean;

  login: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;

  /**
   * Called from onboarding screen to finalize onboarding.
   */
  updateUser: (updates: OnboardingUpdates) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    logFirebase("Auth session restore started");

    try {
      unsub = onAuthStateChanged(async (fbUser) => {
        if (cancelled) return;

        setIsLoading(true);

        if (!fbUser) {
          logFirebase("Auth state resolved with no active user");
          setUser(null);
          setIsProfileComplete(false);
          setIsLoading(false);
          return;
        }

        const uid = fbUser.uid;
        const email = (fbUser.email || "").trim().toLowerCase();
        logFirebase("Auth state resolved with active user", { uid });

        setUser({ id: uid, email });

        try {
          // Make sure /users/{uid} exists (non-destructive)
          if (email) {
            await ensureUserProfile(uid, email);
          }

          try {
            await ensureMyFriendRefId(uid);
          } catch (error) {
            logError("Friend ref id bootstrap failed", error, { uid });
          }

          // Pull cloud mirror into local cache before app screens start reading local repos.
          try {
            await reconcileCloudToLocal(uid);
          } catch (error) {
            logError("Cloud to local reconcile failed", error, { uid });
          }

          try {
            await ensureExerciseLibraryInitialized(uid);
          } catch (error) {
            logError("Exercise library bootstrap failed", error, { uid });
          }

          // Read profile to determine onboardingDone
          const profile = await getUserProfile(uid);
          setIsProfileComplete(!!profile?.onboardingDone);

          // Fire-and-forget: run once per user/device after login restore.
          void ensureAutoBackupOnce(uid).catch((error) => {
            logError("Auto backup failed", error, { uid });
          });
        } catch (error) {
          // If Firestore fails, do not assume complete
          logError("Auth bootstrap dependent calls failed", error, { uid });
          setIsProfileComplete(false);
        } finally {
          setIsLoading(false);
        }
      });
    } catch (error) {
      logError("Auth state listener attachment failed", error);
      setIsProfileComplete(false);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    void syncNow(uid).catch((error) => {
      logError("Initial sync failed", error, { uid });
    });

    const reconcileIfOnline = () => {
      if (!getIsOnline()) return;
      void reconcileCloudToLocal(uid).catch((error) => {
        logError("Reconcile on reconnect failed", error, { uid });
      });
    };

    // Best-effort immediate pull for already-online state.
    reconcileIfOnline();

    const unsub = subscribeNetworkStatus(() => {
      if (getIsOnline()) reconcileIfOnline();
    });

    const intervalId = setInterval(() => {
      reconcileIfOnline();
    }, 3 * 60 * 1000);

    return () => {
      unsub();
      clearInterval(intervalId);
    };
  }, [user?.id]);

  const login = async (email: string, password: string): Promise<FirebaseUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(cleanEmail, password);

    const uid = cred.user.uid;
    const userEmail = (cred.user.email || cleanEmail).trim().toLowerCase();

    // Ensure profile doc exists
    await ensureUserProfile(uid, userEmail);
    try {
      await ensureMyFriendRefId(uid);
    } catch (error) {
      logError("Friend ref id bootstrap failed after login", error, { uid });
    }

    // Update completeness right away
    try {
      const profile = await getUserProfile(uid);
      setIsProfileComplete(!!profile?.onboardingDone);
    } catch {
      setIsProfileComplete(false);
    }

    return cred.user;
  };

  const signUp = async (email: string, password: string): Promise<FirebaseUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(cleanEmail, password);

    const uid = cred.user.uid;
    const userEmail = (cred.user.email || cleanEmail).trim().toLowerCase();

    await ensureUserProfile(uid, userEmail);
    try {
      await ensureMyFriendRefId(uid);
    } catch (error) {
      logError("Friend ref id bootstrap failed after signup", error, { uid });
    }

    // New user hasn’t completed onboarding yet
    setIsProfileComplete(false);

    return cred.user;
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setIsProfileComplete(false);
  };

  const updateUser = useCallback(async (updates: OnboardingUpdates) => {
    const uid = user?.id;
    if (!uid) throw new Error("Session missing. Please login again.");

    await markOnboardingDone(uid, updates);

    // Immediately reflect completion in context
    setIsProfileComplete(true);
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isProfileComplete,
      login,
      signUp,
      logout,
      updateUser,
    }),
    [user, isLoading, isProfileComplete, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
