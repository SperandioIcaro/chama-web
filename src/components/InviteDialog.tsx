import { Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { inviteLink, type Room } from "../api/rooms";
import type { RoomPresence } from "../realtime/useRoomChannel";
import { useSocket } from "../realtime/useSocket";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

type Props = {
  room: Room;
  myId: string;
  inRoom: RoomPresence[];
  onClose: () => void;
};

/** Lista TODO MUNDO que está online no Chama para convidar direto (sem precisar de link). */
export function InviteDialog({ room, myId, inRoom, onClose }: Props) {
  const { online, sendInvite } = useSocket();
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inRoomIds = new Set(inRoom.map((u) => u.id));
  const people = online.filter((u) => u.id !== myId);

  async function invite(userId: string, name: string) {
    setPending(userId);
    const result = await sendInvite(userId, room.code);
    setPending(null);

    if (result === "sent") {
      setSent((prev) => new Set(prev).add(userId));
      toast.success(`Convite enviado para ${name}`);
    } else if (result === "already_member") {
      toast(`${name} já faz parte da sala`);
    } else {
      toast.error("Não consegui enviar o convite. Tente de novo.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink(room.code));
      toast.success("Link copiado");
    } catch {
      toast.error("Não consegui copiar o link.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-title"
      className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <h2 id="invite-dialog-title" className="text-xl font-bold">
              Convidar pessoas
            </h2>
            <p className="mt-1 truncate text-sm text-fog-300">{room.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-fog-300 transition hover:text-fog-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-fog-500">
            Online agora ({people.length})
          </h3>

          {people.length === 0 ? (
            <p className="mt-3 text-sm text-fog-500">
              Ninguém mais está online no momento. Use o link abaixo para chamar alguém.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 pb-2">
              {people.map((u) => {
                const inside = inRoomIds.has(u.id);
                const alreadySent = sent.has(u.id);
                return (
                  <li key={u.id} className="flex items-center gap-3">
                    <Avatar src={u.avatar_url} name={u.name} size={36} />
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    {inside ? (
                      <span className="text-xs text-heat-green">Na sala</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={alreadySent ? "ghost" : "yellow"}
                        loading={pending === u.id}
                        disabled={alreadySent}
                        onClick={() => void invite(u.id, u.name)}
                      >
                        {alreadySent ? "Enviado" : "Convidar"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-ink-700 p-6 pt-4">
          <Button variant="ghost" size="sm" className="w-full" icon={<Copy className="h-4 w-4" />} onClick={() => void copyLink()}>
            Copiar link de convite
          </Button>
          <p className="mt-2 text-xs text-fog-500">
            Quem entrar pelo link ou código precisa que o admin permita. Quem você convida aqui entra direto.
          </p>
        </div>
      </div>
    </div>
  );
}
