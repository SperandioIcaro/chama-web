import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Sessão ativa</h2>
            <p className="text-zinc-400">
              Usuário:{" "}
              <span className="text-zinc-200">{user?.email ?? user?.id}</span>
            </p>
          </div>
          <Button variant="ghost" onClick={signOut}>
            Sair
          </Button>
        </div>
      </Card>

      <div className="text-zinc-400">
        Próximo passo: <span className="text-zinc-200">Rooms</span>{" "}
        (listar/criar/entrar).
      </div>
    </div>
  );
}
