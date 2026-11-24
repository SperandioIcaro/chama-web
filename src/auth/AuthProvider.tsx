import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { UNAUTHORIZED_EVENT, clearToken, getToken, setToken } from "../api/client";
import { AuthContext, type AuthState } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authApi.User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  // só "carrega" se existe token para validar (evita piscar tela de loading no login)
  const [isLoading, setLoading] = useState<boolean>(() => getToken() !== null);
  const [hadSession, setHadSession] = useState(false);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    // descarta salas/mensagens em cache do usuário anterior
    queryClient.clear();
  }, [queryClient]);

  // Valida o token salvo ao abrir o app.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;

    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setHadSession(true);
      })
      .catch(() => {
        if (!cancelled) reset();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reset]);

  // A API respondeu 401 em algum lugar: sessão acabou.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, reset);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, reset);
  }, [reset]);

  const complete = useCallback(
    (res: authApi.AuthResponse) => {
      queryClient.clear();
      setToken(res.token);
      setTokenState(res.token);
      setUser(res.user);
      setHadSession(true);
      setLoading(false);
    },
    [queryClient],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isLoading,
      hadSession,
      signIn: async (email, password) => complete(await authApi.login({ email, password })),
      signUp: async (name, email, password) =>
        complete(await authApi.register({ name, email, password })),
      signInWithGithub: async (code, redirectUri) =>
        complete(await authApi.loginWithGithub({ code, redirect_uri: redirectUri })),
      signOut: reset,
    }),
    [user, token, isLoading, hadSession, complete, reset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
