import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Lock, Trash2, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "../api/error";
import { createRoom, deleteRoom, extractRoomCode, inviteLink, listRooms, type Room } from "../api/rooms";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";

async function copyInvite(room: Room) {
  try {
    await navigator.clipboard.writeText(inviteLink(room.code));
    toast.success("Link de convite copiado");
  } catch {
    toast.error("Não consegui copiar. Copie o código manualmente.");
  }
}

export default function RoomsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const rooms = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await listRooms()).filter((r) => r.kind === "private"),
  });

  const create = useMutation({
    mutationFn: (roomName: string) => createRoom({ name: roomName }),
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/rooms/${encodeURIComponent(room.code)}`);
    },
    onError: (e) => toast.error(getErrorMessage(e, "Não foi possível criar a sala.")),
  });

  const remove = useMutation({
    mutationFn: (room: Room) => deleteRoom(room.id),
    onSuccess: () => {
      toast.success("Sala apagada");
      void qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Não foi possível apagar a sala.")),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length >= 2) create.mutate(value);
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const value = extractRoomCode(code);
    if (value) navigate(`/rooms/${encodeURIComponent(value)}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8">
      <header>
        <h1 className="text-xs font-bold uppercase tracking-widest text-heat-yellow">Salas privadas</h1>
        <p className="mt-2 max-w-xl text-2xl font-bold leading-8">
          Chamadas de vídeo e chat só para quem recebeu o convite.
        </p>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <form onSubmit={onCreate} className="bg-ink-850 p-6">
          <h2 className="text-lg font-bold">Criar sala</h2>
          <p className="mt-1 text-sm text-fog-300">
            Você recebe um link de convite para mandar para quem quiser.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              aria-label="Nome da sala"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Daily do Caos"
            />
            <Button type="submit" variant="pink" loading={create.isPending} disabled={name.trim().length < 2}>
              Criar
            </Button>
          </div>
        </form>

        <form onSubmit={onJoin} className="bg-ink-850 p-6">
          <h2 className="text-lg font-bold">Entrar com convite</h2>
          <p className="mt-1 text-sm text-fog-300">Cole o código ou o link que você recebeu.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              aria-label="Código ou link de convite"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código ou link"
              className="font-mono"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={code.trim() === ""}>
              Entrar
            </Button>
          </div>
        </form>
      </div>

      <section className="mt-10" aria-labelledby="my-rooms">
        <h2 id="my-rooms" className="text-lg font-bold">
          Suas salas
        </h2>

        {rooms.isPending && (
          <div className="mt-6 flex items-center gap-3 text-fog-300">
            <Spinner className="h-5 w-5 text-heat-yellow" /> Carregando…
          </div>
        )}

        {rooms.isError && (
          <p role="alert" className="mt-6 bg-ink-850 p-4 text-sm text-heat-orange">
            {getErrorMessage(rooms.error, "Não consegui carregar suas salas.")}{" "}
            <button type="button" className="font-bold underline" onClick={() => void rooms.refetch()}>
              Tentar de novo
            </button>
          </p>
        )}

        {rooms.data && rooms.data.length === 0 && (
          <p className="mt-6 bg-ink-850 p-6 text-fog-300">
            Você ainda não está em nenhuma sala privada. Crie a primeira acima. 🔥
          </p>
        )}

        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {rooms.data?.map((room) => (
            <li key={room.id} className="flex flex-col gap-4 bg-ink-850 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 truncate text-lg font-bold">
                    <Lock className="h-4 w-4 shrink-0 text-heat-yellow" aria-hidden />
                    <span className="truncate">{room.name}</span>
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fog-500">
                    <span className="font-mono">{room.code}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {room.participants_count ?? 0}
                    </span>
                    {room.is_owner && <span className="font-bold text-heat-pink">Você é admin</span>}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void copyInvite(room)}
                    title="Copiar link de convite"
                    aria-label={`Copiar link de convite de ${room.name}`}
                    className="p-2 text-fog-300 transition hover:text-fog-100"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                  {room.is_owner && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Apagar a sala "${room.name}"? Isso não pode ser desfeito.`)) {
                          remove.mutate(room);
                        }
                      }}
                      title="Apagar sala"
                      aria-label={`Apagar sala ${room.name}`}
                      className="p-2 text-fog-300 transition hover:text-heat-pink"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <Button size="sm" onClick={() => navigate(`/rooms/${encodeURIComponent(room.code)}`)}>
                Entrar
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
