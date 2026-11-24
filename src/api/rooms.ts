import { api } from "./client";

export type Room = {
  id: string;
  code: string;
  name: string;
  kind: "general" | "private";
  is_active: boolean;
  created_by_id: string | null;
  inserted_at: string;
  participants_count?: number;
  is_owner?: boolean;
};

export type ChatMessage = {
  id: string;
  body: string;
  inserted_at: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
};

const byCode = (code: string) => `/api/rooms/by-code/${encodeURIComponent(code.trim())}`;

export async function listRooms(): Promise<Room[]> {
  return (await api<{ rooms: Room[] }>("/api/rooms")).rooms;
}

export async function createRoom(payload: { name: string }): Promise<Room> {
  return (await api<{ room: Room }>("/api/rooms", { method: "POST", body: { room: payload } })).room;
}

export function deleteRoom(id: string) {
  return api<{ message: string }>(`/api/rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type JoinStatus = "approved" | "pending" | "invited" | "denied" | "none";

export type JoinRequest = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  requested_at: string;
};

/**
 * Entrar pelo código/link. Em sala privada, quem não é membro nem foi convidado fica
 * `pending` até o admin liberar. Idempotente (não reenvia o pedido se já está esperando).
 */
export function joinRoom(code: string) {
  return api<{ room: Room; status: JoinStatus }>(`${byCode(code)}/join`, { method: "POST" });
}

/** Situação atual do meu acesso (usado para esperar a aprovação do admin). */
export async function getAccess(code: string): Promise<JoinStatus> {
  return (await api<{ status: JoinStatus }>(`${byCode(code)}/access`)).status;
}

/** Pedidos de entrada pendentes (só o admin). */
export async function listRequests(code: string): Promise<JoinRequest[]> {
  return (await api<{ requests: JoinRequest[] }>(`${byCode(code)}/requests`)).requests;
}

export function approveRequest(code: string, userId: string) {
  return api<{ message: string }>(`${byCode(code)}/requests/${encodeURIComponent(userId)}/approve`, {
    method: "POST",
  });
}

export function denyRequest(code: string, userId: string) {
  return api<{ message: string }>(`${byCode(code)}/requests/${encodeURIComponent(userId)}/deny`, {
    method: "POST",
  });
}

export function leaveRoom(code: string) {
  return api<{ message: string }>(`${byCode(code)}/leave`, { method: "POST" });
}

export async function listMessages(code: string, limit = 50): Promise<ChatMessage[]> {
  return (await api<{ messages: ChatMessage[] }>(`${byCode(code)}/messages?limit=${limit}`)).messages;
}

/** Aceita o código puro ou o link de convite completo (…/rooms/<código>). */
export function extractRoomCode(input: string): string {
  const value = input.trim();
  const match = value.match(/\/rooms\/([^/?#\s]+)/);
  return decodeURIComponent(match?.[1] ?? value);
}

export function inviteLink(code: string) {
  return `${window.location.origin}/rooms/${encodeURIComponent(code)}`;
}
