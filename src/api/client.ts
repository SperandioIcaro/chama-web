const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export function getToken() {
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

export async function api<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);

  headers.set("Content-Type", "application/json");

  if (opts.auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  // if (!res.ok) {
  //   const message = data?.message || data?.error || `HTTP ${res.status}`;
  //   throw new Error(message);
  // }
  if (!res.ok) {
    console.error("API error", res.status, data);
    const message =
      data?.message ||
      data?.error ||
      (data?.errors ? JSON.stringify(data.errors) : null) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}
