import { Presence, Socket, type Channel } from "phoenix";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getToken } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { WS_URL } from "../config";
import {
  SocketContext,
  type Invite,
  type InviteResult,
  type JoinRequestNotice,
  type OnlineUser,
  type SocketState,
  type SocketStatus,
} from "./SocketContext";
import { pushAsync } from "./pushAsync";

type LobbyMeta = { name: string; avatar_url: string | null };

/**
 * UMA conexão WebSocket para o app inteiro (antes cada tela abria a sua).
 * Também mantém a presença global e recebe os convites (canal `user:<id>`).
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const userId = user?.id;

  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestNotice[]>([]);
  const lobbyRef = useRef<Channel | null>(null);

  // O objeto Socket nasce junto com o token; só conecta no efeito abaixo.
  const socket = useMemo(
    () => (token ? new Socket(WS_URL, { params: () => ({ token: getToken() ?? "" }) }) : null),
    [token],
  );

  useEffect(() => {
    if (!socket) return;

    socket.onOpen(() => setStatus("online"));
    socket.onClose(() => setStatus("offline"));
    socket.onError((error: unknown) => {
      console.warn("[chama] erro no WebSocket", error);
      setStatus("offline");
    });
    socket.connect();

    // Celular: ao voltar para a aba/rede, reconecta na hora (o timer do navegador congela em segundo plano).
    const wake = () => {
      if (document.visibilityState === "visible" && !socket.isConnected()) socket.connect();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);

    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !userId) return;

    const lobby = socket.channel("lobby:global", {});
    const mine = socket.channel(`user:${userId}`, {});
    lobbyRef.current = lobby;

    const presence = new Presence(lobby);
    presence.onSync(() => {
      setOnline(
        presence.list<OnlineUser>((id, entry: { metas: LobbyMeta[] }) => ({
          id,
          name: entry.metas[0]?.name ?? "Alguém",
          avatar_url: entry.metas[0]?.avatar_url ?? null,
        })),
      );
    });

    mine.on("invite:incoming", (payload: Invite) => {
      setInvites((prev) =>
        prev.some((i) => i.room_code === payload.room_code && i.from.id === payload.from.id)
          ? prev
          : [...prev, payload],
      );
    });
    mine.on("join:request", (payload: JoinRequestNotice) => {
      setJoinRequests((prev) =>
        prev.some((r) => r.room_code === payload.room_code && r.user.id === payload.user.id)
          ? prev
          : [...prev, payload],
      );
    });
    mine.on("invite:accepted", (p: { from: OnlineUser }) => {
      toast.success(`${p.from.name} aceitou seu convite`);
    });
    mine.on("invite:declined", (p: { from: OnlineUser }) => {
      toast(`${p.from.name} recusou o convite`);
    });

    lobby.join();
    mine.join();

    return () => {
      lobbyRef.current = null;
      lobby.leave();
      mine.leave();
      setOnline([]);
      setInvites([]);
      setJoinRequests([]);
    };
  }, [socket, userId]);

  const sendInvite = useCallback(async (toUserId: string, roomCode: string): Promise<InviteResult> => {
    const lobby = lobbyRef.current;
    if (!lobby) return "error";
    try {
      await pushAsync(lobby, "invite:send", { to: toUserId, room_code: roomCode });
      return "sent";
    } catch (e) {
      return e instanceof Error && e.message === "already_member" ? "already_member" : "error";
    }
  }, []);

  const clearJoinRequest = useCallback((roomCode: string, userId: string) => {
    setJoinRequests((prev) => prev.filter((r) => !(r.room_code === roomCode && r.user.id === userId)));
  }, []);

  const answerInvite = useCallback((invite: Invite, accept: boolean) => {
    const lobby = lobbyRef.current;
    lobby?.push(accept ? "invite:accept" : "invite:decline", {
      to: invite.from.id,
      room_code: invite.room_code,
    });
    setInvites((prev) => prev.filter((i) => i !== invite));
  }, []);

  const value = useMemo<SocketState>(
    () => ({
      socket,
      status: socket ? status : "offline",
      online,
      invites,
      joinRequests,
      clearJoinRequest,
      sendInvite,
      answerInvite,
    }),
    [socket, status, online, invites, joinRequests, clearJoinRequest, sendInvite, answerInvite],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
