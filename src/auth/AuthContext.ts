import { createContext } from "react";
import type * as authApi from "../api/auth";

export type AuthState = {
  user: authApi.User | null;
  isLoading: boolean;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);
