import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../api/rooms";

const VISIBLE = 3;
const RELEASE_MS = 3000;

/**
 * Lógica do mural do NLW Heat: mostra as 3 últimas mensagens e libera as novas
 * uma a cada 3 s (fila). Mensagens do próprio usuário aparecem na hora.
 */
export function useWallMessages(messages: ChatMessage[], ready: boolean, myId: string) {
  const [shown, setShown] = useState<ChatMessage[]>([]);
  const seen = useRef(new Set<string>());
  const queue = useRef<ChatMessage[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const fresh = messages.filter((m) => !seen.current.has(m.id));
    if (fresh.length === 0) return;
    for (const m of fresh) seen.current.add(m.id);

    if (!initialized.current) {
      initialized.current = true;
      setShown(fresh.slice(-VISIBLE).reverse());
      return;
    }

    const mine = fresh.filter((m) => m.user_id === myId);
    const others = fresh.filter((m) => m.user_id !== myId);
    queue.current.push(...others);
    if (mine.length > 0) setShown((prev) => [...mine.reverse(), ...prev].slice(0, VISIBLE));
  }, [messages, ready, myId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = queue.current.shift();
      if (next) setShown((prev) => [next, ...prev].slice(0, VISIBLE));
    }, RELEASE_MS);
    return () => clearInterval(timer);
  }, []);

  return shown;
}
