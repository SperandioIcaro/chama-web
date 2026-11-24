const env = import.meta.env as Record<string, string | undefined>;

// `VITE_API_BASE=` (vazio) = mesma origem: o Vite repassa /api e /socket para a API (ótimo para testar no celular).
export const API_BASE = (env.VITE_API_BASE ?? "http://localhost:4000").replace(/\/$/, "");

const sameOriginWs = () =>
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/socket`;

// O Phoenix JS acrescenta "/websocket" sozinho.
// Modo proxy (API_BASE vazio): SEMPRE mesma origem — um VITE_WS_URL=ws://localhost:4000 esquecido no .env
// faria o celular tentar conectar no "localhost" dele mesmo.
export const WS_URL = API_BASE
  ? env.VITE_WS_URL || `${API_BASE.replace(/^http/, "ws")}/socket`
  : sameOriginWs();

export const GITHUB_CLIENT_ID = env.VITE_GITHUB_CLIENT_ID || "";

/** Código fixo da sala geral (mural aberto). */
export const GENERAL_ROOM_CODE = "geral";

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function parseIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw) return DEFAULT_ICE;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as RTCIceServer[]) : DEFAULT_ICE;
  } catch {
    return DEFAULT_ICE;
  }
}

export const ICE_SERVERS = parseIceServers(env.VITE_ICE_SERVERS);

/** Máximo de pessoas na mesma chamada (malha P2P). Precisa bater com a API. */
export const MAX_CALL_SIZE = 6;
