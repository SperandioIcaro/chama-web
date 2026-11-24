import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError } from "../api/client";
import { getErrorMessage } from "../api/error";
import { githubEnabled, startGithubLogin } from "../auth/github";
import { useAuth } from "../auth/useAuth";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../ui/Button";
import { GithubIcon } from "../ui/GithubIcon";
import { Field, Input } from "../ui/Input";

// Mesmas regras da API (ChamaApi.Accounts.User): 8–72 caracteres, ao menos 1 letra e 1 número.
const rules = [
  { label: "Pelo menos 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Uma letra", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "Um número", test: (v: string) => /[0-9]/.test(v) },
];

const schema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(60, "Máximo de 60 caracteres"),
    email: z.email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo de 8 caracteres")
      .max(72, "Máximo de 72 caracteres")
      .regex(/[A-Za-z]/, "Precisa ter ao menos uma letra")
      .regex(/[0-9]/, "Precisa ter ao menos um número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem",
  });
type FormData = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, token, user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  const password = watch("password") ?? "";

  if (token && user) return <Navigate to={from} replace />;

  async function onSubmit(data: FormData) {
    try {
      await signUp(data.name, data.email, data.password);
      toast.success("Conta criada. Bem-vindo(a)!");
      navigate(from, { replace: true });
    } catch (e) {
      // erros de validação vindos da API (ex.: email já em uso) vão para o campo certo
      if (e instanceof ApiError && e.fields) {
        let mapped = false;
        for (const field of ["name", "email", "password"] as const) {
          const message = e.fields[field]?.[0];
          if (message) {
            setError(field, { message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      toast.error(getErrorMessage(e, "Não foi possível criar a conta."));
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto. Sua sala começa aqui.">
      <Button
        variant="yellow"
        className="w-full"
        icon={<GithubIcon className="h-5 w-5" />}
        disabled={!githubEnabled}
        title={githubEnabled ? undefined : "Defina VITE_GITHUB_CLIENT_ID para habilitar"}
        onClick={() => startGithubLogin(from)}
      >
        Continuar com o GitHub
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
        <Field label="Nome" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Como quer ser chamado(a)"
            aria-invalid={errors.name ? true : undefined}
            {...register("name")}
          />
        </Field>

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

        <Field
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          hint={
            <ul className="space-y-1">
              {rules.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.label} className={`flex items-center gap-2 ${ok ? "text-heat-green" : ""}`}>
                    {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            {...register("password")}
          />
        </Field>

        <Field label="Confirmar senha" htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.confirm ? true : undefined}
            {...register("confirm")}
          />
        </Field>

        <Button type="submit" variant="pink" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-sm text-fog-300">
        Já tem conta?{" "}
        <Link to="/login" state={{ from }} className="font-bold text-heat-yellow hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
