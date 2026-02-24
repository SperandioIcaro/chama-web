import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export function Register() {
  const nav = useNavigate();
  const { signUp } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      console.log("REGISTER SUBMIT", data);
      await signUp(data.name, data.email, data.password);
      toast.success("Conta criada. Bem-vindo.");
      nav("/");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falhou ao criar conta";
      toast.error(message);
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-zinc-400">
            Entre para o jogo. Sua sala começa aqui.
          </p>
        </div>

        <Card>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm text-zinc-300">Nome</label>
              <Input placeholder="Seu nome" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-zinc-300">Email</label>
              <Input placeholder="voce@exemplo.com" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-zinc-300">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Criando..." : "Criar conta"}
            </Button>

            <div className="text-sm text-zinc-400">
              Já tem conta?{" "}
              <Link className="text-zinc-100 hover:underline" to="/login">
                Entrar
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
