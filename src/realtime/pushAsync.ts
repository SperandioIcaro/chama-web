import type { Channel } from "phoenix";

/** `channel.push` como Promise. Rejeita com Error(reason) quando o servidor recusa. */
export function pushAsync<T = unknown>(
  channel: Channel,
  event: string,
  payload: object = {},
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    channel
      .push(event, payload, timeoutMs)
      .receive("ok", (reply: T) => resolve(reply))
      .receive("error", (err: { reason?: string } | undefined) =>
        reject(new Error(err?.reason ?? "error")),
      )
      .receive("timeout", () => reject(new Error("timeout")));
  });
}
