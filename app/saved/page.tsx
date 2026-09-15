"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string;
  avatar_url: string | null;
};

type SavedLoop = {
  id: string;
  content: string;
  media_url: string;
  media_path: string | null;
  created_at: string;
  user_id: string;
  profile: Profile | null;
};

function formatTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;

  return new Date(date).toLocaleDateString();
}

function Avatar({
  profile,
  size = 44,
}: {
  profile: Profile | null;
  size?: number;
}) {
  const name =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "User";

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700"
      style={{
        width: size,
        height: size,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function SavedLoopsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loops, setLoops] = useState<SavedLoop[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const loadSavedLoops = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_loops")
        .select("post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (savedError) {
        throw savedError;
      }

      if (!savedRows || savedRows.length === 0) {
        setLoops([]);
        return;
      }

      const postIds = savedRows.map((row) => row.post_id);

      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          "id, user_id, content, media_url, media_path, media_type, created_at"
        )
        .in("id", postIds)
        .eq("media_type", "video");

      if (postsError) {
        throw postsError;
      }

      const validPosts = (posts || []).filter(
        (post) =>
          typeof post.media_url === "string" &&
          post.media_url.trim().length > 0
      );

      if (validPosts.length === 0) {
        setLoops([]);
        return;
      }

      const userIds = [
        ...new Set(validPosts.map((post) => post.user_id)),
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<string, Profile>();

      (profiles || []).forEach((profile) => {
        profileMap.set(profile.id, profile);
      });

      const savedDateMap = new Map<string, string>();

      savedRows.forEach((row) => {
        savedDateMap.set(row.post_id, row.created_at);
      });

      const orderedLoops: SavedLoop[] = validPosts
        .map((post) => ({
          id: post.id,
          content: post.content || "",
          media_url: post.media_url,
          media_path: post.media_path || null,
          created_at: post.created_at,
          user_id: post.user_id,
          profile: profileMap.get(post.user_id) || null,
        }))
        .sort((a, b) => {
          const aDate = new Date(savedDateMap.get(a.id) || 0).getTime();
          const bDate = new Date(savedDateMap.get(b.id) || 0).getTime();

          return bDate - aDate;
        });

      setLoops(orderedLoops);
    } catch (error: any) {
      console.error("Saved Loops load error:", error);

      setErrorMessage(
        error?.message ||
          "Unable to load your saved Loops. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadSavedLoops();
  }, [loadSavedLoops]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            video
              .play()
              .then(() => {
                setPlayingId(video.dataset.loopId || null);
              })
              .catch(() => {});
          } else {
            video.pause();

            if (video.dataset.loopId === playingId) {
              setPlayingId(null);
            }
          }
        });
      },
      {
        threshold: [0.25, 0.65, 0.9],
      }
    );

    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        observer.observe(video);
      }
    });

    return () => observer.disconnect();
  }, [loops, playingId]);

  async function removeSavedLoop(postId: string) {
    setRemovingId(postId);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase
        .from("saved_loops")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", postId);

      if (error) {
        throw error;
      }

      setLoops((current) =>
        current.filter((loop) => loop.id !== postId)
      );
    } catch (error: any) {
      console.error("Remove saved Loop error:", error);

      setErrorMessage(
        error?.message || "Unable to remove this saved Loop."
      );
    } finally {
      setRemovingId(null);
    }
  }

  async function toggleVideo(postId: string) {
    const video = videoRefs.current[postId];

    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setPlayingId(postId);
      } catch {
        setPlayingId(null);
      }
    } else {
      video.pause();
      setPlayingId(null);
    }
  }

  function getCreatorName(profile: Profile | null) {
    return (
      profile?.full_name?.trim() ||
      profile?.username?.trim() ||
      "Inaivu user"
    );
  }

  function getUsername(profile: Profile | null) {
    if (profile?.username?.trim()) {
      return `@${profile.username}`;
    }

    return "";
  }

  return (
    <>
      <style jsx global>{`
        .saved-page {
          min-height: 100vh;
          background: #fffaf4;
          color: #241b16;
        }

        .saved-header {
          background: rgba(255, 250, 244, 0.94);
          border-bottom: 1px solid #eadfd5;
          backdrop-filter: blur(14px);
        }

        .saved-card {
          background: #ffffff;
          border: 1px solid #eadfd5;
        }

        .saved-muted {
          color: #7d7067;
        }

        .saved-soft {
          background: #fff2e5;
        }

        .saved-button {
          background: #f97316;
          color: white;
        }

        .saved-button:hover {
          background: #ea580c;
        }

        .saved-secondary {
          background: #fff2e5;
          color: #c2410c;
        }

        .saved-secondary:hover {
          background: #ffe4cc;
        }

        html.dark .saved-page {
          background: #11100f;
          color: #f8eee7;
        }

        html.dark .saved-header {
          background: rgba(17, 16, 15, 0.94);
          border-bottom-color: #302923;
        }

        html.dark .saved-card {
          background: #1b1816;
          border-color: #342c26;
        }

        html.dark .saved-muted {
          color: #aa9d93;
        }

        html.dark .saved-soft {
          background: #29211c;
        }

        html.dark .saved-secondary {
          background: #30241d;
          color: #fdba74;
        }

        html.dark .saved-secondary:hover {
          background: #3b2b21;
        }

        .saved-video {
          background: #090909;
        }

        .saved-video::-webkit-media-controls-panel {
          background: linear-gradient(
            transparent,
            rgba(0, 0, 0, 0.72)
          );
        }

        .saved-scroll::-webkit-scrollbar {
          width: 5px;
        }

        .saved-scroll::-webkit-scrollbar-thumb {
          background: #d6c8bd;
          border-radius: 999px;
        }

        html.dark .saved-scroll::-webkit-scrollbar-thumb {
          background: #51463d;
        }
      `}</style>

      <main className="saved-page">
        <header className="saved-header sticky top-0 z-50">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Go back"
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <div>
                <h1 className="text-lg font-bold sm:text-xl">
                  Saved Loops
                </h1>
                <p className="saved-muted text-xs">
                  Your saved videos
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/loop")}
              className="saved-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Browse Loop
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="saved-card overflow-hidden rounded-3xl"
                >
                  <div className="aspect-[9/14] animate-pulse bg-black/5 dark:bg-white/5" />

                  <div className="space-y-3 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-black/5 dark:bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : errorMessage ? (
            <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              <h2 className="font-bold">Something went wrong</h2>

              <p className="saved-muted mt-2 text-sm">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={loadSavedLoops}
                className="saved-button mt-5 rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Try again
              </button>
            </div>
          ) : loops.length === 0 ? (
            <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center text-center">
              <div className="saved-soft mb-5 flex h-20 w-20 items-center justify-center rounded-full">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold sm:text-2xl">
                No saved Loops yet
              </h2>

              <p className="saved-muted mt-2 max-w-sm text-sm leading-6">
                When you find a Loop you want to watch again,
                tap the bookmark icon and it will appear here.
              </p>

              <button
                type="button"
                onClick={() => router.push("/loop")}
                className="saved-button mt-6 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition"
              >
                Explore Loops
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="saved-muted text-sm">
                    {loops.length}{" "}
                    {loops.length === 1 ? "saved Loop" : "saved Loops"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadSavedLoops}
                  className="saved-muted rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {loops.map((loop) => {
                  const creatorName = getCreatorName(loop.profile);
                  const username = getUsername(loop.profile);
                  const isPlaying = playingId === loop.id;
                  const isRemoving = removingId === loop.id;

                  return (
                    <article
                      key={loop.id}
                      className="saved-card overflow-hidden rounded-3xl shadow-sm"
                    >
                      <div className="relative aspect-[9/14] overflow-hidden bg-black">
                        <video
                          ref={(element) => {
                            videoRefs.current[loop.id] = element;
                          }}
                          data-loop-id={loop.id}
                          src={loop.media_url}
                          className="saved-video h-full w-full cursor-pointer object-cover"
                          playsInline
                          loop
                          muted
                          preload="metadata"
                          onClick={() => toggleVideo(loop.id)}
                          onPlay={() => setPlayingId(loop.id)}
                          onPause={() => {
                            if (playingId === loop.id) {
                              setPlayingId(null);
                            }
                          }}
                        />

                        {!isPlaying && (
                          <button
                            type="button"
                            onClick={() => toggleVideo(loop.id)}
                            className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-black/60"
                            aria-label="Play Loop"
                          >
                            <svg
                              width="25"
                              height="25"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M8 5.14v13.72c0 .8.88 1.28 1.54.84l10.28-6.86a1 1 0 0 0 0-1.66L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                            </svg>
                          </button>
                        )}

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 pt-16">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/profile/${loop.user_id}`
                                )
                              }
                              className="shrink-0"
                            >
                              <Avatar
                                profile={loop.profile}
                                size={42}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/profile/${loop.user_id}`
                                )
                              }
                              className="min-w-0 text-left text-white"
                            >
                              <p className="truncate text-sm font-bold">
                                {creatorName}
                              </p>

                              {username && (
                                <p className="truncate text-xs text-white/70">
                                  {username}
                                </p>
                              )}
                            </button>
                          </div>

                          {loop.content && (
                            <p className="mt-3 line-clamp-3 text-sm leading-5 text-white/95">
                              {loop.content}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-white/65">
                              {formatTime(loop.created_at)}
                            </span>

                            <button
                              type="button"
                              disabled={isRemoving}
                              onClick={() =>
                                removeSavedLoop(loop.id)
                              }
                              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/25 disabled:opacity-50"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
                              </svg>

                              {isRemoving ? "Removing" : "Saved"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/loop?post=${loop.id}`)
                          }
                          className="saved-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                        >
                          Open Loop
                        </button>

                        <span className="saved-muted text-xs">
                          Saved
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}