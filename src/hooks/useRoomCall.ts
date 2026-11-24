import type { Channel } from "phoenix";
import { useCallback, useEffect, useRef, useState } from "react";
import { ICE_SERVERS, MAX_CALL_SIZE } from "../config";
import { pushAsync } from "../realtime/pushAsync";
import type { RoomPresence } from "../realtime/useRoomChannel";

export type CallStatus = "idle" | "joining" | "in-call";
/** idle → requesting (esperando o admin) → granted (clique para escolher a tela) → starting → sharing */
export type ShareState = "idle" | "requesting" | "granted" | "starting" | "sharing";

export type RemotePeer = {
  /** câmera + (se estiver apresentando) a tela; quem é quem vem da presença (`screen_stream_id`) */
  streams: MediaStream[];
  connection: RTCPeerConnectionState;
};

export type ShareRequest = { user_id: string; name: string };

type Signal<T> = { from: string; to: string; payload: T };
type SdpPayload = { sdp: RTCSessionDescriptionInit };
type IcePayload = { candidate: RTCIceCandidateInit };

type PeerCtx = {
  pc: RTCPeerConnection;
  /** quem tem o id "menor" cede em caso de colisão de ofertas (negociação perfeita) */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  screenSenders: RTCRtpSender[];
};

function describeError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
        return "Permissão de câmera/microfone negada. Libere no navegador e tente de novo.";
      case "NotFoundError":
        return "Não encontrei câmera nem microfone neste dispositivo.";
      case "NotReadableError":
        return "Câmera ou microfone está em uso por outro aplicativo.";
    }
  }
  const message = e instanceof Error ? e.message : "";
  switch (message) {
    case "insecure_context":
      return "A câmera só funciona em HTTPS. Abra o app por https:// (no PC: npm run dev:lan).";
    case "call_full":
      return `A chamada está cheia (máximo de ${MAX_CALL_SIZE} pessoas).`;
    case "no_calls_in_general":
      return "A sala geral não tem chamadas.";
    case "timeout":
      return "O servidor demorou para responder. Tente de novo.";
    default:
      return "Não consegui entrar na chamada. Tente de novo.";
  }
}

function describeShareError(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  switch (message) {
    case "someone_sharing":
      return "Alguém já está apresentando. Espere a pessoa terminar.";
    case "admin_not_in_room":
      return "O admin não está na sala agora, então ninguém pode liberar a apresentação.";
    case "not_in_call":
      return "Entre na chamada para apresentar.";
    case "not_allowed":
      return "Você precisa da permissão do admin para apresentar.";
    case "no_calls_in_general":
      return "A sala geral não tem apresentação de tela.";
    default:
      return "Não consegui iniciar a apresentação. Tente de novo.";
  }
}

async function getMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("insecure_context");

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
    });
  } catch (e) {
    // sem câmera (ou restrição impossível): entra só com áudio
    if (e instanceof DOMException && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    throw e;
  }
}

export const canShareScreen = () =>
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

/**
 * Chamada em malha (mesh) P2P com "negociação perfeita": qualquer lado pode renegociar
 * (é assim que a tela entra como segunda trilha de vídeo, sem derrubar a chamada).
 * Todo sinal vai com `to`, e a API entrega apenas ao destinatário.
 */
export function useRoomCall(
  channel: Channel | null,
  users: RoomPresence[],
  me: { id: string; isOwner: boolean },
) {
  const { id: myId } = me;

  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [shareError, setShareError] = useState<{ message: string; id: number } | null>(null);
  const [shareRequests, setShareRequests] = useState<ShareRequest[]>([]);

  const ctxs = useRef(new Map<string, PeerCtx>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const seenInCall = useRef(new Set<string>());
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const grantRef = useRef<string | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const errorCounter = useRef(0);
  const stopShareRef = useRef<() => void>(() => {});

  const setCallStatus = useCallback((next: CallStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const reportShareError = useCallback((message: string) => {
    errorCounter.current += 1;
    setShareError({ message, id: errorCounter.current });
  }, []);

  const closePeer = useCallback((peerId: string) => {
    ctxs.current.get(peerId)?.pc.close();
    ctxs.current.delete(peerId);
    pendingIce.current.delete(peerId);
    seenInCall.current.delete(peerId);
    setPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const teardown = useCallback(() => {
    ctxs.current.forEach((ctx) => ctx.pc.close());
    ctxs.current.clear();
    pendingIce.current.clear();
    seenInCall.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    screenRef.current = null;
    grantRef.current = null;
    setLocalStream(null);
    setPeers({});
    setShareState("idle");
    setShareRequests([]);
    setCallStatus("idle");
  }, [setCallStatus]);

  const createPeer = useCallback(
    (peerId: string): PeerCtx => {
      const existing = ctxs.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const ctx: PeerCtx = {
        pc,
        polite: myId < peerId,
        makingOffer: false,
        ignoreOffer: false,
        screenSenders: [],
      };
      ctxs.current.set(peerId, ctx);
      setPeers((prev) => ({ ...prev, [peerId]: prev[peerId] ?? { streams: [], connection: "new" } }));

      pc.onicecandidate = (ev) => {
        if (ev.candidate) channel?.push("signal:ice", { to: peerId, candidate: ev.candidate.toJSON() });
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        if (!stream) return;
        setPeers((prev) => {
          const cur = prev[peerId] ?? { streams: [], connection: "new" as RTCPeerConnectionState };
          if (cur.streams.some((s) => s.id === stream.id)) return prev;
          return { ...prev, [peerId]: { ...cur, streams: [...cur.streams, stream] } };
        });
        // quando a pessoa para de apresentar, a trilha some e o stream sai da lista
        stream.onremovetrack = () => {
          if (stream.getTracks().length > 0) return;
          setPeers((prev) => {
            const cur = prev[peerId];
            if (!cur) return prev;
            return { ...prev, [peerId]: { ...cur, streams: cur.streams.filter((s) => s.id !== stream.id) } };
          });
        };
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "closed") {
          if (ctxs.current.get(peerId)?.pc === pc) closePeer(peerId);
          return;
        }
        if (state === "failed") pc.restartIce(); // dispara uma nova negociação com ICE novo
        setPeers((prev) =>
          prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], connection: state } } : prev,
        );
      };

      // Qualquer mudança de trilhas (entrar, tela ligada/desligada, restart de ICE) cai aqui.
      pc.onnegotiationneeded = async () => {
        try {
          ctx.makingOffer = true;
          await pc.setLocalDescription();
          channel?.push("signal:offer", { to: peerId, sdp: pc.localDescription });
        } catch {
          // a próxima mudança tenta de novo
        } finally {
          ctx.makingOffer = false;
        }
      };

      // As trilhas entram DEPOIS dos handlers (addTrack dispara negotiationneeded).
      const local = localRef.current;
      if (local) local.getTracks().forEach((track) => pc.addTrack(track, local));
      const screen = screenRef.current;
      if (screen) screen.getTracks().forEach((track) => ctx.screenSenders.push(pc.addTrack(track, screen)));

      return ctx;
    },
    [channel, myId, closePeer],
  );

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(peerId) ?? [];
    pendingIce.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // candidato atrasado/duplicado: ignora
      }
    }
  }, []);

  // ───────── sinais vindos dos outros participantes ─────────
  useEffect(() => {
    if (!channel) return;

    const offerRef = channel.on("signal:offer", async (msg: Signal<SdpPayload>) => {
      if (!localRef.current) return; // não estou na chamada
      const ctx = createPeer(msg.from);
      const { pc } = ctx;
      try {
        const collision = ctx.makingOffer || pc.signalingState !== "stable";
        ctx.ignoreOffer = !ctx.polite && collision;
        if (ctx.ignoreOffer) return;

        await pc.setRemoteDescription(msg.payload.sdp); // se for educado, faz rollback sozinho
        await flushIce(msg.from, pc);
        await pc.setLocalDescription();
        channel.push("signal:answer", { to: msg.from, sdp: pc.localDescription });
      } catch {
        // oferta inválida/atrasada: ignora
      }
    });

    const answerRef = channel.on("signal:answer", async (msg: Signal<SdpPayload>) => {
      const ctx = ctxs.current.get(msg.from);
      if (!ctx || ctx.pc.signalingState !== "have-local-offer") return;
      try {
        await ctx.pc.setRemoteDescription(msg.payload.sdp);
        await flushIce(msg.from, ctx.pc);
      } catch {
        // ignora
      }
    });

    const iceRef = channel.on("signal:ice", async (msg: Signal<IcePayload>) => {
      const ctx = ctxs.current.get(msg.from);
      if (!ctx || !ctx.pc.remoteDescription) {
        // candidato chegou antes da oferta/resposta: guarda para depois
        const list = pendingIce.current.get(msg.from) ?? [];
        list.push(msg.payload.candidate);
        pendingIce.current.set(msg.from, list);
        return;
      }
      try {
        await ctx.pc.addIceCandidate(msg.payload.candidate);
      } catch {
        // se a oferta foi ignorada, os candidatos dela também falham: tudo bem
      }
    });

    return () => {
      channel.off("signal:offer", offerRef);
      channel.off("signal:answer", answerRef);
      channel.off("signal:ice", iceRef);
    };
  }, [channel, createPeer, flushIce]);

  // ───────── eventos da apresentação de tela ─────────
  useEffect(() => {
    if (!channel) return;

    const granted = channel.on("share:granted", (msg: { token: string }) => {
      grantRef.current = msg.token;
      setShareState((prev) => (prev === "requesting" ? "granted" : prev));
    });
    const denied = channel.on("share:denied", () => {
      grantRef.current = null;
      setShareState((prev) => (prev === "requesting" ? "idle" : prev));
      reportShareError("O admin não permitiu a apresentação.");
    });
    const revoked = channel.on("share:revoked", () => {
      stopShareRef.current();
      reportShareError("O admin encerrou sua apresentação.");
    });
    const requested = channel.on("share:requested", (msg: { from: string; name: string }) => {
      setShareRequests((prev) =>
        prev.some((r) => r.user_id === msg.from) ? prev : [...prev, { user_id: msg.from, name: msg.name }],
      );
    });

    return () => {
      channel.off("share:granted", granted);
      channel.off("share:denied", denied);
      channel.off("share:revoked", revoked);
      channel.off("share:requested", requested);
    };
  }, [channel, reportShareError]);

  // ───────── quem saiu da chamada (ou da sala) tem a conexão encerrada ─────────
  useEffect(() => {
    if (statusRef.current === "idle") return;

    const inCallNow = new Set<string>();
    for (const u of users) {
      if (u.in_call) {
        inCallNow.add(u.id);
        seenInCall.current.add(u.id);
      }
    }

    ctxs.current.forEach((_ctx, id) => {
      // só encerra quem já foi visto na chamada (evita cortar quem acabou de entrar)
      if (seenInCall.current.has(id) && !inCallNow.has(id)) closePeer(id);
    });
  }, [users, closePeer]);

  const announceMedia = useCallback(() => {
    const stream = localRef.current;
    if (!stream) return;
    channel?.push("call:media", {
      mic: stream.getAudioTracks()[0]?.enabled ?? false,
      cam: stream.getVideoTracks()[0]?.enabled ?? false,
    });
  }, [channel]);

  const join = useCallback(async () => {
    if (!channel || statusRef.current !== "idle") return;
    setError(null);
    setCallStatus("joining");

    try {
      const stream = await getMedia();
      localRef.current = stream;
      setLocalStream(stream);
      setMicOn(stream.getAudioTracks().length > 0);
      setCamOn(stream.getVideoTracks().length > 0);

      const { peers: existing } = await pushAsync<{ peers: string[] }>(channel, "call:join");

      // criar a conexão já adiciona as trilhas e dispara a oferta (negotiationneeded)
      for (const peerId of existing) createPeer(peerId);

      setCallStatus("in-call");
      announceMedia();
    } catch (e) {
      teardown();
      setError(describeError(e));
    }
  }, [channel, createPeer, announceMedia, teardown, setCallStatus]);

  const leave = useCallback(() => {
    if (statusRef.current !== "idle") channel?.push("call:leave", {});
    teardown();
  }, [channel, teardown]);

  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    announceMedia();
  }, [announceMedia]);

  const toggleCam = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
    announceMedia();
  }, [announceMedia]);

  // ───────── apresentar a tela ─────────

  /** Passo 1 (quem não é admin): pede permissão. O admin recebe um aviso para permitir ou negar. */
  const requestShare = useCallback(async () => {
    if (!channel || statusRef.current !== "in-call") return;
    try {
      const reply = await pushAsync<{ granted?: boolean }>(channel, "share:request");
      setShareState(reply.granted ? "granted" : "requesting");
    } catch (e) {
      reportShareError(describeShareError(e));
    }
  }, [channel, reportShareError]);

  const stopShare = useCallback(() => {
    const stream = screenRef.current;
    if (stream) {
      ctxs.current.forEach((ctx) => {
        for (const sender of ctx.screenSenders) {
          try {
            ctx.pc.removeTrack(sender); // dispara a renegociação que remove a tela dos outros
          } catch {
            // conexão já fechada
          }
        }
        ctx.screenSenders = [];
      });
      stream.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      channel?.push("share:stop", {});
    }
    grantRef.current = null; // cada apresentação precisa de uma permissão nova
    setShareState("idle");
  }, [channel]);

  useEffect(() => {
    stopShareRef.current = stopShare;
  }, [stopShare]);

  /** Passo 2: escolher a tela. Precisa ser chamado por um clique (exigência do navegador). */
  const startShare = useCallback(async () => {
    if (!channel || statusRef.current !== "in-call" || screenRef.current) return;
    if (!canShareScreen()) {
      reportShareError("Este navegador não permite compartilhar a tela.");
      return;
    }

    setShareState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
    } catch {
      // fechou o seletor: volta ao estado anterior (quem é admin não tem token)
      setShareState(me.isOwner ? "idle" : "granted");
      return;
    }

    try {
      await pushAsync(channel, "share:start", { stream_id: stream.id, token: grantRef.current });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      grantRef.current = null;
      setShareState("idle");
      reportShareError(describeShareError(e));
      return;
    }

    screenRef.current = stream;
    stream.getVideoTracks()[0]?.addEventListener("ended", () => stopShareRef.current());
    ctxs.current.forEach((ctx) => {
      stream.getTracks().forEach((track) => ctx.screenSenders.push(ctx.pc.addTrack(track, stream)));
    });
    setShareState("sharing");
  }, [channel, me.isOwner, reportShareError]);

  // ───────── admin ─────────
  const decideShare = useCallback(
    (event: "share:approve" | "share:deny" | "share:revoke", userId: string) => {
      channel?.push(event, { user_id: userId });
      setShareRequests((prev) => prev.filter((r) => r.user_id !== userId));
    },
    [channel],
  );

  const approveShare = useCallback((userId: string) => decideShare("share:approve", userId), [decideShare]);
  const denyShare = useCallback((userId: string) => decideShare("share:deny", userId), [decideShare]);
  const revokeShare = useCallback((userId: string) => decideShare("share:revoke", userId), [decideShare]);

  // Ao sair da tela, sai da chamada e solta câmera/microfone/tela.
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);
  useEffect(() => () => leaveRef.current(), []);

  return {
    status,
    error,
    localStream,
    peers,
    micOn,
    camOn,
    hasVideo: (localStream?.getVideoTracks().length ?? 0) > 0,
    join,
    leave,
    toggleMic,
    toggleCam,
    shareState,
    shareError,
    shareRequests,
    requestShare,
    startShare,
    stopShare,
    approveShare,
    denyShare,
    revokeShare,
  };
}
