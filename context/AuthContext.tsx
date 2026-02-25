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
import { markOnboardingDone } from "@/lib/userProfile";

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

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;

  // ✅ keep same name as your old app so onboarding doesn't break
  updateUser: (updates: OnboardingUpdates) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUser({
          id: fbUser.uid,
          email: fbUser.email || "",
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string): Promise<FirebaseUser> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const signUp = async (email: string, password: string): Promise<FirebaseUser> => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
  };

  // ✅ Called by onboarding "Finish"
  const updateUser = async (updates: OnboardingUpdates) => {
    if (!user?.id) {
      throw new Error("Session missing. Please login again.");
    }
    await markOnboardingDone(user.id, updates);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login,
      signUp,
      logout,
      updateUser,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}