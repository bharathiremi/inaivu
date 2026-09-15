"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  otherUser: Profile;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_seen: boolean;
  created_at: string;
};

export default function MessagesPage() {
  const router = useRouter();

  /*
   * IMPORTANT:
   * Keep one Supabase client for this page.
   * Creating a new client on every render causes realtime
   * subscriptions and effects to restart unnecessarily.
   */
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [people, setPeople] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);

  const [selectedUser, setSelectedUser] =
    useState<Profile | null>(null);

  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingUser, setOpeningUser] = useState<string | null>(
    null
  );
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [mobileChat, setMobileChat] = useState(false);

  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const realtimeRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const presenceRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const typingTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingStateRef = useRef(false);

  /*
   * Prevent duplicate URL opening.
   */
  const openedUrlRef = useRef<string | null>(null);

  /*
   * =========================================================
   * AUTH
   * =========================================================
   */

  useEffect(() => {
    let alive = true;

    async function init() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      if (!alive) return;

      setUserId(user.id);

      const { data, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, username, avatar_url"
          )
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        console.error(
          "Profile loading error:",
          profileError
        );
      }

      if (alive && data) {
        setProfile(data);
      }
    }

    init();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  /*
   * =========================================================
   * PEOPLE
   * =========================================================
   */

  const loadPeople = useCallback(async () => {
    if (!userId) return;

    setLoadingPeople(true);

    const { data, error: peopleError } =
      await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url"
        )
        .neq("id", userId)
        .order("full_name", {
          ascending: true,
        });

    if (peopleError) {
      console.error(
        "People loading error:",
        peopleError
      );

      setError("Unable to load people.");
    } else {
      setPeople(data ?? []);
    }

    setLoadingPeople(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;

    loadPeople();
  }, [userId, loadPeople]);

  /*
   * =========================================================
   * CONVERSATIONS
   * =========================================================
   */

  const loadConversations = useCallback(
    async () => {
      if (!userId) return;

      try {
        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", userId);

        if (membershipError) {
          throw membershipError;
        }

        if (!memberships?.length) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const ids = memberships.map(
          (item) => item.conversation_id
        );

        const {
          data: conversationRows,
          error: conversationError,
        } = await supabase
          .from("conversations")
          .select("id, created_at")
          .in("id", ids)
          .order("created_at", {
            ascending: false,
          });

        if (conversationError) {
          throw conversationError;
        }

        const result: Conversation[] = [];

        /*
         * Load conversations.
         * This keeps the existing database structure.
         */
        for (const conversation of
          conversationRows ?? []) {
          const {
            data: members,
            error: membersError,
          } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq(
              "conversation_id",
              conversation.id
            );

          if (membersError) {
            console.error(
              "Conversation members error:",
              membersError
            );
            continue;
          }

          const otherMember =
            members?.find(
              (member) =>
                member.user_id !== userId
            );

          if (!otherMember) continue;

          const {
            data: otherUser,
            error: otherUserError,
          } = await supabase
            .from("profiles")
            .select(
              "id, full_name, username, avatar_url"
            )
            .eq(
              "id",
              otherMember.user_id
            )
            .maybeSingle();

          if (
            otherUserError ||
            !otherUser
          ) {
            continue;
          }

          const {
            data: latest,
            error: latestError,
          } = await supabase
            .from("messages")
            .select(
              "content, created_at"
            )
            .eq(
              "conversation_id",
              conversation.id
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(1);

          if (latestError) {
            console.error(
              "Latest message error:",
              latestError
            );
          }

          const {
            count,
            error: unreadError,
          } = await supabase
            .from("messages")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "conversation_id",
              conversation.id
            )
            .eq("is_seen", false)
            .neq("sender_id", userId);

          if (unreadError) {
            console.error(
              "Unread count error:",
              unreadError
            );
          }

          result.push({
            id: conversation.id,
            otherUser,
            lastMessage:
              latest?.[0]?.content ??
              "Start a conversation",
            lastMessageAt:
              latest?.[0]?.created_at ??
              conversation.created_at,
            unreadCount: count ?? 0,
          });
        }

        setConversations(result);
      } catch (err) {
        console.error(
          "Conversation loading error:",
          err
        );

        setError(
          "Unable to load conversations."
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase, userId]
  );

  useEffect(() => {
    if (!userId) return;

    loadConversations();
  }, [
    userId,
    loadConversations,
  ]);

  /*
   * =========================================================
   * LOAD MESSAGES
   * =========================================================
   */

  const markMessagesSeen = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      try {
        const { error: seenError } =
          await supabase.rpc(
            "mark_conversation_messages_seen",
            {
              p_conversation_id:
                conversationId,
            }
          );

        if (seenError) {
          console.error(
            "Seen RPC error:",
            seenError
          );
          return;
        }

        setMessages((current) =>
          current.map((message) =>
            message.sender_id !== userId
              ? {
                  ...message,
                  is_seen: true,
                }
              : message
          )
        );

        /*
         * Update conversation unread count locally.
         */
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id ===
            conversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                }
              : conversation
          )
        );
      } catch (err) {
        console.error(
          "Mark seen error:",
          err
        );
      }
    },
    [supabase, userId]
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      setError("");

      const {
        data,
        error: messageError,
      } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, is_seen, created_at"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .order("created_at", {
          ascending: true,
        });

      if (messageError) {
        console.error(
          "Message loading error:",
          messageError
        );

        setError(
          messageError.message ||
            "Unable to load messages."
        );
      } else {
        setMessages(data ?? []);

        await markMessagesSeen(
          conversationId
        );
      }

      setLoadingMessages(false);
    },
    [supabase, markMessagesSeen]
  );

  /*
   * =========================================================
   * OPEN USER
   * =========================================================
   */

  async function openPerson(
    person: Profile
  ) {
    if (!userId) return;

    if (openingUser === person.id)
      return;

    setOpeningUser(person.id);
    setError("");

    try {
      const existing =
        conversations.find(
          (conversation) =>
            conversation.otherUser.id ===
            person.id
        );

      if (existing) {
        setSelectedConversationId(
          existing.id
        );

        setSelectedUser(person);
        setMobileChat(true);

        window.history.replaceState(
          null,
          "",
          `/messages?conversationId=${encodeURIComponent(
            existing.id
          )}`
        );

        await loadMessages(existing.id);

        return;
      }

      const {
        data: conversationId,
        error: rpcError,
      } = await supabase.rpc(
        "get_or_create_direct_conversation",
        {
          other_user_id: person.id,
        }
      );

      if (rpcError) {
        throw new Error(
          rpcError.message
        );
      }

      if (!conversationId) {
        throw new Error(
          "Conversation ID was not returned."
        );
      }

      setSelectedConversationId(
        conversationId
      );

      setSelectedUser(person);
      setMobileChat(true);

      window.history.replaceState(
        null,
        "",
        `/messages?conversationId=${encodeURIComponent(
          conversationId
        )}`
      );

      await loadMessages(
        conversationId
      );

      await loadConversations();
    } catch (err) {
      console.error(
        "Open conversation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to open conversation."
      );
    } finally {
      setOpeningUser(null);
    }
  }

  /*
   * =========================================================
   * URL OPENING
   * =========================================================
   */

  useEffect(() => {
    if (!userId || !people.length)
      return;

    const params = new URLSearchParams(
      window.location.search
    );

    const targetId =
      params.get("userId");

    if (!targetId) return;

    if (
      openedUrlRef.current ===
      `user:${targetId}`
    ) {
      return;
    }

    const target = people.find(
      (person) =>
        person.id === targetId
    );

    if (target) {
      openedUrlRef.current =
        `user:${targetId}`;

      openPerson(target);
    }
  }, [userId, people]);

  useEffect(() => {
    if (!userId || !conversations.length)
      return;

    const params = new URLSearchParams(
      window.location.search
    );

    const conversationId =
      params.get("conversationId");

    if (!conversationId) return;

    if (
      openedUrlRef.current ===
      `conversation:${conversationId}`
    ) {
      return;
    }

    const conversation =
      conversations.find(
        (item) =>
          item.id === conversationId
      );

    if (!conversation) return;

    openedUrlRef.current =
      `conversation:${conversationId}`;

    setSelectedConversationId(
      conversation.id
    );

    setSelectedUser(
      conversation.otherUser
    );

    setMobileChat(true);
  }, [userId, conversations]);

  /*
   * =========================================================
   * SELECTED CHAT
   * =========================================================
   */

  useEffect(() => {
    if (!selectedConversationId)
      return;

    loadMessages(
      selectedConversationId
    );
  }, [
    selectedConversationId,
    loadMessages,
  ]);

  /*
   * =========================================================
   * AUTO SCROLL
   * =========================================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages.length,
    isOtherTyping,
  ]);

  /*
   * =========================================================
   * REALTIME MESSAGES
   * =========================================================
   */

  useEffect(() => {
    if (!userId) return;

    if (realtimeRef.current) {
      supabase.removeChannel(
        realtimeRef.current
      );
    }

    const channel = supabase
      .channel(
        `inaivu-chat-${userId}-${selectedConversationId ?? "none"}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const message =
            payload.new as Message;

          /*
           * Message belongs to another
           * conversation.
           */
          if (
            message.conversation_id !==
            selectedConversationId
          ) {
            await loadConversations();
            return;
          }

          setMessages((current) => {
            if (
              current.some(
                (item) =>
                  item.id ===
                  message.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              message,
            ];
          });

          /*
           * Incoming message:
           * immediately mark it as seen
           * if this chat is open.
           */
          if (
            message.sender_id !== userId
          ) {
            await markMessagesSeen(
              message.conversation_id
            );
          }

          await loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updated =
            payload.new as Message;

          if (
            updated.conversation_id !==
            selectedConversationId
          ) {
            return;
          }

          setMessages((current) =>
            current.map((message) =>
              message.id ===
              updated.id
                ? updated
                : message
            )
          );
        }
      )
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      supabase.removeChannel(
        channel
      );

      realtimeRef.current = null;
    };
  }, [
    userId,
    selectedConversationId,
    supabase,
    loadConversations,
    markMessagesSeen,
  ]);

  /*
   * =========================================================
   * REALTIME PRESENCE + TYPING
   * =========================================================
   */

  useEffect(() => {
    if (
      !userId ||
      !selectedConversationId ||
      !selectedUser
    ) {
      return;
    }

    if (presenceRef.current) {
      supabase.removeChannel(
        presenceRef.current
      );
    }

    setIsOtherOnline(false);
    setIsOtherTyping(false);
    typingStateRef.current = false;

    const channel = supabase.channel(
      `presence-conversation-${selectedConversationId}`,
      {
        config: {
          presence: {
            key: userId,
          },
          broadcast: {
            self: false,
          },
        },
      }
    );

    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        () => {
          const state =
            channel.presenceState();

          const other =
            state[selectedUser.id];

          setIsOtherOnline(
            Boolean(other?.length)
          );
        }
      )
      .on(
        "presence",
        {
          event: "join",
        },
        ({ key }) => {
          if (
            key === selectedUser.id
          ) {
            setIsOtherOnline(true);
          }
        }
      )
      .on(
        "presence",
        {
          event: "leave",
        },
        ({ key }) => {
          if (
            key === selectedUser.id
          ) {
            setIsOtherOnline(false);
            setIsOtherTyping(false);
          }
        }
      )
      .on(
        "broadcast",
        {
          event: "typing",
        },
        ({ payload }) => {
          if (
            payload?.userId !==
            selectedUser.id
          ) {
            return;
          }

          setIsOtherTyping(
            Boolean(payload.typing)
          );
        }
      )
      .subscribe(
        async (status) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            try {
              await channel.track({
                userId,
                online_at:
                  new Date().toISOString(),
              });
            } catch (err) {
              console.error(
                "Presence track error:",
                err
              );
            }
          }
        }
      );

    presenceRef.current = channel;

    return () => {
      supabase.removeChannel(
        channel
      );

      presenceRef.current = null;

      setIsOtherOnline(false);
      setIsOtherTyping(false);

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingStateRef.current =
        false;
    };
  }, [
    userId,
    selectedConversationId,
    selectedUser,
    supabase,
  ]);

  /*
   * =========================================================
   * TYPING BROADCAST
   * =========================================================
   */

  async function broadcastTyping(
    typing: boolean
  ) {
    if (
      !presenceRef.current ||
      !userId
    ) {
      return;
    }

    try {
      await presenceRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          typing,
        },
      });
    } catch (err) {
      console.error(
        "Typing broadcast error:",
        err
      );
    }
  }

  function handleMessageChange(
    value: string
  ) {
    setMessageText(value);

    const hasText =
      value.trim().length > 0;

    if (hasText) {
      if (
        !typingStateRef.current
      ) {
        typingStateRef.current =
          true;

        void broadcastTyping(true);
      }

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingTimeoutRef.current =
        setTimeout(() => {
          typingStateRef.current =
            false;

          void broadcastTyping(
            false
          );
        }, 1800);
    } else {
      if (
        typingStateRef.current
      ) {
        typingStateRef.current =
          false;

        void broadcastTyping(
          false
        );
      }

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );

        typingTimeoutRef.current =
          null;
      }
    }
  }

  /*
   * =========================================================
   * SEND MESSAGE
   * =========================================================
   */

  async function sendMessage() {
    const text =
      messageText.trim();

    if (
      !text ||
      !userId ||
      !selectedConversationId ||
      sending
    ) {
      return;
    }

    setSending(true);
    setError("");

    if (
      typingTimeoutRef.current
    ) {
      clearTimeout(
        typingTimeoutRef.current
      );

      typingTimeoutRef.current =
        null;
    }

    typingStateRef.current =
      false;

    await broadcastTyping(false);

    try {
      const {
        data,
        error: sendError,
      } = await supabase
        .from("messages")
        .insert({
          conversation_id:
            selectedConversationId,
          sender_id: userId,
          content: text,
        })
        .select(
          "id, conversation_id, sender_id, content, is_seen, created_at"
        )
        .single();

      if (sendError) {
        throw new Error(
          sendError.message
        );
      }

      if (!data) {
        throw new Error(
          "Message was not returned."
        );
      }

      /*
       * Optimistic/local message update.
       */
      setMessages((current) => {
        if (
          current.some(
            (item) =>
              item.id === data.id
          )
        ) {
          return current;
        }

        return [
          ...current,
          data,
        ];
      });

      setMessageText("");

      /*
       * =====================================================
       * MESSAGE NOTIFICATION
       * =====================================================
       *
       * IMPORTANT:
       * Do NOT add a "message" column here.
       *
       * The notification is separate from the
       * actual message content.
       */

      if (
        selectedUser &&
        selectedUser.id !== userId
      ) {
        const {
          error: notificationError,
        } = await supabase
          .from("notifications")
          .insert({
            recipient_id:
              selectedUser.id,
            actor_id: userId,
            type: "message",
            is_read: false,
          });

        if (notificationError) {
          /*
           * Do not make message sending fail
           * just because notification failed.
           */
          console.error(
            "MESSAGE NOTIFICATION ERROR:",
            {
              code:
                notificationError.code ??
                null,
              message:
                notificationError.message ??
                null,
              details:
                notificationError.details ??
                null,
              hint:
                notificationError.hint ??
                null,
            }
          );
        }
      }

      /*
       * Update current conversation preview
       * without waiting for another page load.
       */
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id ===
          selectedConversationId
            ? {
                ...conversation,
                lastMessage: text,
                lastMessageAt:
                  data.created_at,
              }
            : conversation
        )
      );

      /*
       * Refresh conversation metadata once.
       */
      await loadConversations();
    } catch (err) {
      console.error(
        "SEND MESSAGE ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Message could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  /*
   * =========================================================
   * ENTER
   * =========================================================
   */

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      void sendMessage();
    }
  }

  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const searchValue =
    search.trim().toLowerCase();

  const filteredPeople =
    people.filter((person) => {
      if (!searchValue) return true;

      return (
        person.full_name
          ?.toLowerCase()
          .includes(searchValue) ||
        person.username
          ?.toLowerCase()
          .includes(searchValue)
      );
    });

  const filteredConversations =
    conversations.filter(
      (conversation) => {
        if (!searchValue) return true;

        return (
          conversation.otherUser.full_name
            ?.toLowerCase()
            .includes(searchValue) ||
          conversation.otherUser.username
            ?.toLowerCase()
            .includes(searchValue) ||
          conversation.lastMessage
            ?.toLowerCase()
            .includes(searchValue)
        );
      }
    );

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  function initials(name: string) {
    if (!name) return "?";

    const parts =
      name.trim().split(/\s+/);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 1)
        .toUpperCase();
    }

    return (
      parts[0].slice(0, 1) +
      parts[
        parts.length - 1
      ].slice(0, 1)
    ).toUpperCase();
  }

  function formatTime(
    value: string
  ) {
    return new Date(
      value
    ).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function avatar(
    person: Profile,
    size = 48
  ) {
    if (person.avatar_url) {
      return (
        <img
          src={person.avatar_url}
          alt={
            person.full_name ||
            "Inaivu user"
          }
          className="avatar-img"
          style={{
            width: size,
            height: size,
          }}
        />
      );
    }

    return (
      <div
        className="avatar"
        style={{
          width: size,
          height: size,
        }}
      >
        {initials(
          person.full_name
        )}
      </div>
    );
  }

  /*
   * =========================================================
   * CLOSE CHAT
   * =========================================================
   */

  function closeMobileChat() {
    if (
      typingStateRef.current
    ) {
      typingStateRef.current =
        false;

      void broadcastTyping(false);
    }

    if (
      typingTimeoutRef.current
    ) {
      clearTimeout(
        typingTimeoutRef.current
      );

      typingTimeoutRef.current =
        null;
    }

    setMobileChat(false);
    setSelectedUser(null);
    setSelectedConversationId(null);
    setMessages([]);
    setIsOtherOnline(false);
    setIsOtherTyping(false);

    openedUrlRef.current = null;

    window.history.replaceState(
      null,
      "",
      "/messages"
    );
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="loading-page">
        <div className="spinner" />
        <p>Loading messages...</p>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 14px;
            background: #f8f5ef;
            color: #6f675f;
          }

          .spinner {
            width: 38px;
            height: 38px;
            border: 3px solid #eadfd4;
            border-top-color: #ef704d;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          :global(html.dark) .loading-page {
            background: #151412;
            color: #bdb4ac;
          }

          :global(html.dark) .spinner {
            border-color: #38322d;
            border-top-color: #ef704d;
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <main className="page">
      <div
        className={`shell ${
          mobileChat
            ? "mobile-chat-open"
            : ""
        }`}
      >
        <aside
          className={`sidebar ${
            mobileChat
              ? "mobile-hide"
              : ""
          }`}
        >
          <div className="sidebar-header">
            <button
              className="back-home"
              onClick={() =>
                router.push("/")
              }
            >
              ←
            </button>

            <div>
              <h1>Messages</h1>
              <p>
                Connect with people
              </p>
            </div>
          </div>

          <div className="search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search people..."
            />
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <div className="section">
            <div className="section-title">
              Chats
            </div>

            {filteredConversations.length ===
            0 ? (
              <div className="empty-small">
                No conversations yet
              </div>
            ) : (
              filteredConversations.map(
                (conversation) => (
                  <button
                    key={
                      conversation.id
                    }
                    className={`conversation ${
                      selectedConversationId ===
                      conversation.id
                        ? "active"
                        : ""
                    }`}
                    onClick={async () => {
                      setSelectedConversationId(
                        conversation.id
                      );

                      setSelectedUser(
                        conversation.otherUser
                      );

                      setMobileChat(true);

                      window.history.replaceState(
                        null,
                        "",
                        `/messages?conversationId=${encodeURIComponent(
                          conversation.id
                        )}`
                      );

                      openedUrlRef.current =
                        `conversation:${conversation.id}`;

                      await loadMessages(
                        conversation.id
                      );
                    }}
                  >
                    {avatar(
                      conversation.otherUser
                    )}

                    <div className="conversation-info">
                      <div className="conversation-top">
                        <strong>
                          {
                            conversation
                              .otherUser
                              .full_name
                          }
                        </strong>

                        <span>
                          {formatTime(
                            conversation.lastMessageAt
                          )}
                        </span>
                      </div>

                      <div className="conversation-bottom">
                        <p>
                          {
                            conversation.lastMessage
                          }
                        </p>

                        {conversation.unreadCount >
                          0 && (
                          <b>
                            {
                              conversation.unreadCount
                            }
                          </b>
                        )}
                      </div>
                    </div>
                  </button>
                )
              )
            )}
          </div>

          <div className="section people-section">
            <div className="section-title">
              People
            </div>

            {loadingPeople ? (
              <div className="empty-small">
                Loading people...
              </div>
            ) : filteredPeople.length ===
              0 ? (
              <div className="empty-small">
                No people found
              </div>
            ) : (
              filteredPeople.map(
                (person) => (
                  <button
                    key={person.id}
                    className="person"
                    onClick={() =>
                      openPerson(
                        person
                      )
                    }
                    disabled={
                      openingUser ===
                      person.id
                    }
                  >
                    <div className="avatar-wrap">
                      {avatar(person)}

                      <span
                        className={`online-dot ${
                          isOtherOnline &&
                          selectedUser?.id ===
                            person.id
                            ? "online"
                            : ""
                        }`}
                      />
                    </div>

                    <div className="person-info">
                      <strong>
                        {person.full_name ||
                          "Inaivu user"}
                      </strong>

                      <span>
                        {person.username
                          ? `@${person.username}`
                          : "Start a conversation"}
                      </span>
                    </div>

                    <span className="message-arrow">
                      {openingUser ===
                      person.id
                        ? "..."
                        : "›"}
                    </span>
                  </button>
                )
              )
            )}
          </div>

          {profile && (
            <button
              className="my-profile"
              onClick={() =>
                router.push(
                  `/profile/${profile.id}`
                )
              }
            >
              {avatar(profile, 40)}

              <div>
                <strong>
                  {profile.full_name ||
                    "Your profile"}
                </strong>

                <span>
                  @
                  {profile.username ||
                    "username"}
                </span>
              </div>

              <span>›</span>
            </button>
          )}
        </aside>

        <section
          className={`chat ${
            mobileChat
              ? "mobile-show"
              : ""
          }`}
        >
          {selectedUser ? (
            <>
              <header className="chat-header">
                <button
                  className="mobile-back"
                  onClick={
                    closeMobileChat
                  }
                >
                  ←
                </button>

                <div className="header-avatar-wrap">
                  {avatar(
                    selectedUser,
                    44
                  )}

                  <span
                    className={`header-online-dot ${
                      isOtherOnline
                        ? "online"
                        : ""
                    }`}
                  />
                </div>

                <div className="chat-user">
                  <strong>
                    {selectedUser.full_name ||
                      "Inaivu user"}
                  </strong>

                  <span
                    className={
                      isOtherTyping
                        ? "typing-status"
                        : ""
                    }
                  >
                    {isOtherTyping
                      ? "Typing..."
                      : isOtherOnline
                      ? "Online"
                      : selectedUser.username
                      ? `@${selectedUser.username}`
                      : "Offline"}
                  </span>
                </div>

                <button
                  className="profile-button"
                  onClick={() =>
                    router.push(
                      `/profile/${selectedUser.id}`
                    )
                  }
                >
                  View profile
                </button>
              </header>

              <div className="messages">
                {loadingMessages ? (
                  <div className="message-loading">
                    <div className="spinner" />
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="empty-chat">
                    <div className="empty-icon">
                      💬
                    </div>

                    <h2>
                      Start the conversation
                    </h2>

                    <p>
                      Send your first message
                      to{" "}
                      {
                        selectedUser.full_name
                      }
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="day-label">
                      Today
                    </div>

                    {messages.map(
                      (message) => {
                        const mine =
                          message.sender_id ===
                          userId;

                        return (
                          <div
                            key={
                              message.id
                            }
                            className={`message-row ${
                              mine
                                ? "mine"
                                : "theirs"
                            }`}
                          >
                            <div
                              className={`bubble ${
                                mine
                                  ? "my-bubble"
                                  : "their-bubble"
                              }`}
                            >
                              <div>
                                {
                                  message.content
                                }
                              </div>

                              <div className="message-meta">
                                <span>
                                  {formatTime(
                                    message.created_at
                                  )}
                                </span>

                                {mine && (
                                  <span
                                    className={
                                      message.is_seen
                                        ? "seen"
                                        : "sent"
                                    }
                                    title={
                                      message.is_seen
                                        ? "Seen"
                                        : "Sent"
                                    }
                                  >
                                    {message.is_seen
                                      ? "✓✓"
                                      : "✓"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    {isOtherTyping && (
                      <div className="typing-row">
                        <div className="typing-bubble">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    )}

                    <div
                      ref={
                        messagesEndRef
                      }
                    />
                  </>
                )}
              </div>

              <div className="composer-area">
                <div className="composer">
                  <textarea
                    value={
                      messageText
                    }
                    onChange={(e) =>
                      handleMessageChange(
                        e.target.value
                      )
                    }
                    onKeyDown={
                      handleKeyDown
                    }
                    placeholder="Write a message..."
                    rows={1}
                    disabled={
                      !selectedConversationId ||
                      sending
                    }
                  />

                  <button
                    className="send-button"
                    onClick={() =>
                      void sendMessage()
                    }
                    disabled={
                      !messageText.trim() ||
                      !selectedConversationId ||
                      sending
                    }
                  >
                    {sending
                      ? "..."
                      : "➤"}
                  </button>
                </div>

                <small>
                  Enter to send · Shift +
                  Enter for a new line
                </small>
              </div>
            </>
          ) : (
            <div className="welcome">
              <div className="welcome-icon">
                இ
              </div>

              <h2>
                Welcome to Messages
              </h2>

              <p>
                Choose a conversation
                or start chatting with
                someone new.
              </p>

              <div className="welcome-hint">
                Select a person from the
                left side
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 18px;
          background: #f8f5ef;
          color: #292522;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .shell {
          width: min(1380px, 100%);
          height: calc(100vh - 36px);
          margin: auto;
          display: grid;
          grid-template-columns: 360px 1fr;
          overflow: hidden;
          background: white;
          border: 1px solid #e9e0d6;
          border-radius: 24px;
          box-shadow:
            0 18px 60px
              rgba(73, 53, 36, 0.08);
        }

        .sidebar {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #fffdf9;
          border-right: 1px solid #eee6dc;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 20px 16px;
        }

        .back-home {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 12px;
          background: #fff0e9;
          color: #ef704d;
          font-size: 20px;
          cursor: pointer;
          transition:
            transform 0.15s,
            background 0.15s;
        }

        .back-home:hover {
          transform: translateX(-2px);
          background: #ffe7dd;
        }

        .sidebar-header h1 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.04em;
        }

        .sidebar-header p {
          margin: 3px 0 0;
          color: #999087;
          font-size: 11px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 44px;
          margin: 4px 16px 14px;
          padding: 0 13px;
          border: 1px solid #ebe2d8;
          border-radius: 13px;
          background: #f8f4ee;
        }

        .search-box span {
          color: #958b82;
          font-size: 22px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #302b27;
          font: inherit;
          font-size: 13px;
        }

        .search-box input::placeholder {
          color: #aaa097;
        }

        .section {
          padding: 0 9px;
        }

        .section-title {
          padding: 8px 10px;
          color: #a09991;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .conversation,
        .person {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px;
          border: 0;
          border-radius: 14px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s,
            transform 0.15s;
        }

        .conversation:hover,
        .person:hover {
          background: #f8f3ed;
        }

        .conversation:active,
        .person:active {
          transform: scale(0.99);
        }

        .conversation.active {
          background: #fff0e8;
        }

        .conversation:disabled,
        .person:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .avatar-wrap,
        .header-avatar-wrap {
          position: relative;
          flex: 0 0 auto;
        }

        .avatar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ef704d;
          color: white;
          font-size: 13px;
          font-weight: 800;
        }

        .avatar-img {
          flex: 0 0 auto;
          object-fit: cover;
          border-radius: 50%;
        }

        .online-dot {
          position: absolute;
          right: 0;
          bottom: 1px;
          width: 11px;
          height: 11px;
          border: 2px solid #fffdf9;
          border-radius: 50%;
          background: #c5beb7;
          transition:
            background 0.2s,
            transform 0.2s;
        }

        .online-dot.online {
          background: #36b37e;
          transform: scale(1.05);
        }

        .header-online-dot {
          position: absolute;
          right: -1px;
          bottom: 1px;
          width: 12px;
          height: 12px;
          border: 2px solid white;
          border-radius: 50%;
          background: #c5beb7;
        }

        .header-online-dot.online {
          background: #36b37e;
        }

        .conversation-info,
        .person-info {
          min-width: 0;
          flex: 1;
        }

        .conversation-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .conversation-top strong,
        .person-info strong {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 13px;
        }

        .conversation-top span {
          flex: 0 0 auto;
          color: #aaa199;
          font-size: 9px;
        }

        .conversation-bottom {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 3px;
        }

        .conversation-bottom p {
          flex: 1;
          min-width: 0;
          margin: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          color: #91877f;
          font-size: 11px;
        }

        .conversation-bottom b {
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ef704d;
          color: white;
          font-size: 9px;
        }

        .people-section {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          margin-top: 7px;
        }

        .people-section::-webkit-scrollbar,
        .messages::-webkit-scrollbar {
          width: 5px;
        }

        .people-section::-webkit-scrollbar-thumb,
        .messages::-webkit-scrollbar-thumb {
          border-radius: 10px;
          background: #d8cec3;
        }

        .person-info span {
          display: block;
          margin-top: 2px;
          color: #aaa098;
          font-size: 10px;
        }

        .message-arrow {
          color: #aaa098;
          font-size: 20px;
        }

        .my-profile {
          margin: 10px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #eee5db;
          border-radius: 15px;
          background: white;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.15s,
            transform 0.15s;
        }

        .my-profile:hover {
          background: #faf5ef;
        }

        .my-profile:active {
          transform: scale(0.99);
        }

        .my-profile > div {
          min-width: 0;
          flex: 1;
        }

        .my-profile strong,
        .my-profile span {
          display: block;
        }

        .my-profile strong {
          font-size: 12px;
        }

        .my-profile div span {
          margin-top: 2px;
          color: #a0978f;
          font-size: 9px;
        }

        .my-profile > span {
          color: #a0978f;
          font-size: 20px;
        }

        .chat {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #fff;
        }

        .chat-header {
          height: 76px;
          flex: 0 0 76px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 14px 20px;
          border-bottom: 1px solid #eee7df;
        }

        .chat-user {
          min-width: 0;
          flex: 1;
        }

        .chat-user strong {
          display: block;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 14px;
        }

        .chat-user span {
          display: block;
          margin-top: 2px;
          color: #aaa097;
          font-size: 10px;
        }

        .chat-user span.typing-status {
          color: #ef704d;
          font-weight: 700;
        }

        .profile-button {
          padding: 8px 12px;
          border: 1px solid #e9dfd5;
          border-radius: 10px;
          background: white;
          color: #726a63;
          font-size: 10px;
          cursor: pointer;
          transition:
            background 0.15s,
            border 0.15s;
        }

        .profile-button:hover {
          background: #faf5ef;
          border-color: #ddcfc3;
        }

        .mobile-back {
          display: none;
          border: 0;
          background: transparent;
          color: #625a53;
          font-size: 22px;
          cursor: pointer;
        }

        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 26px 8%;
          background:
            radial-gradient(
              circle at top,
              #fffaf5,
              #fff 55%
            );
        }

        .day-label {
          width: fit-content;
          margin: 0 auto 20px;
          padding: 5px 9px;
          border-radius: 8px;
          background: #f6f0e9;
          color: #aaa098;
          font-size: 9px;
        }

        .message-row {
          display: flex;
          margin: 5px 0;
        }

        .message-row.mine {
          justify-content: flex-end;
        }

        .bubble {
          max-width: min(620px, 75%);
          padding: 10px 12px 7px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.45;
          word-break: break-word;
          animation: messageIn 0.16s ease-out;
        }

        @keyframes messageIn {
          from {
            opacity: 0;
            transform: translateY(3px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .my-bubble {
          border-bottom-right-radius: 5px;
          background: #ef704d;
          color: white;
        }

        .their-bubble {
          border-bottom-left-radius: 5px;
          background: #f4eee7;
          color: #3e3833;
        }

        .message-meta {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 4px;
          font-size: 8px;
          opacity: 0.62;
        }

        .sent {
          letter-spacing: -2px;
        }

        .seen {
          letter-spacing: -2px;
          font-weight: 800;
        }

        .typing-row {
          display: flex;
          margin: 7px 0;
        }

        .typing-bubble {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 11px 13px;
          border-radius: 15px;
          border-bottom-left-radius: 5px;
          background: #f4eee7;
        }

        .typing-bubble span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #9c9289;
          animation: typing 1.2s infinite;
        }

        .typing-bubble span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .typing-bubble span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes typing {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.45;
          }

          30% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }

        .empty-chat,
        .welcome {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .empty-icon,
        .welcome-icon {
          width: 82px;
          height: 82px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          border-radius: 27px;
          background: #fff0e8;
          color: #ef704d;
          font-size: 30px;
        }

        .empty-chat h2,
        .welcome h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.04em;
        }

        .empty-chat p,
        .welcome p {
          margin: 7px 0 0;
          color: #9a9189;
          font-size: 12px;
        }

        .welcome-hint {
          margin-top: 18px;
          padding: 9px 12px;
          border-radius: 10px;
          background: #f7f1ea;
          color: #9b9189;
          font-size: 10px;
        }

        .composer-area {
          padding: 12px 6% 15px;
          border-top: 1px solid #eee6de;
          background: white;
        }

        .composer {
          width: min(760px, 100%);
          min-height: 50px;
          margin: auto;
          display: flex;
          align-items: flex-end;
          gap: 7px;
          padding: 6px 7px 6px 12px;
          border: 1px solid #e6ddd3;
          border-radius: 17px;
          background: #fff;
          transition:
            border-color 0.15s,
            box-shadow 0.15s;
        }

        .composer:focus-within {
          border-color: #e7b6a6;
          box-shadow:
            0 0 0 3px
              rgba(239, 112, 77, 0.08);
        }

        .composer textarea {
          flex: 1;
          min-width: 0;
          max-height: 120px;
          padding: 8px 3px;
          resize: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: #332e2a;
          font: inherit;
          font-size: 13px;
        }

        .composer textarea::placeholder {
          color: #aaa097;
        }

        .send-button {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          border: 0;
          border-radius: 12px;
          background: #ef704d;
          color: white;
          font-size: 17px;
          cursor: pointer;
          transition:
            transform 0.15s,
            opacity 0.15s;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .send-button:active:not(:disabled) {
          transform: scale(0.96);
        }

        .send-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .composer-area small {
          display: block;
          width: min(760px, 100%);
          margin: 5px auto 0;
          padding-left: 4px;
          color: #aaa098;
          font-size: 8px;
        }

        .empty-small {
          padding: 18px 10px;
          color: #aaa098;
          text-align: center;
          font-size: 11px;
        }

        .error-box {
          margin: 0 16px 10px;
          padding: 9px 11px;
          border-radius: 10px;
          background: #fff0ed;
          color: #c85236;
          font-size: 10px;
        }

        .message-loading {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #eadfd4;
          border-top-color: #ef704d;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 850px) {
          .page {
            padding: 0;
          }

          .shell {
            width: 100%;
            height: 100vh;
            border: 0;
            border-radius: 0;
            grid-template-columns: 1fr;
          }

          .sidebar.mobile-hide {
            display: none;
          }

          .chat {
            display: none;
          }

          .chat.mobile-show {
            display: flex;
          }

          .mobile-back {
            display: block;
          }

          .messages {
            padding: 22px 15px;
          }

          .composer-area {
            padding-left: 12px;
            padding-right: 12px;
          }

          .bubble {
            max-width: 84%;
          }

          .profile-button {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .sidebar-header {
            padding: 19px 15px 13px;
          }

          .sidebar-header h1 {
            font-size: 21px;
          }

          .search-box {
            margin-left: 12px;
            margin-right: 12px;
          }

          .composer-area small {
            display: none;
          }

          .chat-header {
            padding-left: 13px;
            padding-right: 13px;
          }

          .messages {
            padding-left: 10px;
            padding-right: 10px;
          }

          .bubble {
            max-width: 88%;
          }
        }

        /*
         * =====================================================
         * DARK MODE
         * =====================================================
         */

        :global(html.dark) .page {
          background: #151412;
          color: #f5f0eb;
        }

        :global(html.dark) .shell {
          background: #1d1b19;
          border-color: #302c28;
          box-shadow:
            0 18px 60px
              rgba(0, 0, 0, 0.28);
        }

        :global(html.dark) .sidebar {
          background: #1b1917;
          border-color: #302c28;
        }

        :global(html.dark) .back-home {
          background: #30221d;
          color: #ef8a6d;
        }

        :global(html.dark) .back-home:hover {
          background: #3b2821;
        }

        :global(html.dark) .sidebar-header p,
        :global(html.dark) .section-title {
          color: #918880;
        }

        :global(html.dark) .search-box {
          background: #24211f;
          border-color: #38322d;
        }

        :global(html.dark) .search-box input {
          color: #f5f0eb;
        }

        :global(html.dark) .search-box input::placeholder {
          color: #817970;
        }

        :global(html.dark) .conversation:hover,
        :global(html.dark) .person:hover {
          background: #292521;
        }

        :global(html.dark) .conversation.active {
          background: #35251f;
        }

        :global(html.dark) .conversation-top span,
        :global(html.dark) .conversation-bottom p,
        :global(html.dark) .person-info span {
          color: #817970;
        }

        :global(html.dark) .message-arrow {
          color: #817970;
        }

        :global(html.dark) .chat {
          background: #181715;
        }

        :global(html.dark) .chat-header,
        :global(html.dark) .composer-area {
          background: #1b1917;
          border-color: #302c28;
        }

        :global(html.dark) .chat-user span {
          color: #8f867e;
        }

        :global(html.dark) .messages {
          background:
            radial-gradient(
              circle at top,
              #211d1a,
              #181715 58%
            );
        }

        :global(html.dark) .day-label {
          background: #292521;
          color: #8e857d;
        }

        :global(html.dark) .their-bubble,
        :global(html.dark) .typing-bubble {
          background: #2b2825;
          color: #f3eee8;
        }

        :global(html.dark) .composer {
          background: #24211f;
          border-color: #3a342f;
        }

        :global(html.dark) .composer:focus-within {
          border-color: #694235;
          box-shadow:
            0 0 0 3px
              rgba(239, 112, 77, 0.12);
        }

        :global(html.dark) .composer textarea {
          color: #f5f0eb;
        }

        :global(html.dark) .welcome-hint,
        :global(html.dark) .empty-icon,
        :global(html.dark) .welcome-icon {
          background: #30221d;
        }

        :global(html.dark) .empty-chat p,
        :global(html.dark) .welcome p {
          color: #8f867e;
        }

        :global(html.dark) .profile-button {
          background: #24211f;
          border-color: #3a342f;
          color: #ddd5cd;
        }

        :global(html.dark) .profile-button:hover {
          background: #2b2724;
        }

        :global(html.dark) .my-profile {
          background: #24211f;
          border-color: #38322d;
        }

        :global(html.dark) .my-profile:hover {
          background: #2b2724;
        }

        :global(html.dark) .my-profile div span {
          color: #817970;
        }

        :global(html.dark) .online-dot {
          border-color: #1b1917;
        }

        :global(html.dark) .header-online-dot {
          border-color: #1b1917;
        }

        :global(html.dark) .error-box {
          background: #38231f;
          color: #ef8f77;
        }

        :global(html.dark) .empty-small {
          color: #817970;
        }

        :global(html.dark) .composer-area small {
          color: #817970;
        }

        :global(html.dark) .messages::-webkit-scrollbar-thumb,
        :global(html.dark) .people-section::-webkit-scrollbar-thumb {
          background: #413a34;
        }
      `}</style>
    </main>
  );
}