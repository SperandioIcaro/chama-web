const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    const cleaned = token.startsWith("Bearer ") ? token.slice(7) : token;
    headers.set("Authorization", `Bearer ${cleaned}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
  });

  if (!res.ok) {
    let msg = `Erro HTTP ${res.status}`;

    const contentType = res.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const data = await res.json();
      msg = data?.message || data?.error || msg;
    }

    throw new Error(msg);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
