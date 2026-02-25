type Props = {
  open: boolean;
  fromUserId: string;
  roomCode: string;
  roomName?: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function InviteModal(props: Props) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-xl">
        <div className="text-sm opacity-70">Convite</div>

        <div className="mt-2 text-lg font-semibold">
          Você foi convidado para uma sala
        </div>

        <div className="mt-2 space-y-1 text-sm text-zinc-300">
          <div>
            <span className="opacity-70">Sala:</span>{" "}
            <span className="font-mono">{props.roomCode}</span>
            {props.roomName ? (
              <span className="opacity-70"> • {props.roomName}</span>
            ) : null}
          </div>

          <div>
            <span className="opacity-70">De:</span>{" "}
            <span className="font-mono">{props.fromUserId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={props.onDecline}
            className="flex-1 rounded-xl border border-zinc-800 px-4 py-2 hover:bg-zinc-900"
          >
            Recusar
          </button>
          <button
            onClick={props.onAccept}
            className="flex-1 rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
