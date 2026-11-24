import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { approveRequest, denyRequest } from "../api/rooms";
import { ApiError } from "../api/client";
import { getErrorMessage } from "../api/error";
import { useSocket } from "../realtime/useSocket";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

/** Para o admin: alguém entrou pelo link/código e espera ser liberado. Aparece em qualquer tela. */
export function JoinRequestModal() {
  const { joinRequests, clearJoinRequest } = useSocket();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const req = joinRequests[0];

  if (!req) return null;

  const resolve = async (allow: boolean) => {
    setBusy(true);
    try {
      if (allow) await approveRequest(req.room_code, req.user.id);
      else await denyRequest(req.room_code, req.user.id);
      toast.success(allow ? `${req.user.name} pode entrar` : `Pedido de ${req.user.name} negado`);
    } catch (e) {
      // 404 = já foi respondido em outro lugar (ex.: lista da sala); não é erro para o usuário
      if (!(e instanceof ApiError && e.status === 404)) toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
      clearJoinRequest(req.room_code, req.user.id);
      void qc.invalidateQueries({ queryKey: ["room-requests", req.room_code] });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-request-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md bg-ink-850 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-heat-yellow">Pedido para entrar</p>

        <div className="mt-4 flex items-center gap-4">
          <Avatar src={req.user.avatar_url} name={req.user.name} size={56} />
          <div className="min-w-0">
            <h2 id="join-request-title" className="text-lg font-bold leading-snug">
              {req.user.name} quer entrar na sala
            </h2>
            <p className="truncate text-fog-300">{req.room_name}</p>
          </div>
        </div>

        {joinRequests.length > 1 && (
          <p className="mt-3 text-xs text-fog-500">+{joinRequests.length - 1} pedido(s) na fila</p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => void resolve(false)}>
            Negar
          </Button>
          <Button className="flex-1" loading={busy} onClick={() => void resolve(true)}>
            Permitir
          </Button>
        </div>
      </div>
    </div>
  );
}
