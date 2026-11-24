import { GITHUB_CLIENT_ID } from "../config";

const STATE_KEY = "chama:gh_state";
const NEXT_KEY = "chama:post_login";

export const githubEnabled = GITHUB_CLIENT_ID !== "";

export const githubRedirectUri = () => `${window.location.origin}/auth/github/callback`;

// crypto.randomUUID só existe em HTTPS/localhost; getRandomValues funciona em qualquer contexto.
function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Abre a autorização do GitHub. `next` é para onde voltar depois do login. */
export function startGithubLogin(next = "/") {
  const state = randomState();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NEXT_KEY, next);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: githubRedirectUri(),
    scope: "read:user user:email",
    state,
  });

  window.location.assign(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

/** Confere o `state` devolvido pelo GitHub (proteção contra CSRF). Uso único. */
export function consumeGithubState(received: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return expected !== null && expected === received;
}

export function consumePostLoginPath(): string {
  const next = sessionStorage.getItem(NEXT_KEY);
  sessionStorage.removeItem(NEXT_KEY);
  // só caminhos internos (evita open redirect)
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
