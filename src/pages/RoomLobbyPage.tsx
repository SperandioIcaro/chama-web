import { Channel, Socket } from "phoenix";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InviteModal } from "../components/InviteModal";
import type { InviteIncoming, LobbyUserId } from "../realtime/lobby";
import { LobbyClient } from "../realtime/lobby";

const WS_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:4000/socket/websocket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/* ============================= */
/* Tipos de signaling            */
/* ============================= */

type SignalOfferPayload = {
  sdp: RTCSessionDescriptionInit;
};

type SignalAnswerPayload = {
  sdp: RTCSessionDescriptionInit;
};

type SignalIcePayload = {
  candidate: RTCIceCandidateInit;
};

type JoinError = {
  reason?: string;
};

/* ============================= */
/* Chat types                     */
/* ============================= */

type ChatMessage = {
  id: string;
  body: string;
  user_id: string;
  user_name: string;
  inserted_at: string;
};

/* ============================= */
/* API / Join gate               */
/* ============================= */

type ApiErrorShape = {
  error?: { message?: string };
  message?: string;
  reason?: string;
};

type JoinOkPayload = {
  message?: string;
  participant?: {
    id: string;
    role: string;
    joined_at: string;
    user_id: string;
  };
  room?: {
    id: string;
    code: string;
    name: string;
    created_by_id: string;
    inserted_at: string;
    is_active: boolean;
  };
};

type JoinGateResult =
  | { kind: "allowed" }
  | { kind: "pending" }
  | { kind: "denied"; message: string; status: number };

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("access_token");
  if (!token) return {};
  const value = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return { Authorization: value };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function pickMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as ApiErrorShape;
  return d.error?.message || d.message || d.reason || fallback;
}

function interpretJoinOkPayload(data: unknown): JoinGateResult {
  if (!data || typeof data !== "object") return { kind: "allowed" };

  const d = data as JoinOkPayload;

  if (d.message === "joined" && d.participant && d.room) {
    return { kind: "allowed" };
  }

  if (d.message === "pending") {
    return { kind: "pending" };
  }

  return { kind: "allowed" };
}

async function requestJoin(roomCode: string): Promise<JoinGateResult> {
  const res = await fetch(`${API_URL}/api/rooms/by-code/${roomCode}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (res.status === 409) return { kind: "allowed" };

  if (!res.ok) {
    const msg = pickMessage(data, `HTTP ${res.status}`);
    return { kind: "denied", message: msg, status: res.status };
  }

  return interpretJoinOkPayload(data);
}

/* ============================= */
/* Anti-StrictMode join dedupe   */
/* ============================= */

type JoinCacheEntry = {
  at: number;
  promise: Promise<JoinGateResult>;
};

const joinCache = new Map<string, JoinCacheEntry>();

function requestJoinDedup(roomCode: string): Promise<JoinGateResult> {
  const now = Date.now();
  const cached = joinCache.get(roomCode);

  if (cached && now - cached.at < 1500) {
    return cached.promise;
  }

  const promise = requestJoin(roomCode);
  joinCache.set(roomCode, { at: now, promise });

  void promise.finally(() => {
    setTimeout(() => {
      const current = joinCache.get(roomCode);
      if (current?.promise === promise) joinCache.delete(roomCode);
    }, 2500);
  });

  return promise;
}

/* ============================= */
/* UI                             */
/* ============================= */

type SideTab = "msgs" | "users";

export default function RoomLobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || "").trim();

  const [status, setStatus] = useState("conectando…");
  const [logs, setLogs] = useState<string[]>([]);
  const [dcState, setDcState] = useState<string>("(sem datachannel)");
  const [pcState, setPcState] = useState<string>("(sem pc)");
  const [channelReady, setChannelReady] = useState(false);

  // Sidebar (chat/users)
  const [sideOpen, setSideOpen] = useState(true);
  const [sideTab, setSideTab] = useState<SideTab>("msgs");

  // Lobby global users
  const [lobbyUsers, setLobbyUsers] = useState<LobbyUserId[]>([]);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");

  // Invite modal
  const [invite, setInvite] = useState<InviteIncoming | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const lobbyRef = useRef<LobbyClient | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  // melhor que nada (depois dá pra puxar do /me)
  const myName = useMemo(() => {
    return localStorage.getItem("user_name") || "anon";
  }, []);

  function log(line: string) {
    setLogs((prev) => [line, ...prev].slice(0, 80));
  }

  const lobbyUsersSorted = useMemo(() => {
    return [...lobbyUsers].sort((a, b) => a.localeCompare(b));
  }, [lobbyUsers]);

  /* ============================= */
  /* Chat actions                  */
  /* ============================= */

  function sendChat(): void {
    const body = chatText.trim();
    if (!body) return;

    if (!channelReady) {
      log("⚠️ canal ainda não está pronto");
      return;
    }

    channelRef.current
      ?.push("chat:new", { body, user_name: myName })
      .receive("ok", () => setChatText(""))
      .receive("error", (e: unknown) =>
        log(`❌ chat erro: ${JSON.stringify(e)}`),
      )
      .receive("timeout", () => log("⏳ chat timeout"));
  }

  /* ============================= */
  /* Helpers (WebRTC)              */
  /* ============================= */

  function bindDC(dc: RTCDataChannel): void {
    setDcState(dc.readyState);

    dc.onopen = () => {
      setDcState(dc.readyState);
      log("✅ datachannel open");
    };

    dc.onclose = () => {
      setDcState(dc.readyState);
      log("🛑 datachannel close");
    };

    dc.onmessage = (e: MessageEvent<string>) => {
      log(`💬 ${e.data}`);
    };
  }

  async function ensurePC(isCaller: boolean): Promise<void> {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setPcState(pc.connectionState);
      log(`🔗 pc state: ${pc.connectionState}`);
    };

    pc.onicecandidate = (ev: RTCPeerConnectionIceEvent) => {
      if (ev.candidate) {
        channelRef.current?.push("signal:ice", {
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.ondatachannel = (ev: RTCDataChannelEvent) => {
      dcRef.current = ev.channel;
      bindDC(ev.channel);
      log("📡 datachannel recebido");
    };

    if (isCaller) {
      const dc = pc.createDataChannel("chat");
      dcRef.current = dc;
      bindDC(dc);
      log("📡 datachannel criado");
    }
  }

  function cleanup(): void {
    try {
      lobbyRef.current?.disconnect();
      channelRef.current?.leave();
      socketRef.current?.disconnect();
      dcRef.current?.close();
      pcRef.current?.close();
    } catch {
      // ignore
    } finally {
      lobbyRef.current = null;
      socketRef.current = null;
      channelRef.current = null;
      pcRef.current = null;
      dcRef.current = null;
      setChannelReady(false);
    }
  }

  /* ============================= */
  /* Lifecycle                      */
  /* ============================= */

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;

    async function boot(): Promise<void> {
      setChannelReady(false);
      setStatus("validando acesso…");
      log("🔎 solicitando entrada (join REST)…");

      const gate = await requestJoinDedup(roomCode);

      if (!isMounted) return;

      if (gate.kind === "pending") {
        setStatus("aguardando aprovação do dono… ⏳");
        log("⏳ entrada pendente: aguardando aprovação");
        return;
      }

      if (gate.kind === "denied") {
        setStatus("não foi possível entrar");
        log(`🚫 entrada negada: ${gate.message} (${gate.status})`);

        if (gate.status === 404 || gate.status === 410) {
          log("👻 sala não encontrada/expirada — voltando");
          navigate("/rooms");
        }
        return;
      }

      setStatus("conectando socket…");
      log("✅ entrada liberada — conectando socket");

      const socket = new Socket(WS_URL, {
        params: () => {
          const token = localStorage.getItem("access_token");
          const cleaned = token?.startsWith("Bearer ") ? token.slice(7) : token;
          return cleaned ? { token: cleaned } : {};
        },
      });

      socketRef.current = socket;

      socket.onOpen(() => {
        setStatus("socket ok ✅");
        log("🧷 socket open");
      });

      socket.onError(() => {
        setStatus("socket erro ❌");
        log("💥 socket error");
      });

      socket.onClose(() => {
        setStatus("socket fechado 🛑");
        log("🧹 socket close");
      });

      socket.connect();

      // 1) Lobby global (para convite)
      const lobby = new LobbyClient(socket, {
        onUsers: (users) => {
          setLobbyUsers(users);
        },
        onInviteIncoming: (inc) => {
          log(`📨 convite recebido para sala ${inc.room_code}`);
          setInvite(inc);
          setSideOpen(true);
          setSideTab("users");
        },
        onInviteAccepted: (info) => {
          log(`✅ convite aceito por ${info.by_user_id.slice(0, 8)}`);
        },
        onInviteDeclined: (info) => {
          log(`🫷 convite recusado por ${info.by_user_id.slice(0, 8)}`);
        },
        onLog: (line) => log(line),
      });

      lobbyRef.current = lobby;
      const lobbyJoin = await lobby.connect();
      if (!lobbyJoin.ok) {
        log(`⚠️ lobby:global falhou: ${lobbyJoin.reason}`);
      }

      // 2) Room channel
      const channel = socket.channel(`room:${roomCode}`, {});
      channelRef.current = channel;

      const joinRef = channel.join();

      joinRef.receive("ok", () => {
        setChannelReady(true);
        setStatus("canal ok ✅");
        log("✅ join room channel ok");

        // ✅ Chat: recebe mensagens
        channel.on("chat:message", (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg].slice(-200));
        });
      });

      joinRef.receive("error", (err: JoinError) => {
        setChannelReady(false);
        setStatus("falha ao entrar no canal");
        log(`❌ join error: ${JSON.stringify(err)}`);
      });

      joinRef.receive("timeout", () => {
        setChannelReady(false);
        setStatus("timeout ao entrar no canal");
        log("⏳ join timeout");
      });

      // signaling handlers (mantidos)
      channel.on("signal:offer", async (payload: SignalOfferPayload) => {
        log("📩 offer recebida");
        await ensurePC(false);

        await pcRef.current?.setRemoteDescription(payload.sdp);

        const answer = await pcRef.current?.createAnswer();
        if (!answer) return;

        await pcRef.current?.setLocalDescription(answer);

        channel.push("signal:answer", {
          sdp: pcRef.current?.localDescription,
        });

        log("📤 answer enviada");
      });

      channel.on("signal:answer", async (payload: SignalAnswerPayload) => {
        log("📩 answer recebida");
        await pcRef.current?.setRemoteDescription(payload.sdp);
      });

      channel.on("signal:ice", async (payload: SignalIcePayload) => {
        try {
          await pcRef.current?.addIceCandidate(payload.candidate);
        } catch {
          log("⚠️ falha ao addIceCandidate");
        }
      });
    }

    void boot();

    return () => {
      isMounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  /* ============================= */
  /* Convite: ações                */
  /* ============================= */

  async function acceptInvite(): Promise<void> {
    if (!invite) return;

    // avisa o A pelo lobby
    lobbyRef.current?.acceptInvite(invite.from_user_id, invite.room_code);

    // entra via REST (idempotente) e navega
    log("✅ aceitando convite: entrando na sala…");
    const gate = await requestJoinDedup(invite.room_code);

    if (gate.kind === "denied") {
      log(`🚫 falha ao entrar: ${gate.message} (${gate.status})`);
      setInvite(null);
      return;
    }

    setInvite(null);
    navigate(`/rooms/${invite.room_code}`);
  }

  function declineInvite(): void {
    if (!invite) return;
    lobbyRef.current?.declineInvite(invite.from_user_id, invite.room_code);
    log("🫷 convite recusado");
    setInvite(null);
  }

  /* ============================= */
  /* Actions (WebRTC test)          */
  /* ============================= */

  async function startCall(): Promise<void> {
    if (!roomCode) return;

    if (!channelReady) {
      log("⚠️ canal ainda não está pronto");
      return;
    }

    log("🎬 iniciando call (caller)");
    await ensurePC(true);

    const offer = await pcRef.current?.createOffer();
    if (!offer) return;

    await pcRef.current?.setLocalDescription(offer);

    channelRef.current?.push("signal:offer", {
      sdp: pcRef.current?.localDescription,
    });

    log("📤 offer enviada");
  }

  function sendPing(): void {
    if (!channelReady) {
      log("⚠️ canal ainda não está pronto");
      return;
    }

    const dc = dcRef.current;

    if (!dc || dc.readyState !== "open") {
      log("⚠️ datachannel não está open");
      return;
    }

    dc.send(`ping ${new Date().toLocaleTimeString()}`);
    log("📨 ping enviado");
  }

  function inviteUser(userId: string): void {
    if (!roomCode) return;
    lobbyRef.current?.invite(userId, roomCode);
    log(`📨 convidando ${userId.slice(0, 8)} para sala ${roomCode}`);
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-xl rounded-2xl border p-4">
          <p className="text-lg font-medium">Código inválido</p>
          <p className="opacity-80 mt-1">
            Parece que você entrou numa sala fantasma. (Sem ectoplasma, só
            “undefined” mesmo.)
          </p>
          <button
            className="mt-4 rounded-xl border px-4 py-2"
            onClick={() => navigate("/rooms")}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <InviteModal
        open={invite !== null}
        fromUserId={invite?.from_user_id ?? ""}
        roomCode={invite?.room_code ?? ""}
        roomName={invite?.room_name}
        onAccept={() => void acceptInvite()}
        onDecline={declineInvite}
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* Sidebar */}
          <div
            className={`rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden ${
              sideOpen ? "" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setSideTab("msgs")}
                  className={`rounded-xl border px-3 py-1 text-sm ${
                    sideTab === "msgs"
                      ? "border-zinc-600"
                      : "border-zinc-800 opacity-70"
                  }`}
                >
                  msgs
                </button>
                <button
                  onClick={() => setSideTab("users")}
                  className={`rounded-xl border px-3 py-1 text-sm ${
                    sideTab === "users"
                      ? "border-zinc-600"
                      : "border-zinc-800 opacity-70"
                  }`}
                >
                  users
                </button>
              </div>

              <button
                onClick={() => setSideOpen((v) => !v)}
                className="rounded-xl border border-zinc-800 px-3 py-1 text-sm opacity-80 hover:bg-zinc-900"
                title="Recolher"
              >
                {sideOpen ? "⟨" : "⟩"}
              </button>
            </div>

            <div className="p-3">
              {sideTab === "msgs" ? (
                <div className="space-y-2">
                  <div className="text-sm opacity-70">Mensagens</div>

                  <div className="max-h-[55vh] overflow-auto space-y-2 text-sm">
                    {messages.length === 0 ? (
                      <div className="opacity-60">
                        Ainda não tem conversa… puxa assunto 😈
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl border border-zinc-800 px-3 py-2"
                        >
                          <div className="flex items-center justify-between text-xs opacity-70">
                            <span className="font-mono">
                              {m.user_name || m.user_id.slice(0, 8)}
                            </span>
                            <span>
                              {new Date(m.inserted_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap">
                            {m.body}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendChat();
                      }}
                      placeholder="Escreve aí…"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                    />
                    <button
                      onClick={sendChat}
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
                      title={channelReady ? "Enviar" : "Canal não pronto"}
                    >
                      Enviar
                    </button>
                  </div>

                  {/* debug discreto */}
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <div className="text-xs opacity-50 mb-1">
                      debug (se der ruim, tá aqui)
                    </div>
                    <div className="max-h-[16vh] overflow-auto space-y-1 text-xs font-mono opacity-70">
                      {logs.length === 0 ? (
                        <div className="opacity-50">Sem logs ainda…</div>
                      ) : (
                        logs.map((l, i) => <div key={i}>{l}</div>)
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm opacity-70">
                    Usuários online (lobby)
                  </div>

                  <div className="max-h-[65vh] overflow-auto space-y-2">
                    {lobbyUsersSorted.length === 0 ? (
                      <div className="text-sm opacity-60">
                        Ninguém online… tá parecendo domingo 7h.
                      </div>
                    ) : (
                      lobbyUsersSorted.map((u) => (
                        <div
                          key={u}
                          className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2"
                        >
                          <span className="font-mono text-xs">
                            {u.slice(0, 10)}
                          </span>
                          <button
                            onClick={() => inviteUser(u)}
                            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-900"
                          >
                            Convidar
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="text-xs opacity-50">
                    *Lista vem do lobby global (não é só da sala).
                  </div>

                  <div className="text-xs opacity-50">
                    Dica bruta: se você abrir dois navegadores com a mesma
                    conta, você vai “parecer” uma pessoa só.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main area */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm opacity-70">Sala</p>
                <h1 className="text-2xl font-semibold font-mono">{roomCode}</h1>
                <p className="mt-1 text-sm opacity-80">Status: {status}</p>
                <p className="mt-1 text-sm opacity-80">
                  PC: {pcState} • DC: {dcState}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSideOpen(true)}
                  className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900"
                >
                  Painel
                </button>

                <button
                  onClick={() => navigate(`/rooms`)}
                  className="rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900"
                >
                  Voltar
                </button>
              </div>
            </div>

            {/* “Área de vídeo” (placeholder por enquanto) */}
            <div className="mt-5 rounded-2xl border border-zinc-800 p-6 text-center">
              <div className="text-sm opacity-70">Área da chamada</div>
              <div className="mt-2 text-lg opacity-80">
                Aqui vai o vídeo — e a glória.
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => void startCall()}
                  disabled={!channelReady}
                  className="rounded-xl border border-zinc-700 px-4 py-2 disabled:opacity-50 hover:bg-zinc-900"
                >
                  Iniciar chamada (chamador)
                </button>

                <button
                  onClick={sendPing}
                  disabled={!channelReady}
                  className="rounded-xl border border-zinc-700 px-4 py-2 disabled:opacity-50 hover:bg-zinc-900"
                >
                  Enviar ping
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs opacity-50">
              Dica: use “users” na lateral pra convidar alguém online.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
