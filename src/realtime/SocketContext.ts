import type { Socket } from "phoenix";
import { createContext } from "react";

export type OnlineUser = { id: string; name: string; avatar_url: string | null };

export type Invite = {
  from: OnlineUser;
  room_code: string;
  room_name: string;
};

/** Alguém pediu para entrar numa sala privada (chega só para o admin). */
export type JoinRequestNotice = {
  room_code: string;
  room_name: string;
  user: OnlineUser;
};

export type InviteResult = "sent" | "already_member" | "error";

export type SocketStatus = "connecting" | "online" | "offline";

export type SocketState = {
  socket: Socket | null;
  status: SocketStatus;
  /** quem está online no app agora (presença global) */
  online: OnlineUser[];
  invites: Invite[];
  joinRequests: JoinRequestNotice[];
  clearJoinRequest: (roomCode: string, userId: string) => void;
  sendInvite: (toUserId: string, roomCode: string) => Promise<InviteResult>;
  answerInvite: (invite: Invite, accept: boolean) => void;
};

export const SocketContext = createContext<SocketState | null>(null);
