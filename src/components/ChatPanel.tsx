import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "../api/rooms";
import { Avatar } from "../ui/Avatar";

type Props = {
  messages: ChatMessage[];
  myId: string;
  disabled: boolean;
  onSend: (body: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatPanel({ messages, myId, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // rola para a mensagem mais nova
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const result = await onSend(body);
    setSending(false);
    if (result.ok) setText("");
    else toast.error(result.error);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-fog-500">Ainda não tem conversa por aqui. Puxe assunto. 🔥</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <Avatar src={m.avatar_url} name={m.user_name} size={32} />
            <div className="min-w-0">
              <p className="flex items-baseline gap-2 text-xs text-fog-500">
                <span className={`font-bold ${m.user_id === myId ? "text-heat-yellow" : "text-fog-300"}`}>
                  {m.user_name}
                </span>
                <time dateTime={m.inserted_at}>{time(m.inserted_at)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-5">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-ink-700 p-3">
        <input
          value={text}
          maxLength={1000}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          aria-label="Mensagem"
          className="h-11 min-w-0 flex-1 bg-ink-700 px-3 text-sm outline-none placeholder:text-fog-500 focus:ring-1 focus:ring-heat-yellow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || text.trim() === ""}
          aria-label="Enviar"
          className="grid h-11 w-11 place-items-center bg-heat-pink text-white transition enabled:hover:brightness-90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
