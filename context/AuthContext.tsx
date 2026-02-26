import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserProfile, getUserProfile, markOnboardingDone } from "@/lib/userProfile";

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

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return;

      setIsLoading(true);

      if (!fbUser) {
        setUser(null);
        setIsProfileComplete(false);
        setIsLoading(false);
        return;
      }

      const uid = fbUser.uid;
      const email = (fbUser.email || "").trim().toLowerCase();

      setUser({ id: uid, email });

      try {
        // Make sure /users/{uid} exists (non-destructive)
        if (email) {
          await ensureUserProfile(uid, email);
        }

        // Read profile to determine onboardingDone
        const profile = await getUserProfile(uid);
        setIsProfileComplete(!!profile?.onboardingDone);
      } catch {
        // If Firestore fails, do not assume complete
        setIsProfileComplete(false);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const login = async (email: string, password: string): Promise<FirebaseUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

    const uid = cred.user.uid;
    const userEmail = (cred.user.email || cleanEmail).trim().toLowerCase();

    // Ensure profile doc exists
    await ensureUserProfile(uid, userEmail);

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
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

    const uid = cred.user.uid;
    const userEmail = (cred.user.email || cleanEmail).trim().toLowerCase();

    await ensureUserProfile(uid, userEmail);

    // New user hasn’t completed onboarding yet
    setIsProfileComplete(false);

    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsProfileComplete(false);
  };

  const updateUser = async (updates: OnboardingUpdates) => {
    const uid = user?.id;
    if (!uid) throw new Error("Session missing. Please login again.");

    await markOnboardingDone(uid, updates);

    // Immediately reflect completion in context
    setIsProfileComplete(true);
  };

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
    [user, isLoading, isProfileComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}