import type { ChatMessage } from "../api/rooms";
import { Avatar } from "../ui/Avatar";

/** Mural no estilo Heat: texto grande, autor com anel degradê, segunda mensagem "recuada". */
export function MessageWall({ messages, ready }: { messages: ChatMessage[]; ready: boolean }) {
  return (
    <ul
      aria-live="polite"
      aria-label="Últimas mensagens da sala geral"
      className="flex min-h-64 flex-1 list-none flex-col justify-center gap-10"
    >
      {messages.length === 0 && ready && (
        <li className="max-w-md text-xl leading-7 text-fog-300">
          Ninguém falou ainda. Seja a primeira pessoa a acender a chama. 🔥
        </li>
      )}

      {messages.map((m, i) => (
        <li key={m.id} className={`max-w-[440px] ${i === 1 ? "lg:ml-20" : ""}`}>
          <p className="whitespace-pre-wrap break-words text-xl leading-7">{m.body}</p>
          <div className="mt-4 flex items-center gap-3">
            <Avatar src={m.avatar_url} name={m.user_name} size={34} />
            <span>{m.user_name}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
