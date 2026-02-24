import React, { useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import { clearToken, getToken, setToken } from "../api/client";
import { AuthContext, type AuthState } from "./AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<authApi.User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(getToken());

  useEffect(() => {
    (async () => {
      try {
        const t = getToken();
        if (!t) return;
        const res = await authApi.me();
        setUser(res.user);
      } catch {
        clearToken();
        setTokenState(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const res = await authApi.login({ email, password });
    setToken(res.token);
    setTokenState(res.token);

    const meRes = await authApi.me();
    setUser(meRes.user);
  }

  async function signUp(name: string, email: string, password: string) {
    const res = await authApi.register({ name, email, password });
    setToken(res.token);
    setTokenState(res.token);

    const meRes = await authApi.me();
    setUser(meRes.user);
  }

  function signOut() {
    clearToken();
    setTokenState(null);
    setUser(null);
  }

  const value: AuthState = useMemo(
    () => ({ user, isLoading, token, signIn, signUp, signOut }),
    [user, isLoading, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
