// src/pages/RoomLobbyPage.tsx
import { Channel, Socket } from "phoenix";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { ChatMessage } from "../types/chat";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000/socket";

type SignalOfferPayload = { sdp: RTCSessionDescriptionInit };
type SignalAnswerPayload = { sdp: RTCSessionDescriptionInit };
type SignalIcePayload = { candidate: RTCIceCandidateInit };
type JoinError = { reason?: string };

export default function RoomLobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || "").trim();

  const { user } = useAuth();
  const myName = user?.name || "Você";
  // se seu user tiver id, ótimo — se não tiver, a gente compara pelo nome mesmo no UI.
  const myId = (user && "id" in user ? user.id : undefined) as
    | string
    | undefined;

  const [status, setStatus] = useState("conectando…");
  const [joined, setJoined] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  // Call
  const [inCall, setInCall] = useState(false);
  const [pcState, setPcState] = useState<string>("(sem pc)");

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      if (!chatScrollRef.current) return;
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    });
  }

  async function ensureMedia(): Promise<MediaStream> {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  async function ensurePC(): Promise<RTCPeerConnection> {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setPcState(pc.connectionState);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        channelRef.current?.push("signal:ice", {
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (ev) => {
      // remoto
      if (remoteVideoRef.current) {
        const [stream] = ev.streams;
        remoteVideoRef.current.srcObject = stream;
      }
    };

    return pc;
  }

  // Boot: socket + channel + handlers
  useEffect(() => {
    if (!roomCode) return;

    const socket = new Socket(WS_URL, {
      params: () => {
        const token = localStorage.getItem("access_token");
        const cleaned = token?.startsWith("Bearer ") ? token.slice(7) : token;
        return cleaned ? { token: cleaned } : {};
      },
    });

    socketRef.current = socket;

    socket.onOpen(() => setStatus("socket ok ✅"));
    socket.onError(() => setStatus("socket erro ❌"));
    socket.onClose(() => setStatus("socket fechado 🛑"));

    socket.connect();

    const channel = socket.channel(`room:${roomCode}`, {});
    channelRef.current = channel;

    const joinRef = channel.join();

    joinRef.receive("ok", () => {
      setStatus("canal ok ✅");
      setJoined(true);
    });

    joinRef.receive("error", (err: JoinError) => {
      setStatus("falha ao entrar no canal");
      setJoined(false);
      console.error("join error", err);
    });

    // Chat incoming
    channel.on("chat:message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      scrollChatToBottom();
    });

    // Signaling
    channel.on("signal:offer", async (payload: SignalOfferPayload) => {
      // quem recebe offer: entra em call automaticamente
      setInCall(true);

      const pc = await ensurePC();
      const stream = await ensureMedia();

      // garante tracks no PC (somente uma vez)
      const senders = pc.getSenders();
      const hasAnyTrack = senders.some((s) => !!s.track);
      if (!hasAnyTrack) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      await pc.setRemoteDescription(payload.sdp);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channel.push("signal:answer", { sdp: pc.localDescription });
    });

    channel.on("signal:answer", async (payload: SignalAnswerPayload) => {
      await pcRef.current?.setRemoteDescription(payload.sdp);
    });

    channel.on("signal:ice", async (payload: SignalIcePayload) => {
      try {
        await pcRef.current?.addIceCandidate(payload.candidate);
      } catch (e) {
        console.warn("addIceCandidate fail", e);
      }
    });

    return () => {
      try {
        // mídia
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;

        // pc
        pcRef.current?.close();
        pcRef.current = null;

        // channel/socket
        channel.leave();
        socket.disconnect();
      } catch {
        // ignore
      } finally {
        channelRef.current = null;
        socketRef.current = null;
        setJoined(false);
        setInCall(false);
      }
    };
  }, [roomCode]);

  async function onSend() {
    if (!joined) return;

    const body = text.trim();
    if (!body) return;

    channelRef.current
      ?.push("chat:new", { body, user_name: myName }, 10_000)
      .receive("ok", () => setText(""))
      .receive("error", (e) => console.error("chat error", e));
  }

  async function startCall() {
    if (!joined) return;
    setInCall(true);

    const pc = await ensurePC();
    const stream = await ensureMedia();

    // adiciona tracks se não tiver
    const senders = pc.getSenders();
    const hasAnyTrack = senders.some((s) => !!s.track);
    if (!hasAnyTrack) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current?.push("signal:offer", { sdp: pc.localDescription });
  }

  function leaveCall() {
    // encerra call local, mas mantém chat
    try {
      channelRef.current?.push("signal:hangup", {});
    } catch {
      // ignore
    }

    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;
    setPcState("(sem pc)");

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    localStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setInCall(false);
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-zinc-800 p-4">
          <p className="text-lg font-medium">Código inválido</p>
          <button
            className="mt-4 rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
            onClick={() => navigate("/rooms")}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const titleStatus = joined ? "✅ Sala pronta" : "⏳ Conectando…";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl p-4 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">Sala</div>
              <div className="text-2xl font-semibold tracking-tight font-mono">
                {roomCode}
              </div>
              <div className="mt-2 text-sm text-zinc-300">
                {titleStatus} • {status}
              </div>
              <div className="mt-1 text-xs text-zinc-500">PC: {pcState}</div>
            </div>

            <div className="flex items-center gap-2">
              {!inCall ? (
                <button
                  onClick={startCall}
                  disabled={!joined}
                  className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
                >
                  Entrar na chamada
                </button>
              ) : (
                <button
                  onClick={leaveCall}
                  className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
                >
                  Sair da chamada
                </button>
              )}

              <button
                onClick={() => navigate("/rooms")}
                className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>

        {/* Grid: Chat + Vídeo */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Chat */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="border-b border-zinc-800 p-3 font-semibold">
              Chat
            </div>

            <div
              ref={chatScrollRef}
              className="h-96 overflow-y-auto p-3 space-y-2"
            >
              {messages.length === 0 ? (
                <div className="text-zinc-500 text-sm">
                  Sem mensagem ainda. Alguém precisa abrir o baile.
                </div>
              ) : (
                messages.map((m) => {
                  const isMe =
                    (myId && m.user_id === myId) || m.user_name === myName;

                  const displayName = isMe ? "Você" : m.user_name || m.user_id;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 ${
                        isMe
                          ? "border-emerald-700/40 bg-emerald-500/5"
                          : "border-zinc-800"
                      }`}
                    >
                      <div className="text-xs text-zinc-400">
                        {displayName} •{" "}
                        {new Date(m.inserted_at).toLocaleTimeString()}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-800 p-3 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSend();
                }}
                className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                placeholder={joined ? "Digite sua mensagem…" : "Conectando…"}
                disabled={!joined}
              />
              <button
                onClick={onSend}
                disabled={!joined || !text.trim()}
                className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>

          {/* Call */}
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="border-b border-zinc-800 p-3 font-semibold">
              Chamada
            </div>

            {!inCall ? (
              <div className="p-4 text-sm text-zinc-400">
                Chat já tá vivo. Vídeo só quando você mandar — do jeito que uma
                sala decente deveria ser.
              </div>
            ) : (
              <div className="p-3 space-y-3">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-xl border border-zinc-800"
                />
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-xl border border-zinc-800"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
