import { API_BASE } from "../config";

const TOKEN_KEY = "chama:token";
export const UNAUTHORIZED_EVENT = "chama:unauthorized";

/**
 * O token pertence à ABA, não ao navegador:
 *  - fica em memória (e em sessionStorage, que sobrevive ao F5 mas NÃO é compartilhado entre abas/janelas);
 *  - o localStorage guarda só "o último login", usado quando uma aba nova abre sem sessão própria.
 * Assim, entrar com outro perfil em outra aba/janela não troca o perfil desta aba.
 */
let memoryToken: string | null | undefined; // undefined = ainda não carregado

export function getToken(): string | null {
  if (memoryToken === undefined) {
    try {
      memoryToken = sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
      if (memoryToken) sessionStorage.setItem(TOKEN_KEY, memoryToken);
    } catch {
      memoryToken = null;
    }
  }
  return memoryToken;
}

export function setToken(token: string) {
  memoryToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // armazenamento bloqueado: a sessão dura só até recarregar
  }
}

export function clearToken() {
  const current = getToken();
  memoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    // só apaga o "último login" se for o desta aba (não derruba o perfil de outra aba)
    if (localStorage.getItem(TOKEN_KEY) === current) localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  code: string | undefined;
  fields: Record<string, string[]> | undefined;

  constructor(message: string, status: number, code?: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Envia o token e trata 401 como sessão expirada. Padrão: true. */
  auth?: boolean;
};

function isFieldMap(value: unknown): value is Record<string, string[]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function api<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? "O servidor demorou demais para responder."
        : "Sem conexão com o servidor. Confira sua internet.",
      0,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const d = (typeof data === "object" && data !== null ? data : {}) as {
      error?: unknown;
      message?: unknown;
      fields?: unknown;
    };
    const code = typeof d.error === "string" ? d.error : undefined;
    const message = typeof d.message === "string" ? d.message : (code ?? `Erro ${res.status}`);

    // Token inválido/expirado: derruba a sessão (login/registro usam auth:false).
    if (res.status === 401 && auth) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(message, res.status, code, isFieldMap(d.fields) ? d.fields : undefined);
  }

  return data as T;
}
