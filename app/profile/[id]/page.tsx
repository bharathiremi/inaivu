"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Profile = {
  id: string;
  username: string | null;
  full_name: string;
  bio: string;
  avatar_url: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
  media_url: string | null;
  media_type: string | null;
};

export default function OtherProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const profileId = params.id;

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!profileId) return;

    let mounted = true;

    async function start() {
      const authResult = await supabase.auth.getUser();

      if (!authResult.data.user) {
        router.push("/login");
        return;
      }

      const me = authResult.data.user.id;

      if (me === profileId) {
        router.replace("/profile");
        return;
      }

      if (!mounted) return;

      setCurrentUserId(me);

      await Promise.all([
        loadProfile(profileId),
        loadPosts(profileId),
        loadFollowCounts(profileId),
        checkFollowing(me, profileId),
      ]);

      if (mounted) {
        setLoading(false);
      }
    }

    start();

    const channel = supabase
      .channel(`profile-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `user_id=eq.${profileId}`,
        },
        () => {
          loadPosts(profileId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
        },
        () => {
          loadFollowCounts(profileId);
          checkFollowing();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [profileId, router]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function loadProfile(id: string) {
    const result = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url",
      )
      .eq("id", id)
      .maybeSingle();

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    if (result.data) {
      const data = result.data as Profile;
      setProfile(data);
    } else {
      setProfile(null);
    }
  }

  async function loadPosts(id: string) {
    const result = await supabase
      .from("posts")
      .select(
        "id, user_id, content, image_url, created_at, updated_at, media_url, media_type",
      )
      .eq("user_id", id)
      .order("created_at", {
        ascending: false,
      });

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    const rows = (result.data ?? []) as Post[];

    setPosts(rows);
  }

  async function loadFollowCounts(id: string) {
    const followersResult = await supabase
      .from("follows")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("following_id", id);

    const followingResult = await supabase
      .from("follows")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("follower_id", id);

    setFollowers(followersResult.count ?? 0);
    setFollowing(followingResult.count ?? 0);
  }

  async function checkFollowing(
    me?: string,
    target?: string,
  ) {
    const myId = me ?? currentUserId;
    const targetId = target ?? profileId;

    if (!myId || !targetId) return;

    const result = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", myId)
      .eq("following_id", targetId)
      .maybeSingle();

    if (result.error) {
      return;
    }

    setIsFollowing(Boolean(result.data));
  }

  async function toggleFollow() {
    if (
      !currentUserId ||
      !profileId ||
      actionLoading
    ) {
      return;
    }

    setActionLoading(true);

    if (isFollowing) {
      const result = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profileId);

      if (result.error) {
        setNotice(result.error.message);
        setActionLoading(false);
        return;
      }

      setIsFollowing(false);

      setFollowers((value) =>
        Math.max(0, value - 1),
      );
    } else {
      const result = await supabase
        .from("follows")
        .insert({
          follower_id: currentUserId,
          following_id: profileId,
        });

      if (result.error) {
        if (result.error.code === "23505") {
          setIsFollowing(true);
        } else {
          setNotice(result.error.message);
        }

        setActionLoading(false);
        return;
      }

      setIsFollowing(true);
      setFollowers((value) => value + 1);
    }

    setActionLoading(false);
  }

  function openChat() {
    router.push(`/chat/${profileId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f5ef]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef704d] text-xl font-black text-white">
              இ
            </div>

            <p className="mt-4 text-sm font-semibold text-[#84766e]">
              Loading profile...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f8f5ef] px-4">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md rounded-[2rem] border border-[#e8ddd3] bg-[#fffdf9] p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0e9] text-2xl">
              ?
            </div>

            <h1 className="mt-5 text-xl font-black">
              Profile not found
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#8d7f77]">
              This profile may no longer be available.
            </p>

            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white"
            >
              Go home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const displayName =
    profile.full_name ||
    profile.username ||
    "Inaivu User";

  const username = profile.username
    ? `@${profile.username}`
    : "@inaivu";

  return (
    <main className="min-h-screen bg-[#f8f5ef] pb-24 text-[#27221f]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#e8ddd3] bg-[#fffdf9]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef704d] text-lg font-black text-white">
              இ
            </div>

            <div className="hidden sm:block">
              <div className="text-lg font-black">
                Inaivu
              </div>

              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a09289]">
                Connect naturally
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                router.push("/notifications")
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8ddd3] bg-white text-lg transition hover:bg-[#fff0e9]"
            >
              ♡
            </button>

            <button
              onClick={() => router.push("/messages")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8ddd3] bg-white text-lg transition hover:bg-[#fff0e9]"
            >
              ✦
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* PROFILE */}
        <section className="overflow-hidden rounded-[2rem] border border-[#e8ddd3] bg-[#fffdf9] shadow-sm">
          {/* COVER ONLY IS CLIPPED */}
          <div className="relative z-0 h-36 overflow-hidden bg-[#ef704d] sm:h-48">
            <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#f6c95f]/40" />

            <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-white/10" />

            <div className="absolute bottom-5 left-6">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
                Inaivu member
              </p>
            </div>
          </div>

          {/* PROFILE CONTENT */}
          <div className="relative z-10 px-5 pb-7 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              {/* DP */}
              <div className="relative z-30 -mt-14 sm:-mt-16">
                <div className="rounded-full bg-[#fffdf9] p-1.5 shadow-xl">
                  <Avatar profile={profile} />
                </div>
              </div>

              {/* BUTTONS */}
              <div className="relative z-20 flex gap-2 sm:pb-1">
                <button
                  onClick={openChat}
                  className="rounded-full border border-[#e8ddd3] bg-white px-5 py-2.5 text-sm font-bold text-[#554b45] transition hover:bg-[#fff0e9]"
                >
                  Message
                </button>

                <button
                  onClick={toggleFollow}
                  disabled={actionLoading}
                  className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
                    isFollowing
                      ? "border border-[#e8ddd3] bg-white text-[#554b45]"
                      : "bg-[#ef704d] text-white hover:bg-[#dd6040]"
                  } ${
                    actionLoading
                      ? "cursor-not-allowed opacity-60"
                      : ""
                  }`}
                >
                  {actionLoading
                    ? "..."
                    : isFollowing
                      ? "Following"
                      : "Follow"}
                </button>
              </div>
            </div>

            {/* NAME */}
            <div className="mt-4">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {displayName}
              </h1>

              <p className="mt-1 text-sm font-semibold text-[#9a8b82]">
                {username}
              </p>
            </div>

            {/* BIO */}
            {profile.bio && (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#615650]">
                {profile.bio}
              </p>
            )}

            {/* STATS */}
            <div className="mt-6 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-[#e8ddd3] bg-[#faf7f2]">
              <Stat
                value={posts.length}
                label="Posts"
              />

              <Stat
                value={followers}
                label="Followers"
              />

              <Stat
                value={following}
                label="Following"
              />
            </div>
          </div>
        </section>

        {/* POSTS */}
        <section className="mt-7">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef704d]">
              Shared moments
            </p>

            <h2 className="mt-1 text-xl font-black">
              Posts by {displayName}
            </h2>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-[2rem] border border-[#e8ddd3] bg-[#fffdf9] p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0e9] text-2xl">
                ✨
              </div>

              <h3 className="mt-4 text-lg font-black">
                No posts yet
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8d7f77]">
                {displayName} has not shared anything
                yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                />
              ))}
            </div>
          )}
        </section>

        {/* MESSAGE CTA */}
        <section className="mt-7 rounded-[2rem] border border-[#e8ddd3] bg-[#fffdf9] p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">
                Start a conversation
              </p>

              <p className="mt-1 text-xs leading-5 text-[#93857c]">
                Send a private message to {displayName}.
              </p>
            </div>

            <button
              onClick={openChat}
              className="rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#dd6040]"
            >
              Send message
            </button>
          </div>
        </section>
      </div>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e8ddd3] bg-[#fffdf9] px-3 py-2 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <MobileNav
            icon="⌂"
            label="Home"
            onClick={() => router.push("/")}
          />

          <MobileNav
            icon="✦"
            label="Messages"
            onClick={() => router.push("/messages")}
          />

          <button
            onClick={() => router.push("/")}
            className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl font-light text-white shadow-lg"
          >
            +
          </button>

          <MobileNav
            icon="♡"
            label="Alerts"
            onClick={() =>
              router.push("/notifications")
            }
          />

          <MobileNav
            icon="●"
            label="Profile"
            onClick={() => router.push("/profile")}
          />
        </div>
      </nav>

      {/* NOTICE */}
      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2">
          <div className="max-w-[90vw] rounded-full bg-[#292522] px-5 py-3 text-sm font-semibold text-white shadow-xl">
            {notice}
          </div>
        </div>
      )}
    </main>
  );
}

function Avatar({
  profile,
}: {
  profile: Profile;
}) {
  const initial =
    profile.full_name?.charAt(0)?.toUpperCase() ||
    profile.username?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#f6c95f] text-3xl font-black text-[#4c362d] sm:h-32 sm:w-32">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.full_name || "User"}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </div>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="border-r border-[#e8ddd3] py-4 text-center last:border-r-0">
      <div className="text-lg font-black">
        {value}
      </div>

      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9a8b82]">
        {label}
      </div>
    </div>
  );
}

function PostCard({
  post,
}: {
  post: Post;
}) {
  if (
    post.media_url &&
    post.media_type === "image"
  ) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-2xl bg-[#eee8e1]">
        <img
          src={post.media_url}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        {post.content && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
            <p className="line-clamp-2 text-xs font-medium text-white">
              {post.content}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (
    post.media_url &&
    post.media_type === "video"
  ) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#282421]">
        <video
          src={post.media_url}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
          ▶
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-square flex-col justify-between rounded-2xl border border-[#e8ddd3] bg-[#fffdf9] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ef704d]">
        Inaivu
      </div>

      <p className="line-clamp-7 text-sm font-semibold leading-6 text-[#4c443e]">
        {post.content || "Shared a moment."}
      </p>

      <p className="text-[10px] text-[#a09289]">
        {timeAgo(post.created_at)}
      </p>
    </div>
  );
}

function MobileNav({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-4 py-1 text-[#776b63]"
    >
      <span className="text-lg">
        {icon}
      </span>

      <span className="text-[10px] font-bold">
        {label}
      </span>
    </button>
  );
}

function timeAgo(value: string) {
  const date = new Date(value);
  const now = new Date();

  const seconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000,
  );

  if (seconds < 60) {
    return "Just now";
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return date.toLocaleDateString();
}