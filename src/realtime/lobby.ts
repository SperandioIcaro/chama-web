import { Channel, Socket } from "phoenix";

export type LobbyUserId = string;

export type InviteIncoming = {
  from_user_id: string;
  room_code: string;
  room_name?: string;
};

export type InviteOutcome = {
  by_user_id: string;
  room_code: string;
};

type InvitePayload = {
  from?: string;
  from_user_id?: string;
  room_code: string;
  room_name?: string;
};

type InviteAcceptPayload = {
  from?: string;
  by_user_id?: string;
  room_code: string;
};

type PresenceState = Record<string, { metas: Array<Record<string, unknown>> }>;

export type LobbyEvents = {
  onUsers: (users: LobbyUserId[]) => void;
  onInviteIncoming: (invite: InviteIncoming) => void;
  onInviteAccepted: (info: InviteOutcome) => void;
  onInviteDeclined: (info: InviteOutcome) => void;
  onLog?: (line: string) => void;
};

type JoinResult = { ok: true } | { ok: false; reason: string };

export class LobbyClient {
  private channel: Channel;
  private events: LobbyEvents;

  constructor(socket: Socket, events: LobbyEvents) {
    this.channel = socket.channel("lobby:global", {});
    this.events = events;
  }

  connect(): Promise<JoinResult> {
    return new Promise((resolve) => {
      const joinRef = this.channel.join();

      joinRef.receive("ok", () => {
        this.events.onLog?.("🏛️ lobby:global join ok");

        // Presence: lista de user_ids (keys)
        this.channel.on("presence_state", (state: PresenceState) => {
          this.events.onUsers(Object.keys(state));
        });

        // Convites
        this.channel.on("invite:incoming", (payload: InvitePayload) => {
          // backend manda: {from, to, room_code}
          const incoming: InviteIncoming = {
            from_user_id: payload.from || payload.from_user_id || "",
            room_code: payload.room_code,
            room_name: payload.room_name,
          };
          this.events.onInviteIncoming(incoming);
        });

        this.channel.on("invite:accepted", (payload: InviteAcceptPayload) => {
          this.events.onInviteAccepted({
            by_user_id: payload.from || payload.by_user_id || "",
            room_code: payload.room_code,
          });
        });

        this.channel.on("invite:declined", (payload: InviteAcceptPayload) => {
          this.events.onInviteDeclined({
            by_user_id: payload.from || payload.by_user_id || "",
            room_code: payload.room_code,
          });
        });

        resolve({ ok: true });
      });

      joinRef.receive("error", (e: unknown) => {
        resolve({ ok: false, reason: JSON.stringify(e) });
      });

      joinRef.receive("timeout", () => {
        resolve({ ok: false, reason: "timeout" });
      });
    });
  }

  invite(toUserId: string, roomCode: string): void {
    // ✅ chaves alinhadas com backend: to / room_code
    const push = this.channel.push("invite:send", {
      to: toUserId,
      room_code: roomCode,
    });

    push.receive("ok", () => this.events.onLog?.("📨 convite enviado"));
    push.receive("error", (e: unknown) =>
      this.events.onLog?.(`❌ convite erro: ${JSON.stringify(e)}`),
    );
    push.receive("timeout", () => this.events.onLog?.("⏳ convite timeout"));
  }

  acceptInvite(fromUserId: string, roomCode: string): void {
    const push = this.channel.push("invite:accept", {
      to: fromUserId,
      room_code: roomCode,
    });

    push.receive("ok", () => this.events.onLog?.("✅ aceite enviado"));
    push.receive("error", (e: unknown) =>
      this.events.onLog?.(`❌ aceite erro: ${JSON.stringify(e)}`),
    );
  }

  declineInvite(fromUserId: string, roomCode: string): void {
    const push = this.channel.push("invite:decline", {
      to: fromUserId,
      room_code: roomCode,
    });

    push.receive("ok", () => this.events.onLog?.("🫷 recusa enviada"));
    push.receive("error", (e: unknown) =>
      this.events.onLog?.(`❌ recusa erro: ${JSON.stringify(e)}`),
    );
  }

  disconnect(): void {
    try {
      this.channel.leave();
    } catch {
      // ignore
    }
  }
}
