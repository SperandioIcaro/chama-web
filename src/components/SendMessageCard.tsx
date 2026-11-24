import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { User } from "../api/auth";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { GithubIcon } from "../ui/GithubIcon";

const MAX = 1000;

type Props = {
  user: User;
  disabled?: boolean;
  onSend: (body: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** Cartão de envio do Heat: perfil + caixa de mensagem + botão rosa. */
export function SendMessageCard({ user, disabled = false, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    const result = await onSend(body);
    setSending(false);

    if (result.ok) setText("");
    else toast.error(result.error);
  }

  return (
    <div className="relative z-10 flex flex-col items-center self-center bg-ink-850 p-6 text-center">
      <header className="flex flex-col items-center">
        <Avatar src={user.avatar_url} name={user.name} size={94} />
        <strong className="mt-4 text-2xl leading-tight">{user.name}</strong>
        {user.github_login && (
          <span className="mt-2 flex items-center gap-2 text-fog-300">
            <GithubIcon className="h-4 w-4" />
            {user.github_login}
          </span>
        )}
      </header>

      <form onSubmit={submit} className="mt-8 flex w-full flex-col bg-ink-800 text-left">
        <label htmlFor="wall-message" className="bg-ink-700 px-6 py-4 text-xl font-bold">
          Mensagem
        </label>
        <textarea
          id="wall-message"
          value={text}
          maxLength={MAX}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
          placeholder="Compartilhe algo com a sala geral…"
          className="h-40 resize-none bg-transparent p-6 leading-6 text-fog-100 outline-none placeholder:text-fog-500 disabled:opacity-50"
        />
        <div className="flex items-center justify-between px-6 pb-6">
          <span className="text-xs text-fog-500">
            {text.length}/{MAX} · Ctrl+Enter envia
          </span>
          <Button
            type="submit"
            variant="pink"
            size="sm"
            loading={sending}
            disabled={disabled || text.trim() === ""}
          >
            Enviar mensagem
          </Button>
        </div>
      </form>
    </div>
  );
}
