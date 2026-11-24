import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { getErrorMessage } from "../api/error";
import { githubEnabled, startGithubLogin } from "../auth/github";
import { useAuth } from "../auth/useAuth";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../ui/Button";
import { GithubIcon } from "../ui/GithubIcon";
import { Field, Input } from "../ui/Input";

const schema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Digite sua senha"),
});
type FormData = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, token, user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (token && user) return <Navigate to={from} replace />;

  async function onSubmit(data: FormData) {
    try {
      await signIn(data.email, data.password);
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(getErrorMessage(e, "Não foi possível entrar."));
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Volte para suas salas e continue a conversa.">
      <Button
        variant="yellow"
        className="w-full"
        icon={<GithubIcon className="h-5 w-5" />}
        disabled={!githubEnabled}
        title={githubEnabled ? undefined : "Defina VITE_GITHUB_CLIENT_ID para habilitar"}
        onClick={() => startGithubLogin(from)}
      >
        Entrar com o GitHub
      </Button>
      {!githubEnabled && (
        <p className="mt-2 text-xs text-fog-500">
          Login com GitHub indisponível: falta configurar <code>VITE_GITHUB_CLIENT_ID</code> no .env do front
          (veja o README).
        </p>
      )}

      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-fog-500">
        <span className="h-px flex-1 bg-ink-600" />
        ou com email
        <span className="h-px flex-1 bg-ink-600" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            aria-invalid={errors.email ? true : undefined}
            {...register("email")}
          />
        </Field>

        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            {...register("password")}
          />
        </Field>

        <Button type="submit" variant="pink" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-sm text-fog-300">
        Ainda não tem conta?{" "}
        <Link to="/register" state={{ from }} className="font-bold text-heat-yellow hover:underline">
          Criar agora
        </Link>
      </p>
    </AuthShell>
  );
}
