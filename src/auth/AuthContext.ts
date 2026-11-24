import { createContext } from "react";
import type { User } from "../api/auth";

export type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  /** já houve uma sessão nesta aba (usado para não "herdar" a página de outro perfil) */
  hadSession: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGithub: (code: string, redirectUri: string) => Promise<void>;
  signOut: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);
