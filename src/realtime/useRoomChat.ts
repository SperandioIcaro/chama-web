import type { Channel } from "phoenix";
import { useCallback, useEffect, useState } from "react";
import { listMessages, type ChatMessage } from "../api/rooms";
import { pushAsync } from "./pushAsync";

const KEEP = 200;

const byDate = (a: ChatMessage, b: ChatMessage) =>
  a.inserted_at < b.inserted_at ? -1 : a.inserted_at > b.inserted_at ? 1 : 0;

export function chatErrorMessage(reason: string) {
  switch (reason) {
    case "slow_down":
      return "Calma! Você está enviando rápido demais.";
    case "invalid_message":
      return "Mensagem inválida (vazia ou grande demais).";
    default:
      return "Não consegui enviar. Verifique sua conexão.";
  }
}

/** Histórico (REST) + mensagens ao vivo (canal), sem duplicar nem perder nada no meio. */
export function useRoomChat(code: string | null, channel: Channel | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!code || !channel) return;
    let cancelled = false;

    const merge = (incoming: ChatMessage[]) =>
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        for (const m of incoming) map.set(m.id, m);
        return [...map.values()].sort(byDate).slice(-KEEP);
      });

    // Assina ANTES de buscar o histórico: mensagens que chegarem no meio não se perdem.
    const ref = channel.on("chat:message", (m: ChatMessage) => merge([m]));

    listMessages(code)
      .then((list) => {
        if (cancelled) return;
        merge(list);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      channel.off("chat:message", ref);
      setMessages([]);
      setReady(false);
    };
  }, [code, channel]);

  const send = useCallback(
    async (body: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!channel) return { ok: false, error: chatErrorMessage("offline") };
      try {
        await pushAsync(channel, "chat:new", { body });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: chatErrorMessage(e instanceof Error ? e.message : "error") };
      }
    },
    [channel],
  );

  return { messages, ready, send };
}
