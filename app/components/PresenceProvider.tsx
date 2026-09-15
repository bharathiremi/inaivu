"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

type PresenceUser = {
  user_id: string;
  online_at: string;
};

type PresenceContextType = {
  onlineUsers: Record<string, PresenceUser>;
  isOnline: (userId: string) => boolean;
  getLastSeen: (userId: string) => string | null;
};

const PresenceContext =
  createContext<PresenceContextType | null>(null);

export function PresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [onlineUsers, setOnlineUsers] =
    useState<Record<string, PresenceUser>>({});

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function startPresence() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      channel = supabase.channel("global-presence", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      const updatePresence = () => {
        if (!channel) return;

        const state = channel.presenceState();

        const users: Record<string, PresenceUser> = {};

        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            const presence =
              entry as Record<string, unknown>;

            if (
              typeof presence.user_id === "string" &&
              typeof presence.online_at === "string"
            ) {
              users[presence.user_id] = {
                user_id: presence.user_id,
                online_at: presence.online_at,
              };
            }
          });
        });

        setOnlineUsers(users);
      };

      channel
        .on(
          "presence",
          {
            event: "sync",
          },
          updatePresence
        )
        .on(
          "presence",
          {
            event: "join",
          },
          updatePresence
        )
        .on(
          "presence",
          {
            event: "leave",
          },
          updatePresence
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel?.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });

            updatePresence();
          }
        });
    }

    startPresence();

    return () => {
      cancelled = true;

      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  function isOnline(userId: string) {
    return Boolean(onlineUsers[userId]);
  }

  function getLastSeen(userId: string) {
    return onlineUsers[userId]?.online_at ?? null;
  }

  return (
    <PresenceContext.Provider
      value={{
        onlineUsers,
        isOnline,
        getLastSeen,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);

  if (!context) {
    throw new Error(
      "usePresence must be used inside PresenceProvider"
    );
  }

  return context;
}