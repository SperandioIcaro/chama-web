import { useMutation } from "@tanstack/react-query";
import {
  LogOut,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { leaveRoom, type Room } from "../api/rooms";
import { useAuth } from "../auth/useAuth";
import { CallStage, type StageTile } from "../components/CallStage";
import { ChatPanel } from "../components/ChatPanel";
import { InviteDialog } from "../components/InviteDialog";
import { PeoplePanel } from "../components/PeoplePanel";
import { MAX_CALL_SIZE } from "../config";
import { canShareScreen, useRoomCall, type ShareState } from "../hooks/useRoomCall";
import { useRoomChannel } from "../realtime/useRoomChannel";
import { useRoomChat } from "../realtime/useRoomChat";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

type PanelTab = "chat" | "people";
type MobileView = "call" | "chat" | "people";

export function RoomView({ room }: { room: Room }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { channel, joinState, joinError, users } = useRoomChannel(room.code);
  const chat = useRoomChat(room.code, channel);

  const myId = user?.id ?? "";
  const isOwner = myId !== "" && myId === room.created_by_id;
  const call = useRoomCall(channel, users, { id: myId, isOwner });

  const [tab, setTab] = useState<PanelTab>("chat");
  const [mobileView, setMobileView] = useState<MobileView>("call");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const leave = useMutation({
    mutationFn: () => leaveRoom(room.code),
    onSettled: () => navigate("/rooms"),
  });

  useEffect(() => {
    if (call.shareError) toast.error(call.shareError.message);
  }, [call.shareError]);

  if (!user) return null;

  const byId = new Map(users.map((u) => [u.id, u]));
  const inCallUsers = users.filter((u) => u.in_call);
  const inCallCount = inCallUsers.length;
  const presenter = users.find((u) => u.sharing);
  const someoneElsePresenting = presenter !== undefined && presenter.id !== myId;

  // Pedidos para apresentar: só o admin vê, e só de quem ainda está na chamada.
  const shareRequest = isOwner ? call.shareRequests.find((r) => byId.get(r.user_id)?.in_call) : undefined;

  // ───── tiles do palco ─────
  const others: StageTile[] = [];
  for (const [id, peer] of Object.entries(call.peers)) {
    const info = byId.get(id);
    const name = info?.name ?? "Participante";
    const screenId = info?.sharing ? info.screen_stream_id : null;

    others.push({
      id,
      userId: id,
      name,
      avatarUrl: info?.avatar_url ?? null,
      stream: peer.streams.find((s) => s.id !== screenId) ?? null,
      kind: "camera",
      local: false,
      micOn: info?.mic ?? true,
      camOn: info?.cam ?? true,
      connecting: peer.connection !== "connected",
    });

    if (info?.sharing) {
      const screen = screenId ? (peer.streams.find((s) => s.id === screenId) ?? null) : null;
      others.push({
        id: `screen:${id}`,
        userId: id,
        name: `${name} está apresentando`,
        avatarUrl: info.avatar_url,
        stream: screen,
        kind: "screen",
        local: false,
        micOn: true,
        camOn: true,
        connecting: false,
        placeholder: screen ? undefined : "Carregando apresentação…",
      });
    }
  }

  if (call.shareState === "sharing") {
    others.push({
      id: "screen:me",
      userId: myId,
      name: "Sua apresentação",
      avatarUrl: user.avatar_url,
      stream: null,
      kind: "screen",
      local: true,
      micOn: true,
      camOn: true,
      connecting: false,
      placeholder: "Você está apresentando sua tela",
    });
  }

  const self: StageTile = {
    id: myId,
    userId: myId,
    name: user.name,
    avatarUrl: user.avatar_url,
    stream: call.localStream,
    kind: "camera",
    local: true,
    micOn: call.micOn,
    camOn: call.camOn,
    connecting: false,
  };

  const showCall = mobileView === "call";
  const panelTab: PanelTab = mobileView === "people" ? "people" : mobileView === "chat" ? "chat" : tab;
  const inCall = call.status === "in-call";
  // por http://IP o navegador não libera câmera/microfone (só em HTTPS ou localhost)
  const insecure = typeof window !== "undefined" && !window.isSecureContext;

  return (
    <div className="flex h-full flex-col">
      {/* cabeçalho compacto */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-ink-700 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="h-4 w-4 shrink-0 text-heat-yellow" aria-hidden />
          <h1 className="truncate text-sm font-bold sm:text-base">{room.name}</h1>
          {isOwner && (
            <span className="shrink-0 bg-heat-pink px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Admin
            </span>
          )}
          <span className="hidden font-mono text-xs text-fog-500 sm:inline">{room.code}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            <span className="max-sm:hidden">Convidar</span>
          </Button>
          <Button
            size="sm"
            variant="dark"
            icon={<LogOut className="h-4 w-4" />}
            loading={leave.isPending}
            onClick={() => {
              call.leave();
              leave.mutate();
            }}
          >
            <span className="max-sm:hidden">Sair</span>
          </Button>
        </div>
      </div>

      {/* alternância no celular */}
      <div
        role="tablist"
        aria-label="Seções da sala"
        className="grid shrink-0 grid-cols-3 border-b border-ink-700 lg:hidden"
      >
        {(["call", "chat", "people"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={mobileView === v}
            type="button"
            onClick={() => setMobileView(v)}
            className={`py-2 text-xs font-bold uppercase tracking-wide ${
              mobileView === v ? "border-b-2 border-heat-pink text-fog-100" : "text-fog-500"
            }`}
          >
            {v === "call" ? "Chamada" : v === "chat" ? "Chat" : "Pessoas"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
        {/* área da chamada: caixa de tamanho fixo */}
        <section className={`${showCall ? "flex" : "hidden"} min-h-0 min-w-0 flex-col p-2 md:p-3 lg:flex`}>
          {joinState === "error" && (
            <p role="alert" className="mb-2 bg-ink-850 p-3 text-sm text-heat-orange">
              {joinError}
            </p>
          )}

          {shareRequest && (
            <div
              role="alert"
              className="mb-2 flex flex-wrap items-center gap-3 bg-ink-850 p-3 text-sm ring-1 ring-heat-yellow"
            >
              <span className="min-w-0 flex-1">
                <strong>{shareRequest.name}</strong> quer apresentar a tela.
              </span>
              <Button size="sm" variant="ghost" onClick={() => call.denyShare(shareRequest.user_id)}>
                Negar
              </Button>
              <Button size="sm" onClick={() => call.approveShare(shareRequest.user_id)}>
                Permitir
              </Button>
            </div>
          )}

          {!inCall ? (
            <div className="grid flex-1 place-items-center">
              <div className="w-full max-w-md bg-ink-850 p-6 text-center sm:p-8">
                <h2 className="text-2xl font-bold">Chamada de vídeo</h2>
                <p className="mt-2 text-fog-300">
                  {inCallCount === 0
                    ? "Ninguém na chamada agora. Entre para começar."
                    : `${inCallCount} ${inCallCount === 1 ? "pessoa está" : "pessoas estão"} na chamada.`}
                </p>

                {inCallCount > 0 && (
                  <div className="mt-4 flex justify-center -space-x-2">
                    {inCallUsers.map((u) => (
                      <Avatar key={u.id} src={u.avatar_url} name={u.name} size={40} />
                    ))}
                  </div>
                )}

                {insecure && (
                  <p role="alert" className="mt-4 bg-ink-800 p-3 text-left text-xs leading-5 text-heat-orange">
                    Você abriu o Chama por <code>http://</code> e o navegador bloqueia a câmera e o microfone.
                    Abra por <strong>https://</strong> (no PC, rode <code>npm run dev:lan</code> e use o endereço
                    que ele mostra).
                  </p>
                )}

                {call.error && (
                  <p role="alert" className="mt-4 text-sm text-heat-pink">
                    {call.error}
                  </p>
                )}

                <Button
                  className="mt-6 w-full"
                  icon={<Video className="h-5 w-5" />}
                  loading={call.status === "joining"}
                  disabled={joinState !== "joined" || inCallCount >= MAX_CALL_SIZE || insecure}
                  onClick={() => void call.join()}
                >
                  Entrar na chamada
                </Button>
                <p className="mt-3 text-xs text-fog-500">
                  Seu navegador vai pedir permissão de câmera e microfone. Até {MAX_CALL_SIZE} pessoas.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1">
                <CallStage
                  self={self}
                  others={others}
                  pinnedId={pinnedId}
                  onPin={setPinnedId}
                  onStopPresenter={isOwner ? call.revokeShare : undefined}
                />
              </div>

              <div className="flex shrink-0 items-center justify-center gap-2 pt-2">
                <RoundButton
                  off={!call.micOn}
                  label={call.micOn ? "Desligar microfone" : "Ligar microfone"}
                  onClick={call.toggleMic}
                >
                  {call.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </RoundButton>
                <RoundButton
                  off={!call.camOn}
                  disabled={!call.hasVideo}
                  label={call.camOn ? "Desligar câmera" : "Ligar câmera"}
                  onClick={call.toggleCam}
                >
                  {call.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </RoundButton>

                {canShareScreen() && (
                  <ShareControl
                    state={call.shareState}
                    blockedBy={someoneElsePresenting ? presenter?.name : undefined}
                    isOwner={isOwner}
                    onRequest={() => void call.requestShare()}
                    onStart={() => void call.startShare()}
                    onStop={call.stopShare}
                  />
                )}

                <button
                  type="button"
                  onClick={call.leave}
                  aria-label="Sair da chamada"
                  title="Sair da chamada"
                  className="grid h-12 w-14 place-items-center bg-heat-pink text-white transition hover:brightness-90"
                >
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </section>

        {/* painel lateral (chat / pessoas) */}
        <aside
          className={`${showCall ? "hidden" : "flex"} min-h-0 flex-col border-ink-700 bg-ink-850 lg:flex lg:border-l`}
        >
          <div role="tablist" aria-label="Painel" className="hidden shrink-0 grid-cols-2 border-b border-ink-700 lg:grid">
            {(["chat", "people"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={panelTab === t}
                type="button"
                onClick={() => setTab(t)}
                className={`py-3 text-xs font-bold uppercase tracking-wide ${
                  panelTab === t ? "border-b-2 border-heat-pink text-fog-100" : "text-fog-500"
                }`}
              >
                {t === "chat" ? "Chat" : `Pessoas (${users.length})`}
              </button>
            ))}
          </div>

          {panelTab === "chat" ? (
            <ChatPanel
              messages={chat.messages}
              myId={user.id}
              disabled={joinState !== "joined"}
              onSend={chat.send}
            />
          ) : (
            <PeoplePanel
              roomCode={room.code}
              myId={user.id}
              inRoom={users}
              ownerId={room.created_by_id}
              onInvite={() => setInviteOpen(true)}
            />
          )}
        </aside>
      </div>

      {inviteOpen && (
        <InviteDialog room={room} myId={user.id} inRoom={users} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function RoundButton({
  off,
  label,
  disabled,
  onClick,
  children,
}: {
  off: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-12 w-12 place-items-center rounded-full transition enabled:hover:brightness-90 disabled:opacity-40 ${
        off ? "bg-heat-pink text-white" : "bg-ink-700 text-fog-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Apresentar tela:
 *  - admin: clica e já escolhe a tela
 *  - demais: pedem permissão → o admin permite → clicam em "Escolher tela"
 *    (o seletor do navegador só abre com um clique, por isso são dois passos)
 */
function ShareControl({
  state,
  blockedBy,
  isOwner,
  onRequest,
  onStart,
  onStop,
}: {
  state: ShareState;
  blockedBy: string | undefined;
  isOwner: boolean;
  onRequest: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const base =
    "flex h-12 items-center gap-2 px-4 text-xs font-bold uppercase tracking-wide transition enabled:hover:brightness-90 disabled:opacity-50";

  if (state === "sharing") {
    return (
      <button type="button" onClick={onStop} title="Parar apresentação" className={`${base} bg-heat-pink text-white`}>
        <ScreenShareOff className="h-5 w-5" />
        <span className="hidden md:inline">Parar</span>
      </button>
    );
  }

  if (state === "requesting" || state === "starting") {
    return (
      <button type="button" disabled className={`${base} bg-ink-700 text-fog-100`}>
        <Spinner className="h-5 w-5" />
        <span className="hidden md:inline">{state === "requesting" ? "Aguardando o admin" : "Abrindo…"}</span>
      </button>
    );
  }

  if (state === "granted") {
    return (
      <button type="button" onClick={onStart} className={`${base} bg-heat-yellow text-ink-950`}>
        <ScreenShare className="h-5 w-5" />
        <span className="hidden md:inline">Escolher tela</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={isOwner ? onStart : onRequest}
      disabled={blockedBy !== undefined}
      title={blockedBy ? `${blockedBy} está apresentando` : "Apresentar tela"}
      className={`${base} bg-ink-700 text-fog-100`}
    >
      <ScreenShare className="h-5 w-5" />
      <span className="hidden md:inline">Apresentar</span>
    </button>
  );
}
