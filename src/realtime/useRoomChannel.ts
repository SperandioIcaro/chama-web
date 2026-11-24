import { Presence, type Channel } from "phoenix";
import { useEffect, useState } from "react";
import { useSocket } from "./useSocket";

export type RoomPresence = {
  id: string;
  name: string;
  avatar_url: string | null;
  in_call: boolean;
  mic: boolean;
  cam: boolean;
  /** está apresentando a tela */
  sharing: boolean;
  /** id do MediaStream da apresentação (para separar da câmera no receptor) */
  screen_stream_id: string | null;
};

export type JoinState = "joining" | "joined" | "error";

type Meta = {
  name: string;
  avatar_url: string | null;
  in_call?: boolean;
  mic?: boolean;
  cam?: boolean;
  sharing?: boolean;
  screen_stream_id?: string | null;
};

function joinErrorMessage(reason: string | undefined) {
  switch (reason) {
    case "not_participant":
      return "Você não faz parte desta sala.";
    case "room_not_found":
      return "Sala não encontrada.";
    case "room_inactive":
      return "Esta sala foi desativada.";
    default:
      return "Não consegui entrar no canal da sala.";
  }
}

/** Entra no canal `room:<code>` e acompanha quem está na sala (presença). */
export function useRoomChannel(code: string | null) {
  const { socket } = useSocket();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [joinState, setJoinState] = useState<JoinState>("joining");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [users, setUsers] = useState<RoomPresence[]>([]);

  useEffect(() => {
    if (!socket || !code) return;

    // Um canal só pode dar `join` uma vez; por isso é criado aqui dentro.
    const ch = socket.channel(`room:${code}`, {});

    const presence = new Presence(ch);
    presence.onSync(() => {
      setUsers(
        presence.list<RoomPresence>((id, entry: { metas: Meta[] }) => ({
          id,
          name: entry.metas[0]?.name ?? "Alguém",
          avatar_url: entry.metas[0]?.avatar_url ?? null,
          in_call: entry.metas.some((m) => m.in_call === true),
          mic: entry.metas.every((m) => m.mic !== false),
          cam: entry.metas.every((m) => m.cam !== false),
          sharing: entry.metas.some((m) => m.sharing === true),
          screen_stream_id: entry.metas.find((m) => m.screen_stream_id)?.screen_stream_id ?? null,
        })),
      );
    });

    ch.join()
      .receive("ok", () => {
        setJoinState("joined");
        setJoinError(null);
      })
      .receive("error", (err: { reason?: string }) => {
        setJoinState("error");
        setJoinError(joinErrorMessage(err?.reason));
      })
      .receive("timeout", () => {
        setJoinState("error");
        setJoinError("Tempo esgotado ao entrar na sala.");
      });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannel(ch);

    return () => {
      ch.leave();
      setChannel(null);
      setUsers([]);
      setJoinState("joining");
      setJoinError(null);
    };
  }, [socket, code]);

  return { channel, joinState, joinError, users };
}
