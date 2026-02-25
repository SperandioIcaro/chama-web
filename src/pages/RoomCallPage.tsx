import { Channel, Socket } from "phoenix";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const WS_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:4000/socket/websocket";

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

export default function RoomCallPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || "").trim();

  const [status, setStatus] = useState("conectando…");
  const [logs, setLogs] = useState<string[]>([]);
  const [dcState, setDcState] = useState<string>("(sem datachannel)");
  const [pcState, setPcState] = useState<string>("(sem pc)");

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  function log(line: string) {
    setLogs((prev) => [line, ...prev].slice(0, 50));
  }

  /* ============================= */
  /* Helpers (declara antes)       */
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

  /* ============================= */
  /* Lifecycle                     */
  /* ============================= */

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

    // status via callbacks do sistema externo
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

    const channel = socket.channel(`room:${roomCode}`, {});
    channelRef.current = channel;

    const joinRef = channel.join();

    joinRef.receive("ok", () => {
      setStatus("canal ok ✅");
      log("✅ join channel ok");
    });

    joinRef.receive("error", (err: JoinError) => {
      setStatus("falha ao entrar no canal");
      log(`❌ join error: ${JSON.stringify(err)}`);
    });

    // signaling handlers
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

    return () => {
      try {
        dcRef.current?.close();
        pcRef.current?.close();
        channel.leave();
        socket.disconnect();
      } catch {
        // ignore
      } finally {
        socketRef.current = null;
        channelRef.current = null;
        pcRef.current = null;
        dcRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  /* ============================= */
  /* Actions                       */
  /* ============================= */

  async function startCall(): Promise<void> {
    if (!roomCode) return;

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
    const dc = dcRef.current;

    if (!dc || dc.readyState !== "open") {
      log("⚠️ datachannel não está open");
      return;
    }

    dc.send(`ping ${new Date().toLocaleTimeString()}`);
    log("📨 ping enviado");
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
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm opacity-70">Sala</p>
              <h1 className="text-2xl font-semibold font-mono">{roomCode}</h1>
              <p className="mt-1 text-sm opacity-80">Status: {status}</p>
              <p className="mt-1 text-sm opacity-80">
                PC: {pcState} • DC: {dcState}
              </p>
            </div>

            <button
              onClick={() => navigate(`/rooms/${roomCode}`)}
              className="rounded-xl border px-4 py-2"
            >
              Voltar
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={startCall} className="rounded-xl border px-4 py-2">
              Start call (caller)
            </button>

            <button onClick={sendPing} className="rounded-xl border px-4 py-2">
              Send ping
            </button>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <p className="font-medium mb-2">Logs</p>

          <div className="space-y-1 text-sm font-mono opacity-90">
            {logs.length === 0 ? (
              <p className="opacity-60">Sem logs ainda…</p>
            ) : (
              logs.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
