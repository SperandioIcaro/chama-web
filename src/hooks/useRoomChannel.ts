import { useEffect, useRef, useState } from "react";
import type { Channel } from "phoenix";
import type { ChatMessage } from "../types/chat";

type UseRoomChannelOpts = {
  channel: Channel | null;
};

export function useRoomChannel({ channel }: UseRoomChannelOpts) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [joined, setJoined] = useState(false);

  // evita duplicar handler em re-render
  const didBindRef = useRef(false);

  useEffect(() => {
    if (!channel) return;

    const join = channel.join();
    join.receive("ok", () => setJoined(true));
    join.receive("error", () => setJoined(false));

    return () => {
      try {
        channel.leave();
      } catch {
        // ignore
      }
      setJoined(false);
    };
  }, [channel]);

  useEffect(() => {
    if (!channel) return;
    if (didBindRef.current) return;
    didBindRef.current = true;

    const onChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    channel.on("chat:message", onChat);

    return () => {
      // Phoenix Channel não tem off() em versões antigas; se tiver, use.
      // @ts-expect-error Channel.off() is not typed in older Phoenix versions
      if (channel.off) channel.off("chat:message", onChat);
      didBindRef.current = false;
    };
  }, [channel]);

  async function sendMessage(body: string) {
    if (!channel) return { ok: false as const, error: "no_channel" };

    const trimmed = body.trim();
    if (!trimmed) return { ok: false as const, error: "empty" };

    return new Promise<
      { ok: true; msg: ChatMessage } | { ok: false; error: string }
    >((resolve) => {
      channel
        .push("chat:new", { body: trimmed }, 10_000)
        .receive("ok", (msg: ChatMessage) => resolve({ ok: true, msg }))
        .receive("error", (err: string) => resolve({ ok: false, error: err }))
        .receive("timeout", () => resolve({ ok: false, error: "timeout" }));
    });
  }

  return { joined, messages, sendMessage };
}
