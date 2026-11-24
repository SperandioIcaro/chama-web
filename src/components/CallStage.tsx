import { MicOff, Pin, PinOff, ScreenShareOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "../ui/Avatar";

export type StageTile = {
  /** "<userId>" para câmera, "screen:<userId>" para apresentação */
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  kind: "camera" | "screen";
  local: boolean;
  micOn: boolean;
  camOn: boolean;
  connecting: boolean;
  /** texto no lugar do vídeo (ex.: "Você está apresentando") */
  placeholder?: string;
};

type TileProps = {
  tile: StageTile;
  small?: boolean;
  pinned?: boolean;
  onPin?: () => void;
  onStop?: () => void;
};

function Tile({ tile, small = false, pinned = false, onPin, onStop }: TileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const { stream } = tile;

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const isScreen = tile.kind === "screen";
  const showVideo = stream !== null && (isScreen || tile.camOn);
  const fit = isScreen ? "object-contain" : "object-cover";
  const mirror = tile.local && !isScreen ? "-scale-x-100" : "";

  return (
    <div className="group relative h-full w-full overflow-hidden bg-ink-800">
      {/* fica montado mesmo com a câmera off: é ele que toca o áudio */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={tile.local}
        className={`h-full w-full ${fit} ${mirror} ${showVideo ? "" : "invisible"}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center p-2 text-center">
          {tile.placeholder ? (
            <p className="text-sm text-fog-300">{tile.placeholder}</p>
          ) : (
            <Avatar src={tile.avatarUrl} name={tile.name} size={small ? 40 : 80} />
          )}
        </div>
      )}

      {tile.connecting && (
        <span className="absolute left-2 top-2 bg-ink-950/70 px-2 py-0.5 text-[11px] text-fog-300">
          Conectando…
        </span>
      )}

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            title="Encerrar apresentação"
            aria-label="Encerrar apresentação"
            className="grid h-8 w-8 place-items-center bg-ink-950/80 text-heat-pink transition hover:bg-ink-950"
          >
            <ScreenShareOff className="h-4 w-4" />
          </button>
        )}
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            title={pinned ? "Desafixar" : "Fixar na tela"}
            aria-label={pinned ? "Desafixar" : "Fixar na tela"}
            aria-pressed={pinned}
            className={`grid h-8 w-8 place-items-center bg-ink-950/80 transition hover:bg-ink-950 ${
              pinned ? "text-heat-yellow" : "text-fog-100"
            }`}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-xs sm:text-sm">
        {!tile.micOn && tile.kind === "camera" && (
          <MicOff className="h-4 w-4 shrink-0 text-heat-pink" aria-label="Microfone desligado" />
        )}
        <span className="truncate">{tile.local && !isScreen ? `${tile.name} (você)` : tile.name}</span>
      </div>
    </div>
  );
}

function gridClass(n: number) {
  if (n <= 1) return "grid-cols-1 grid-rows-1";
  if (n === 2) return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
  if (n <= 4) return "grid-cols-2 grid-rows-2";
  return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2";
}

type Props = {
  /** meu vídeo (fica pequeno e fixo, no estilo do Meet) */
  self: StageTile;
  /** câmeras e apresentações dos outros (e o aviso "você está apresentando") */
  others: StageTile[];
  pinnedId: string | null;
  onPin: (id: string | null) => void;
  /** só o admin: encerrar a apresentação de alguém */
  onStopPresenter?: (userId: string) => void;
};

/**
 * Palco da chamada: caixa de tamanho fixo (nada rola); só os vídeos mudam de tamanho.
 *  - sem destaque: grade com as câmeras dos outros + meu vídeo em miniatura no canto
 *  - com apresentação (ou vídeo fixado): destaque grande + faixa com os demais
 */
export function CallStage({ self, others, pinnedId, onPin, onStopPresenter }: Props) {
  const screens = others.filter((t) => t.kind === "screen");
  const cameras = others.filter((t) => t.kind === "camera");

  const main = (pinnedId ? others.find((t) => t.id === pinnedId) : undefined) ?? screens[0] ?? null;

  const pinProps = (t: StageTile) =>
    t.local ? {} : { pinned: pinnedId === t.id, onPin: () => onPin(pinnedId === t.id ? null : t.id) };
  const stopProps = (t: StageTile) =>
    onStopPresenter && t.kind === "screen" && !t.local ? { onStop: () => onStopPresenter(t.userId) } : {};

  if (main) {
    const strip = [...cameras.filter((t) => t.id !== main.id), self];
    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-2 md:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <Tile tile={main} {...pinProps(main)} {...stopProps(main)} />
        </div>
        <div className="flex h-24 shrink-0 gap-2 md:h-full md:w-52 md:flex-col">
          {strip.map((t) => (
            <div key={t.id} className="min-h-0 min-w-0 flex-1">
              <Tile tile={t} small {...pinProps(t)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Sozinho na chamada: seu vídeo aparece grande até alguém chegar.
  const items = cameras.length > 0 ? cameras : [self];
  const showPip = cameras.length > 0;

  return (
    <div className="relative h-full min-h-0 w-full">
      <div className={`grid h-full w-full gap-2 ${gridClass(items.length)}`}>
        {items.map((t) => (
          <div key={t.id} className="min-h-0 min-w-0">
            <Tile tile={t} {...pinProps(t)} />
          </div>
        ))}
      </div>

      {showPip && (
        <div className="absolute bottom-2 right-2 z-10 aspect-video w-28 shadow-lg ring-1 ring-ink-600 md:w-44">
          <Tile tile={self} small />
        </div>
      )}
    </div>
  );
}
