import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Room = {
  id: string;
  code: string;
  name: string;
  participants_count?: number;
  participants_active_count?: number;
};

function getAuthHeaderValue(): string | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  // só seta Content-Type se não existir (pra não quebrar uploads futuros)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const auth = getAuthHeaderValue();
  if (auth) headers.set("Authorization", auth);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const data: unknown = text
    ? (() => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return null;
        }
      })()
    : null;

  if (!res.ok) {
    const d =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;

    const message =
      (d?.error &&
      typeof d.error === "object" &&
      (d.error as Record<string, unknown>).message &&
      typeof (d.error as Record<string, unknown>).message === "string"
        ? ((d.error as Record<string, unknown>).message as string)
        : null) ||
      (d?.message && typeof d.message === "string" ? d.message : null) ||
      (d?.error && typeof d.error === "string" ? d.error : null) ||
      `HTTP ${res.status}`;

    throw new Error(message);
  }

  return data as T;
}

export default function RoomsPage() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [searchCode, setSearchCode] = useState("");

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms]);

  async function loadRooms() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ rooms: Room[] }>("/api/rooms");
      setRooms(res.rooms || []);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Falha ao carregar salas";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRooms();
  }, []);

  async function onCreateRoom() {
    const name = newName.trim();
    if (!name) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await api<{ room: Room }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ room: { name } }),
      });

      const created = res.room;
      setNewName("");
      navigate(`/rooms/${created.code}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao criar sala";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  async function onFindByCode() {
    const code = searchCode.trim();
    if (!code) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await api<{ room: Room }>(`/api/rooms/by-code/${code}`);
      navigate(`/rooms/${res.room.code}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Sala não encontrada";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  function peopleCount(r: Room) {
    const n = r.participants_count ?? r.participants_active_count ?? undefined;
    return typeof n === "number" ? n : null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Salas</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Crie uma, encontre por código, ou escolha uma da lista.
              </p>
            </div>

            <button
              onClick={loadRooms}
              className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
              disabled={loading}
              title="Atualizar lista"
            >
              Atualizar
            </button>
          </div>

          {err && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
              {err}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 p-5">
            <h2 className="font-semibold">Criar sala</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Dê um nome e pronto — nasce uma sala novinha em folha.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateRoom();
                }}
                className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                placeholder="Ex: Daily do Caos"
              />
              <button
                onClick={() => void onCreateRoom()}
                disabled={loading || !newName.trim()}
                className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 p-5">
            <h2 className="font-semibold">Buscar por código</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Já tem o código? Entra sem cerimônia.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onFindByCode();
                }}
                className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600 font-mono"
                placeholder="Ex: I-nevHo9"
              />
              <button
                onClick={() => void onFindByCode()}
                disabled={loading || !searchCode.trim()}
                className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900 disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="border-b border-zinc-800 p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Todas as salas</div>
              <div className="text-sm text-zinc-400">
                {loading ? "Carregando…" : `${rooms.length} sala(s)`}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {sortedRooms.length === 0 && !loading ? (
              <div className="text-sm text-zinc-500">
                Nenhuma sala ainda. Crie a primeira e seja o fundador do
                império.
              </div>
            ) : (
              sortedRooms.map((r) => {
                const count = peopleCount(r);

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-800 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="mt-1 text-xs text-zinc-400 flex gap-3">
                        <span className="font-mono">code: {r.code}</span>
                        <span>pessoas: {count === null ? "—" : count}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/rooms/${r.code}`)}
                      className="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
                    >
                      Entrar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Obs: se “pessoas: —” aparecer, é porque o backend ainda não manda a
          contagem. A gente resolve isso com um patch de 10 linhas.
        </div>
      </div>
    </div>
  );
}
