import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { MessageWall } from "../components/MessageWall";
import { SendMessageCard } from "../components/SendMessageCard";
import { GENERAL_ROOM_CODE } from "../config";
import { useWallMessages } from "../hooks/useWallMessages";
import { useRoomChannel } from "../realtime/useRoomChannel";
import { useRoomChat } from "../realtime/useRoomChat";
import { Avatar } from "../ui/Avatar";

/** Home do app: a sala geral, no formato do mural do NLW Heat. */
export function GeneralRoom() {
  const { user } = useAuth();
  const { channel, joinState, joinError, users } = useRoomChannel(GENERAL_ROOM_CODE);
  const { messages, ready, send } = useRoomChat(GENERAL_ROOM_CODE, channel);
  const wall = useWallMessages(messages, ready, user?.id ?? "");

  if (!user) return null;

  return (
    <div className="relative flex min-h-full flex-col overflow-x-clip">
      {/* faixa de hexágonos atrás do cartão (só desktop) */}
      <div
        aria-hidden
        className="heat-pattern pointer-events-none absolute -right-[200px] top-0 hidden h-full w-[420px] lg:block"
      />

      <div className="relative mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 gap-10 px-5 py-6 lg:grid-cols-[1fr_453px] lg:gap-[120px]">
        <section className="flex flex-col">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-xs font-bold uppercase tracking-widest text-heat-yellow">
              Sala geral
            </h1>
            <span className="text-sm text-fog-500">
              {users.length} online agora
            </span>
            <div className="flex -space-x-2">
              {users.slice(0, 6).map((u) => (
                <Avatar key={u.id} src={u.avatar_url} name={u.name} size={26} ring={false} />
              ))}
            </div>
          </div>

          {joinState === "error" && (
            <p role="alert" className="mt-4 bg-ink-850 p-4 text-sm text-heat-orange">
              {joinError}
            </p>
          )}

          <MessageWall messages={wall} ready={ready} />

          <p className="mt-8 text-sm text-fog-500">
            Quer conversar com um grupo fechado ou fazer uma chamada?{" "}
            <Link to="/rooms" className="font-bold text-heat-yellow hover:underline">
              Crie uma sala privada
            </Link>
            .
          </p>
        </section>

        <SendMessageCard user={user} disabled={joinState !== "joined"} onSend={send} />
      </div>
    </div>
  );
}
