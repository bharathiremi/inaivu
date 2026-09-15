import type { RealtimeChannel } from "@supabase/supabase-js";

export type PresenceUser = {
  user_id: string;
  online_at: string;
};

export function getPresenceUsers(
  channel: RealtimeChannel
): PresenceUser[] {
  const state = channel.presenceState();

  const users: PresenceUser[] = [];

  Object.values(state).forEach((entries) => {
    entries.forEach((entry) => {
      const user = entry as Record<string, unknown>;

      if (
        typeof user.user_id === "string" &&
        typeof user.online_at === "string"
      ) {
        users.push({
          user_id: user.user_id,
          online_at: user.online_at,
        });
      }
    });
  });

  return users;
}

export function isUserOnline(
  channel: RealtimeChannel,
  userId: string
): boolean {
  return getPresenceUsers(channel).some(
    (user) => user.user_id === userId
  );
}

export async function trackPresence(
  channel: RealtimeChannel,
  userId: string
) {
  return await channel.track({
    user_id: userId,
    online_at: new Date().toISOString(),
  });
}

export async function untrackPresence(
  channel: RealtimeChannel
) {
  return await channel.untrack();
}