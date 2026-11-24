import { useNavigate } from "react-router-dom";
import { useSocket } from "../realtime/useSocket";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

/** Convite para sala privada: aparece em qualquer tela do app, só para quem foi convidado. */
export function InviteModal() {
  const { invites, answerInvite } = useSocket();
  const navigate = useNavigate();
  const invite = invites[0];

  if (!invite) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md bg-ink-850 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-heat-yellow">Convite</p>

        <div className="mt-4 flex items-center gap-4">
          <Avatar src={invite.from.avatar_url} name={invite.from.name} size={56} />
          <div className="min-w-0">
            <h2 id="invite-title" className="text-lg font-bold leading-snug">
              {invite.from.name} te chamou para uma sala
            </h2>
            <p className="truncate text-fog-300">{invite.room_name}</p>
          </div>
        </div>

        {invites.length > 1 && (
          <p className="mt-3 text-xs text-fog-500">+{invites.length - 1} convite(s) na fila</p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => answerInvite(invite, false)}>
            Recusar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              answerInvite(invite, true);
              navigate(`/rooms/${encodeURIComponent(invite.room_code)}`);
            }}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
