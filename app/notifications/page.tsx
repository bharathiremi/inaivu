"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
};

type ActorProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NotificationItem = NotificationRow & {
  actor: ActorProfile | null;
};

function getNotificationText(type: string) {
  switch (type.toLowerCase()) {
    case "like":
      return "liked your post";

    case "comment":
      return "commented on your post";

    case "follow":
      return "started following you";

    case "message":
      return "sent you a message";

    case "system":
      return "sent you a notification";

    default:
      return "interacted with you";
  }
}

function getNotificationIcon(type: string) {
  switch (type.toLowerCase()) {
    case "like":
      return "♥";

    case "comment":
      return "●";

    case "follow":
      return "+";

    case "message":
      return "✉";

    case "system":
      return "✦";

    default:
      return "•";
  }
}

function getNotificationColor(type: string) {
  switch (type.toLowerCase()) {
    case "like":
      return "like";

    case "comment":
      return "comment";

    case "follow":
      return "follow";

    case "message":
      return "message";

    default:
      return "system";
  }
}

function timeAgo(dateString: string) {
  const created = new Date(dateString).getTime();
  const now = Date.now();

  const seconds = Math.max(
    0,
    Math.floor((now - created) / 1000),
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks}w`;
  }

  return new Date(dateString).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<
    "all" | "unread"
  >("all");

  const [error, setError] = useState("");

  const loadNotifications = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Auth error:", userError);
          throw userError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        /*
         * IMPORTANT
         *
         * We use the exact column names
         * from the actual notifications table.
         */
        const {
          data: notificationData,
          error: notificationError,
        } = await supabase
          .from("notifications")
          .select(
            "id,recipient_id,actor_id,type,post_id,comment_id,is_read,created_at",
          )
          .eq("recipient_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (notificationError) {
          console.error(
            "Notifications database error:",
            notificationError,
          );

          console.error(
            "Notifications database error JSON:",
            JSON.stringify(
              notificationError,
              null,
              2,
            ),
          );

          throw notificationError;
        }

        const rows =
          (notificationData ?? []) as NotificationRow[];

        /*
         * Get all unique actor IDs.
         */
        const actorIds = [
          ...new Set(
            rows
              .map((item) => item.actor_id)
              .filter(
                (id): id is string =>
                  Boolean(id),
              ),
          ),
        ];

        let actors: ActorProfile[] = [];

        if (actorIds.length > 0) {
          const {
            data: actorData,
            error: actorError,
          } = await supabase
            .from("profiles")
            .select(
              "id,username,full_name,avatar_url",
            )
            .in("id", actorIds);

          if (actorError) {
            console.warn(
              "Could not load notification actors:",
              actorError,
            );
          } else {
            actors =
              (actorData ?? []) as ActorProfile[];
          }
        }

        const actorMap = new Map(
          actors.map((actor) => [
            actor.id,
            actor,
          ]),
        );

        const finalNotifications =
          rows.map((notification) => ({
            ...notification,
            actor: notification.actor_id
              ? actorMap.get(
                  notification.actor_id,
                ) ?? null
              : null,
          }));

        setNotifications(
          finalNotifications,
        );
      } catch (err) {
        console.error(
          "Notifications load error:",
          err,
        );

        setError(
          "Unable to load notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  /*
   * Initial load + realtime updates.
   */
  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("inaivu-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadNotifications(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    loadNotifications,
    supabase,
  ]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => !item.is_read,
      ).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter(
        (item) => !item.is_read,
      );
    }

    return notifications;
  }, [filter, notifications]);

  /*
   * Mark one notification as read.
   */
  async function markOneAsRead(
    notification: NotificationItem,
  ) {
    if (notification.is_read) {
      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", notification.id);

    if (updateError) {
      console.error(
        "Mark notification read error:",
        updateError,
      );
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              is_read: true,
            }
          : item,
      ),
    );
  }

  /*
   * Mark all notifications as read.
   */
  async function markAllAsRead() {
    if (unreadCount === 0) {
      return;
    }

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const {
      error: updateError,
    } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (updateError) {
      console.error(
        "Mark all notifications error:",
        updateError,
      );
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
      })),
    );
  }

  /*
   * Delete notification.
   */
  async function deleteNotification(
    notification: NotificationItem,
  ) {
    const {
      error: deleteError,
    } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notification.id);

    if (deleteError) {
      console.error(
        "Delete notification error:",
        deleteError,
      );
      return;
    }

    setNotifications((current) =>
      current.filter(
        (item) =>
          item.id !== notification.id,
      ),
    );
  }

  /*
   * Open notification.
   */
  async function openNotification(
    notification: NotificationItem,
  ) {
    await markOneAsRead(notification);

    const type =
      notification.type.toLowerCase();

    /*
     * Message notification
     */
    if (type === "message") {
      if (notification.actor_id) {
        router.push(
          `/messages?userId=${encodeURIComponent(
            notification.actor_id,
          )}`,
        );
      } else {
        router.push("/messages");
      }

      return;
    }

    /*
     * Post-related notification
     */
    if (notification.post_id) {
      router.push(
        `/home?postId=${encodeURIComponent(
          notification.post_id,
        )}`,
      );

      return;
    }

    /*
     * Follow notification
     */
    if (
      type === "follow" &&
      notification.actor_id
    ) {
      router.push(
        `/profile/${encodeURIComponent(
          notification.actor_id,
        )}`,
      );

      return;
    }
  }

  function getActorName(
    notification: NotificationItem,
  ) {
    if (!notification.actor) {
      return "Someone";
    }

    return (
      notification.actor.full_name?.trim() ||
      notification.actor.username?.trim() ||
      "Someone"
    );
  }

  function getActorUsername(
    notification: NotificationItem,
  ) {
    if (!notification.actor?.username) {
      return "";
    }

    return `@${notification.actor.username}`;
  }

  if (loading) {
    return (
      <>
        <main className="notifications-page loading-page">
          <div className="loading-card">
            <div className="loading-logo">
              இ
            </div>

            <div className="loading-spinner" />

            <p>
              Loading notifications...
            </p>
          </div>
        </main>

        <style jsx global>{`
          .notifications-page.loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f3eb;
            color: #29231f;
          }

          .loading-card {
            text-align: center;
          }

          .loading-logo {
            width: 52px;
            height: 52px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 17px;
            background: #ef704d;
            color: white;
            font-size: 24px;
            font-weight: 900;
          }

          .loading-spinner {
            width: 28px;
            height: 28px;
            margin: 0 auto 12px;
            border: 3px solid #eadfd3;
            border-top-color: #ef704d;
            border-radius: 50%;
            animation: inaivu-notification-spin
              0.8s linear infinite;
          }

          .loading-card p {
            margin: 0;
            color: #81766e;
            font-size: 14px;
            font-weight: 700;
          }

          @keyframes inaivu-notification-spin {
            to {
              transform: rotate(360deg);
            }
          }

          html.dark
            .notifications-page.loading-page {
            background: #171412;
            color: #f7efe7;
          }

          html.dark
            .loading-spinner {
            border-color: #332b26;
            border-top-color: #ef704d;
          }

          html.dark
            .loading-card p {
            color: #aaa09a;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <main className="notifications-page">
        <header className="topbar">
          <button
            className="back-button"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <span>←</span>
          </button>

          <div className="title-area">
            <h1>
              Notifications
            </h1>

            {unreadCount > 0 && (
              <span className="unread-badge">
                {unreadCount}
              </span>
            )}
          </div>

          <button
            className="refresh-button"
            onClick={() =>
              loadNotifications(true)
            }
            disabled={refreshing}
            aria-label="Refresh notifications"
          >
            <span
              className={
                refreshing
                  ? "refresh-spin"
                  : ""
              }
            >
              ↻
            </span>
          </button>
        </header>

        <section className="content">
          <div className="filter-row">
            <div className="filters">
              <button
                className={`filter ${
                  filter === "all"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setFilter("all")
                }
              >
                All
              </button>

              <button
                className={`filter ${
                  filter === "unread"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setFilter("unread")
                }
              >
                Unread

                {unreadCount > 0 && (
                  <span className="filter-count">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                className="mark-all"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <div className="error-card">
              <div className="error-icon">
                !
              </div>

              <div className="error-content">
                <strong>
                  Something went wrong
                </strong>

                <p>{error}</p>
              </div>

              <button
                onClick={() =>
                  loadNotifications()
                }
              >
                Retry
              </button>
            </div>
          )}

          {!error &&
            filteredNotifications.length ===
              0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  ♡
                </div>

                <h2>
                  {filter === "unread"
                    ? "You're all caught up"
                    : "No notifications yet"}
                </h2>

                <p>
                  {filter === "unread"
                    ? "You have no unread notifications."
                    : "When people interact with you, you'll see it here."}
                </p>
              </div>
            )}

          {!error &&
            filteredNotifications.length >
              0 && (
              <div className="notification-list">
                {filteredNotifications.map(
                  (notification) => {
                    const name =
                      getActorName(
                        notification,
                      );

                    const username =
                      getActorUsername(
                        notification,
                      );

                    const typeColor =
                      getNotificationColor(
                        notification.type,
                      );

                    return (
                      <article
                        key={notification.id}
                        className={`notification-card ${
                          notification.is_read
                            ? "read"
                            : "unread"
                        }`}
                        onClick={() =>
                          openNotification(
                            notification,
                          )
                        }
                      >
                        <div className="avatar-wrap">
                          {notification.actor
                            ?.avatar_url ? (
                            <img
                              src={
                                notification
                                  .actor
                                  .avatar_url
                              }
                              alt={name}
                              className="avatar"
                            />
                          ) : (
                            <div className="avatar fallback-avatar">
                              {name
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <span
                            className={`type-icon ${typeColor}`}
                          >
                            {getNotificationIcon(
                              notification.type,
                            )}
                          </span>
                        </div>

                        <div className="notification-body">
                          <div className="notification-line">
                            <span className="actor-name">
                              {name}
                            </span>

                            {username && (
                              <span className="actor-username">
                                {username}
                              </span>
                            )}

                            <span className="notification-text">
                              {getNotificationText(
                                notification.type,
                              )}
                            </span>
                          </div>

                          <div className="notification-meta">
                            <span>
                              {timeAgo(
                                notification.created_at,
                              )}
                            </span>

                            {!notification.is_read && (
                              <span className="new-dot" />
                            )}
                          </div>
                        </div>

                        <button
                          className="delete-button"
                          onClick={(event) => {
                            event.stopPropagation();

                            deleteNotification(
                              notification,
                            );
                          }}
                          aria-label="Delete notification"
                        >
                          ×
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            )}
        </section>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .notifications-page {
          min-height: 100vh;
          background: #f8f3eb;
          color: #29231f;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          height: 76px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 28px;
          background: rgba(
            248,
            243,
            235,
            0.94
          );
          border-bottom: 1px solid #eadfd4;
          backdrop-filter: blur(18px);
        }

        .back-button,
        .refresh-button {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fffaf5;
          color: #453b34;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            background 0.18s ease;
        }

        .back-button:hover,
        .refresh-button:hover {
          transform: translateY(-1px);
          background: #fff1e7;
        }

        .back-button span {
          font-size: 22px;
        }

        .refresh-button {
          margin-left: auto;
          font-size: 23px;
        }

        .refresh-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .refresh-spin {
          display: inline-block;
          animation:
            notification-refresh-spin
            0.7s linear infinite;
        }

        @keyframes notification-refresh-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .title-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .title-area h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .unread-badge {
          min-width: 23px;
          height: 23px;
          padding: 0 7px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ef704d;
          color: white;
          font-size: 11px;
          font-weight: 900;
        }

        .content {
          width: min(
            820px,
            calc(100% - 40px)
          );
          margin: 0 auto;
          padding: 26px 0 80px;
        }

        .filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .filters {
          display: flex;
          gap: 8px;
        }

        .filter {
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #e5d9cd;
          border-radius: 13px;
          background: #fffaf5;
          color: #766b63;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .filter:hover {
          border-color: #efb49f;
        }

        .filter.active {
          border-color: #ef704d;
          background: #ef704d;
          color: white;
        }

        .filter-count {
          margin-left: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.25
          );
          font-size: 10px;
        }

        .mark-all {
          border: 0;
          background: transparent;
          color: #e35f3f;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .notification-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .notification-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 15px;
          min-height: 82px;
          padding: 15px 18px;
          border: 1px solid #e8ddd3;
          border-radius: 20px;
          background: #fffaf5;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease,
            box-shadow 0.18s ease;
        }

        .notification-card:hover {
          transform: translateY(-1px);
          border-color: #efc1ae;
          box-shadow:
            0 8px 24px
            rgba(91, 62, 44, 0.07);
        }

        .notification-card.unread {
          background: #fff5ed;
          border-color: #f0d0c0;
        }

        .notification-card.read {
          opacity: 0.82;
        }

        .avatar-wrap {
          position: relative;
          flex: 0 0 auto;
          width: 50px;
          height: 50px;
        }

        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 17px;
          object-fit: cover;
          display: block;
        }

        .fallback-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1dfd0;
          color: #a5543d;
          font-size: 18px;
          font-weight: 900;
        }

        .type-icon {
          position: absolute;
          right: -5px;
          bottom: -5px;
          width: 23px;
          height: 23px;
          border: 3px solid #fffaf5;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: 900;
        }

        .notification-card.unread
          .type-icon {
          border-color: #fff5ed;
        }

        .type-icon.like {
          background: #e75b62;
        }

        .type-icon.comment {
          background: #e68b48;
        }

        .type-icon.follow {
          background: #4e9b71;
        }

        .type-icon.message {
          background: #5e8fc8;
        }

        .type-icon.system {
          background: #8b70c5;
        }

        .notification-body {
          min-width: 0;
          flex: 1;
        }

        .notification-line {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          column-gap: 5px;
          row-gap: 2px;
          line-height: 1.45;
        }

        .actor-name {
          color: #332b26;
          font-size: 14px;
          font-weight: 900;
        }

        .actor-username {
          color: #9b8e84;
          font-size: 12px;
        }

        .notification-text {
          color: #665c55;
          font-size: 14px;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 4px;
          color: #a09288;
          font-size: 11px;
          font-weight: 700;
        }

        .new-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef704d;
        }

        .delete-button {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #aa9d94;
          font-size: 22px;
          cursor: pointer;
          opacity: 0;
          transition:
            opacity 0.18s ease,
            background 0.18s ease,
            color 0.18s ease;
        }

        .notification-card:hover
          .delete-button {
          opacity: 1;
        }

        .delete-button:hover {
          background: #f7e1d8;
          color: #d85e40;
        }

        .empty-state {
          padding: 90px 24px;
          text-align: center;
        }

        .empty-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 20px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff0e5;
          color: #ef704d;
          font-size: 30px;
        }

        .empty-state h2 {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .empty-state p {
          max-width: 390px;
          margin: 0 auto;
          color: #91857c;
          font-size: 14px;
          line-height: 1.6;
        }

        .error-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px 17px;
          margin-bottom: 16px;
          border: 1px solid #efc8bd;
          border-radius: 17px;
          background: #fff1eb;
        }

        .error-icon {
          width: 35px;
          height: 35px;
          flex: 0 0 auto;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ef704d;
          color: white;
          font-weight: 900;
        }

        .error-content {
          min-width: 0;
        }

        .error-card strong {
          display: block;
          color: #55352b;
          font-size: 13px;
          font-weight: 900;
        }

        .error-card p {
          margin: 3px 0 0;
          color: #876e64;
          font-size: 12px;
        }

        .error-card button {
          margin-left: auto;
          border: 0;
          border-radius: 10px;
          padding: 8px 12px;
          background: #ef704d;
          color: white;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .topbar {
            height: 68px;
            padding: 0 15px;
          }

          .back-button,
          .refresh-button {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .title-area h1 {
            font-size: 19px;
          }

          .content {
            width: calc(100% - 24px);
            padding-top: 16px;
          }

          .filter-row {
            align-items: flex-start;
          }

          .notification-card {
            min-height: 76px;
            padding: 12px;
            gap: 12px;
            border-radius: 17px;
          }

          .avatar-wrap,
          .avatar {
            width: 44px;
            height: 44px;
          }

          .avatar {
            border-radius: 14px;
          }

          .type-icon {
            width: 21px;
            height: 21px;
            right: -4px;
            bottom: -4px;
          }

          .actor-name,
          .notification-text {
            font-size: 13px;
          }

          .actor-username {
            font-size: 11px;
          }

          .delete-button {
            opacity: 1;
            width: 27px;
            height: 27px;
          }

          .error-card {
            align-items: flex-start;
          }
        }

        html.dark
          .notifications-page {
          background: #171412;
          color: #f7efe7;
        }

        html.dark .topbar {
          background: rgba(
            23,
            20,
            18,
            0.94
          );
          border-bottom-color: #302925;
        }

        html.dark
          .back-button,
        html.dark
          .refresh-button {
          background: #211d1a;
          color: #eee3da;
        }

        html.dark .filter {
          border-color: #38302b;
          background: #211d1a;
          color: #aaa099;
        }

        html.dark
          .filter.active {
          border-color: #ef704d;
          background: #ef704d;
          color: white;
        }

        html.dark
          .notification-card {
          border-color: #332c27;
          background: #211d1a;
        }

        html.dark
          .notification-card.unread {
          border-color: #4b332a;
          background: #291f1b;
        }

        html.dark
          .notification-card:hover {
          border-color: #604438;
          box-shadow:
            0 8px 25px
            rgba(0, 0, 0, 0.22);
        }

        html.dark .actor-name {
          color: #f5ebe3;
        }

        html.dark .actor-username {
          color: #8f847c;
        }

        html.dark .notification-text {
          color: #c2b7ae;
        }

        html.dark .notification-meta {
          color: #857970;
        }

        html.dark
          .type-icon {
          border-color: #211d1a;
        }

        html.dark
          .notification-card.unread
          .type-icon {
          border-color: #291f1b;
        }

        html.dark .delete-button:hover {
          background: #3a2823;
          color: #ef8061;
        }

        html.dark .empty-icon {
          background: #30221d;
          color: #ef704d;
        }

        html.dark .empty-state p {
          color: #8e837b;
        }

        html.dark
          .fallback-avatar {
          background: #352a24;
          color: #e98568;
        }

        html.dark .error-card {
          border-color: #55342c;
          background: #2c201c;
        }

        html.dark
          .error-card strong {
          color: #f0d6ca;
        }

        html.dark .error-card p {
          color: #aa8f84;
        }
      `}</style>
    </>
  );
}