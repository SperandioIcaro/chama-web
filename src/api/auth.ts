import { api } from "./client";

export type User = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  github_login: string | null;
};

export type AuthResponse = { token: string; user: User };

export function register(payload: { name: string; email: string; password: string }) {
  return api<AuthResponse>("/api/register", {
    method: "POST",
    body: { user: payload },
    auth: false,
  });
}

export function login(payload: { email: string; password: string }) {
  return api<AuthResponse>("/api/login", { method: "POST", body: payload, auth: false });
}

export function loginWithGithub(payload: { code: string; redirect_uri: string }) {
  return api<AuthResponse>("/api/auth/github", { method: "POST", body: payload, auth: false });
}

export function me() {
  return api<{ user: User }>("/api/me");
}
