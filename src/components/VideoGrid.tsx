import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "../ui/Avatar";

export type Tile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  local: boolean;
  micOn: boolean;
  camOn: boolean;
  connecting: boolean;
};

function VideoTile({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { stream } = tile;

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const showVideo = stream !== null && tile.camOn;

  return (
    <div className="relative aspect-video min-h-0 overflow-hidden bg-ink-800">
      {/* o <video> fica montado mesmo com a câmera off: é ele que toca o áudio */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={tile.local}
        className={`h-full w-full object-cover ${tile.local ? "-scale-x-100" : ""} ${showVideo ? "" : "invisible"}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar src={tile.avatarUrl} name={tile.name} size={80} />
        </div>
      )}

      {tile.connecting && (
        <span className="absolute right-3 top-3 bg-ink-950/70 px-2 py-1 text-xs text-fog-300">
          Conectando…
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-sm">
        {!tile.micOn && <MicOff className="h-4 w-4 text-heat-pink" aria-label="Microfone desligado" />}
        <span className="truncate">{tile.local ? `${tile.name} (você)` : tile.name}</span>
      </div>
    </div>
  );
}

export function VideoGrid({ tiles }: { tiles: Tile[] }) {
  const n = tiles.length;
  const cols =
    n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 sm:grid-cols-2" : n <= 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid auto-rows-fr content-center gap-2 ${cols}`}>
      {tiles.map((t) => (
        <VideoTile key={t.id} tile={t} />
      ))}
    </div>
  );
}
