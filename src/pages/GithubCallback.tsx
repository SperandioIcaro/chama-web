import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getErrorMessage } from "../api/error";
import { consumeGithubState, consumePostLoginPath, githubRedirectUri } from "../auth/github";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { FullScreenLoader } from "../ui/Spinner";

// O `code` do GitHub só vale uma vez; o StrictMode (dev) roda o efeito duas vezes.
let handledCode: string | null = null;

/** Rota que o GitHub chama depois da autorização: /auth/github/callback?code=…&state=… */
export function GithubCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithGithub } = useAuth();
  const [asyncError, setAsyncError] = useState<string | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const early = params.get("error")
    ? "Você cancelou o login com o GitHub."
    : !code
      ? "O GitHub não devolveu o código de autorização."
      : null;

  useEffect(() => {
    if (early || !code || handledCode === code) return;
    handledCode = code;

    if (!consumeGithubState(state)) {
      setAsyncError("Sessão de login inválida ou expirada. Tente entrar de novo.");
      return;
    }

    signInWithGithub(code, githubRedirectUri())
      .then(() => navigate(consumePostLoginPath(), { replace: true }))
      .catch((e: unknown) => setAsyncError(getErrorMessage(e, "Não foi possível entrar com o GitHub.")));
  }, [early, code, state, signInWithGithub, navigate]);

  const error = early ?? asyncError;

  if (!error) return <FullScreenLoader label="Entrando com o GitHub…" />;

  return (
    <div className="grid min-h-dvh place-items-center bg-ink-900 p-6">
      <div role="alert" className="w-full max-w-md bg-ink-850 p-6 text-center">
        <h1 className="text-xl font-bold">Não deu para entrar</h1>
        <p className="mt-2 text-fog-300">{error}</p>
        <Button className="mt-6 w-full" onClick={() => navigate("/login", { replace: true })}>
          Voltar ao login
        </Button>
      </div>
    </div>
  );
}
