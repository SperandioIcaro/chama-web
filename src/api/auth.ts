import { api } from "./client";

export type User = {
  id: string;
  email?: string;
  name?: string;
  username?: string;
};

export async function register(payload: {
  name: string;
  email: string;
  password: string;
}) {
  return api<{ token: string }>("/api/register", {
    method: "POST",
    body: JSON.stringify({ user: payload }),
  });
}

export async function login(payload: { email: string; password: string }) {
  return api<{ token: string }>("/api/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function me() {
  return api<{ user: User }>("/api/me", { auth: true });
}
