import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus, Video, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../api/client";
import { getErrorMessage } from "../api/error";
import { approveRequest, denyRequest, listRequests } from "../api/rooms";
import type { RoomPresence } from "../realtime/useRoomChannel";
import { useSocket } from "../realtime/useSocket";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

type Props = {
  roomCode: string;
  myId: string;
  inRoom: RoomPresence[];
  /** id de quem criou a sala (o admin) */
  ownerId: string | null;
  onInvite: () => void;
};

export function PeoplePanel({ roomCode, myId, inRoom, ownerId, onInvite }: Props) {
  const qc = useQueryClient();
  const { clearJoinRequest } = useSocket();
  const isOwner = ownerId === myId;

  // Só o admin vê (e recebe) os pedidos de entrada.
  const requests = useQuery({
    queryKey: ["room-requests", roomCode],
    queryFn: () => listRequests(roomCode),
    enabled: isOwner,
    refetchInterval: 5000,
  });

  const resolve = useMutation({
    mutationFn: ({ userId, allow }: { userId: string; allow: boolean; name: string }) =>
      allow ? approveRequest(roomCode, userId) : denyRequest(roomCode, userId),
    onSuccess: (_data, vars) => {
      toast.success(vars.allow ? `${vars.name} pode entrar` : `Pedido de ${vars.name} negado`);
    },
    onError: (e) => {
      if (!(e instanceof ApiError && e.status === 404)) toast.error(getErrorMessage(e));
    },
    onSettled: (_data, _err, vars) => {
      clearJoinRequest(roomCode, vars.userId);
      void qc.invalidateQueries({ queryKey: ["room-requests", roomCode] });
    },
  });

  const pendingList = requests.data ?? [];

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      <Button size="sm" className="w-full" icon={<UserPlus className="h-4 w-4" />} onClick={onInvite}>
        Convidar pessoas
      </Button>

      {isOwner && pendingList.length > 0 && (
        <section aria-label="Pedidos para entrar">
          <h3 className="text-xs font-bold uppercase tracking-widest text-heat-yellow">
            Querem entrar ({pendingList.length})
          </h3>
          <ul className="mt-3 space-y-3">
            {pendingList.map((r) => (
              <li key={r.user_id} className="flex items-center gap-3">
                <Avatar src={r.avatar_url} name={r.name} size={36} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <button
                  type="button"
                  aria-label={`Negar ${r.name}`}
                  title="Negar"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ userId: r.user_id, allow: false, name: r.name })}
                  className="grid h-9 w-9 place-items-center bg-ink-700 text-fog-100 transition hover:bg-ink-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Permitir ${r.name}`}
                  title="Permitir"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ userId: r.user_id, allow: true, name: r.name })}
                  className="grid h-9 w-9 place-items-center bg-heat-green text-white transition hover:brightness-90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-fog-500">
          Na sala ({inRoom.length})
        </h3>
        <ul className="mt-3 space-y-3">
          {inRoom.map((u) => (
            <li key={u.id} className="flex items-center gap-3">
              <Avatar src={u.avatar_url} name={u.name} size={36} />
              <span className="min-w-0 flex-1 truncate">
                {u.name}
                {u.id === myId && <span className="text-fog-500"> (você)</span>}
              </span>
              {u.id === ownerId && (
                <span className="bg-heat-pink px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
              )}
              {u.in_call && <Video className="h-4 w-4 text-heat-green" aria-label="Na chamada" />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
