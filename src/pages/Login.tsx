import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { getErrorMessage } from "../api/error";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormData = z.infer<typeof schema>;

export function Login() {
  const nav = useNavigate();
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      await signIn(data.email, data.password);
      toast.success("Login feito. Bora.");
      nav("/");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Falhou o login"));
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-zinc-400">Volte pro ringue. Sua sala te espera.</p>
        </div>

        <Card>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm text-zinc-300">Email</label>
              <Input placeholder="voce@exemplo.com" {...register("email")} />
            </div>

            <div>
              <label className="text-sm text-zinc-300">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
            </div>

            <Button disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>

            <div className="text-sm text-zinc-400">
              Não tem conta?{" "}
              <Link className="text-zinc-100 hover:underline" to="/register">
                Criar agora
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
