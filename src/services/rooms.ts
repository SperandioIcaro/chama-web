import { api } from "../lib/api";

export type Room = {
  id: string;
  code: string;
  name?: string | null;
  is_active?: boolean;
  created_by_id?: string;
  inserted_at?: string;
  updated_at?: string;
};

export type Participant = {
  id: string;
  user_id: string;
  role: string;
  joined_at?: string;
  inserted_at?: string;
};

type ListRoomsResponse = { rooms: Room[] };
type CreateRoomResponse = { message: string; room: Room };
type ByCodeResponse = { room: Room };

export type JoinRoomResponse = {
  message: string;
  room: Room;
  participant: Participant;
};

export type ParticipantsByCodeResponse = {
  room: { id: string; code: string; name?: string | null };
  participants: Participant[];
};

function roomCodePath(code: string) {
  return encodeURIComponent(code.trim());
}

export async function listRooms(): Promise<Room[]> {
  const res = await api<ListRoomsResponse>("/api/rooms");
  return res.rooms;
}

export async function createRoom(payload: { name: string }): Promise<Room> {
  const res = await api<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ room: payload }),
  });
  return res.room;
}

export async function getRoomByCode(code: string): Promise<Room> {
  const res = await api<ByCodeResponse>(
    `/api/rooms/by-code/${roomCodePath(code)}`,
  );
  return res.room;
}

export async function joinRoomByCode(code: string): Promise<JoinRoomResponse> {
  return api<JoinRoomResponse>(
    `/api/rooms/by-code/${roomCodePath(code)}/join`,
    {
      method: "POST",
    },
  );
}

export async function leaveRoomByCode(
  code: string,
): Promise<{ message: string }> {
  return api<{ message: string }>(
    `/api/rooms/by-code/${roomCodePath(code)}/leave`,
    {
      method: "POST",
    },
  );
}

export async function listParticipantsByCode(
  code: string,
): Promise<ParticipantsByCodeResponse> {
  return api<ParticipantsByCodeResponse>(
    `/api/rooms/by-code/${roomCodePath(code)}/participants`,
  );
}
