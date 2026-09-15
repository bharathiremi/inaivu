"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

type SearchTab = "all" | "people" | "posts" | "loops";

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createClient(), []);

  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);

  const [activeTab, setActiveTab] =
    useState<SearchTab>("all");

  const [people, setPeople] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loops, setLoops] = useState<Post[]>([]);

  const [following, setFollowing] =
    useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] =
    useState(false);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const [peopleLimit, setPeopleLimit] =
    useState(20);

  const [postsLimit, setPostsLimit] =
    useState(20);

  const [loopsLimit, setLoopsLimit] =
    useState(20);

  const getErrorMessage = (value: unknown) => {
    if (value instanceof Error) {
      return value.message;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value
    ) {
      return String(
        (value as { message?: unknown }).message ||
          "Something went wrong.",
      );
    }

    return "Something went wrong.";
  };

  const runSearch = useCallback(
    async (
      searchText: string,
      peopleCount = 20,
      postsCount = 20,
      loopsCount = 20,
    ) => {
      const cleanQuery = searchText.trim();

      if (!cleanQuery) {
        setPeople([]);
        setPosts([]);
        setLoops([]);
        setFollowing(new Set());
        return;
      }

      try {
        setLoading(true);
        setError("");

        const {
          data: {
            user,
          },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const searchPattern = `%${cleanQuery}%`;

        const [
          peopleResult,
          postsResult,
          loopsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id,username,full_name,bio,avatar_url",
            )
            .or(
              `username.ilike.${searchPattern},full_name.ilike.${searchPattern}`,
            )
            .neq("id", user.id)
            .order("full_name", {
              ascending: true,
            })
            .limit(peopleCount),

          supabase
            .from("posts")
            .select(
              "id,user_id,content,image_url,media_url,media_type,created_at",
            )
            .ilike(
              "content",
              searchPattern,
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(postsCount),

          supabase
            .from("posts")
            .select(
              "id,user_id,content,image_url,media_url,media_type,created_at",
            )
            .ilike(
              "media_type",
              "video%",
            )
            .ilike(
              "content",
              searchPattern,
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(loopsCount),
        ]);

        if (peopleResult.error) {
          throw peopleResult.error;
        }

        if (postsResult.error) {
          throw postsResult.error;
        }

        if (loopsResult.error) {
          throw loopsResult.error;
        }

        const peopleData =
          (peopleResult.data || []) as Profile[];

        const postsData =
          (postsResult.data || []) as Post[];

        const loopsData =
          (loopsResult.data || []) as Post[];

        setPeople(peopleData);
        setPosts(postsData);
        setLoops(loopsData);

        const profileIds = peopleData.map(
          (person) => person.id,
        );

        if (profileIds.length > 0) {
          const followingResult =
            await supabase
              .from("follows")
              .select("following_id")
              .eq(
                "follower_id",
                user.id,
              )
              .in(
                "following_id",
                profileIds,
              );

          if (!followingResult.error) {
            setFollowing(
              new Set(
                (
                  followingResult.data || []
                ).map(
                  (row) =>
                    row.following_id,
                ),
              ),
            );
          }
        } else {
          setFollowing(new Set());
        }
      } catch (err) {
        console.error(
          "Global search error:",
          err,
        );

        setError(
          getErrorMessage(err),
        );
      } finally {
        setLoading(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    if (initialQuery.trim()) {
      runSearch(initialQuery);
    }
  }, [
    initialQuery,
    runSearch,
  ]);

  function submitSearch(
    event?: React.FormEvent,
  ) {
    event?.preventDefault();

    const cleanQuery =
      query.trim();

    if (!cleanQuery) {
      setActiveQuery("");
      setPeople([]);
      setPosts([]);
      setLoops([]);
      router.push("/search");
      return;
    }

    setActiveQuery(cleanQuery);

    router.replace(
      `/search?q=${encodeURIComponent(
        cleanQuery,
      )}`,
    );

    setPeopleLimit(20);
    setPostsLimit(20);
    setLoopsLimit(20);

    runSearch(
      cleanQuery,
      20,
      20,
      20,
    );
  }

  function clearSearch() {
    setQuery("");
    setActiveQuery("");

    setPeople([]);
    setPosts([]);
    setLoops([]);

    router.replace("/search");
  }

  function openProfile(id: string) {
    router.push(
      `/profile/${encodeURIComponent(id)}`,
    );
  }

  function openPost(id: string) {
    router.push(
      `/home?postId=${encodeURIComponent(id)}`,
    );
  }

  function openLoop(id: string) {
    router.push(
      `/loop?postId=${encodeURIComponent(id)}`,
    );
  }

  async function toggleFollow(
    targetId: string,
  ) {
    if (!userId) return;

    const isFollowing =
      following.has(targetId);

    setFollowing((previous) => {
      const next =
        new Set(previous);

      if (isFollowing) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }

      return next;
    });

    try {
      if (isFollowing) {
        const { error: deleteError } =
          await supabase
            .from("follows")
            .delete()
            .eq(
              "follower_id",
              userId,
            )
            .eq(
              "following_id",
              targetId,
            );

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { error: insertError } =
          await supabase
            .from("follows")
            .insert({
              follower_id:
                userId,
              following_id:
                targetId,
            });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (err) {
      console.error(
        "Follow error:",
        err,
      );

      setFollowing((previous) => {
        const next =
          new Set(previous);

        if (isFollowing) {
          next.add(targetId);
        } else {
          next.delete(targetId);
        }

        return next;
      });
    }
  }

  async function loadMore() {
    if (!activeQuery.trim()) {
      return;
    }

    try {
      setLoadingMore(true);

      const nextPeopleLimit =
        peopleLimit + 20;

      const nextPostsLimit =
        postsLimit + 20;

      const nextLoopsLimit =
        loopsLimit + 20;

      setPeopleLimit(
        nextPeopleLimit,
      );

      setPostsLimit(
        nextPostsLimit,
      );

      setLoopsLimit(
        nextLoopsLimit,
      );

      await runSearch(
        activeQuery,
        nextPeopleLimit,
        nextPostsLimit,
        nextLoopsLimit,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const totalResults =
    people.length +
    posts.length +
    loops.length;

  const visiblePeople =
    activeTab === "posts" ||
    activeTab === "loops"
      ? []
      : people;

  const visiblePosts =
    activeTab === "people" ||
    activeTab === "loops"
      ? []
      : posts;

  const visibleLoops =
    activeTab === "people" ||
    activeTab === "posts"
      ? []
      : loops;

  return (
    <>
      <main className="search-page">
        <header className="search-header">
          <button
            className="back-button"
            onClick={() =>
              router.back()
            }
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="brand">
            <div className="brand-mark">
              இ
            </div>

            <div>
              <div className="brand-name">
                Inaivu
              </div>

              <div className="brand-subtitle">
                Search
              </div>
            </div>
          </div>

          <button
            className="settings-button"
            onClick={() =>
              router.push(
                "/settings",
              )
            }
            aria-label="Settings"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="3"
              />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20h-2.4v-.21a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.55-1.03H6v-2.4h.85A1.7 1.7 0 0 0 8.4 10a1.7 1.7 0 0 0-.34-1.88L8 8.06l1.7-1.7.06.06A1.7 1.7 0 0 0 11.64 6.1 1.7 1.7 0 0 0 12.67 4.55V4h2.4v.55A1.7 1.7 0 0 0 16.1 6.1a1.7 1.7 0 0 0 1.88.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.34 10a1.7 1.7 0 0 0 1.55 1.03H21v2.4h-.11A1.7 1.7 0 0 0 19.4 15Z" />
            </svg>
          </button>
        </header>

        <section className="search-shell">
          <form
            className="search-box"
            onSubmit={submitSearch}
          >
            <svg
              className="search-icon"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />
              <path d="m20 20-4-4" />
            </svg>

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Search people, posts and Loops..."
              autoFocus
              aria-label="Search Inaivu"
            />

            {query && (
              <button
                type="button"
                className="clear-button"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

            <button
              type="submit"
              className="search-submit"
              disabled={
                !query.trim()
              }
            >
              Search
            </button>
          </form>

          {!activeQuery ? (
            <div className="search-start">
              <div className="search-start-icon">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />
                  <path d="m20 20-4-4" />
                </svg>
              </div>

              <h1>
                Discover on Inaivu
              </h1>

              <p>
                Find people, posts and
                Loop videos from one
                search.
              </p>
            </div>
          ) : (
            <>
              <div className="result-heading">
                <div>
                  <span className="eyebrow">
                    SEARCH RESULTS
                  </span>

                  <h1>
                    Results for “
                    {activeQuery}
                    ”
                  </h1>
                </div>

                <span className="result-count">
                  {totalResults}
                </span>
              </div>

              <div className="tabs">
                <button
                  className={
                    activeTab === "all"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() =>
                    setActiveTab("all")
                  }
                >
                  All
                </button>

                <button
                  className={
                    activeTab ===
                    "people"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() =>
                    setActiveTab(
                      "people",
                    )
                  }
                >
                  People
                </button>

                <button
                  className={
                    activeTab ===
                    "posts"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() =>
                    setActiveTab("posts")
                  }
                >
                  Posts
                </button>

                <button
                  className={
                    activeTab ===
                    "loops"
                      ? "tab active"
                      : "tab"
                  }
                  onClick={() =>
                    setActiveTab("loops")
                  }
                >
                  Loops
                </button>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>
                    Searching Inaivu...
                  </p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <div className="error-icon">
                    !
                  </div>

                  <h2>
                    Search failed
                  </h2>

                  <p>
                    {error}
                  </p>

                  <button
                    onClick={() =>
                      runSearch(
                        activeQuery,
                        peopleLimit,
                        postsLimit,
                        loopsLimit,
                      )
                    }
                  >
                    Try again
                  </button>
                </div>
              ) : totalResults ===
                0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                      />
                      <path d="m20 20-4-4" />
                    </svg>
                  </div>

                  <h2>
                    No results found
                  </h2>

                  <p>
                    Try a different name,
                    username or keyword.
                  </p>
                </div>
              ) : (
                <div className="results">
                  {visiblePeople.length >
                    0 && (
                    <section className="result-section">
                      <div className="section-title-row">
                        <div>
                          <h2>
                            People
                          </h2>

                          <p>
                            People matching
                            your search
                          </p>
                        </div>

                        {activeTab ===
                          "all" &&
                          people.length >
                            4 && (
                            <button
                              onClick={() =>
                                setActiveTab(
                                  "people",
                                )
                              }
                              className="see-all"
                            >
                              See all
                            </button>
                          )}
                      </div>

                      <div className="people-list">
                        {(activeTab ===
                        "all"
                          ? visiblePeople.slice(
                              0,
                              4,
                            )
                          : visiblePeople
                        ).map(
                          (person) => {
                            const isFollowing =
                              following.has(
                                person.id,
                              );

                            return (
                              <article
                                className="person-card"
                                key={
                                  person.id
                                }
                              >
                                <button
                                  className="person-main"
                                  onClick={() =>
                                    openProfile(
                                      person.id,
                                    )
                                  }
                                >
                                  {person.avatar_url ? (
                                    <img
                                      src={
                                        person.avatar_url
                                      }
                                      alt={
                                        person.full_name ||
                                        "Profile"
                                      }
                                      className="person-avatar"
                                    />
                                  ) : (
                                    <div className="person-avatar avatar-placeholder">
                                      {(
                                        person.full_name ||
                                        person.username ||
                                        "U"
                                      )
                                        .charAt(
                                          0,
                                        )
                                        .toUpperCase()}
                                    </div>
                                  )}

                                  <div className="person-info">
                                    <strong>
                                      {person.full_name ||
                                        "Unnamed user"}
                                    </strong>

                                    <span>
                                      {person.username
                                        ? `@${person.username}`
                                        : "@username"}
                                    </span>

                                    {person.bio && (
                                      <p>
                                        {person.bio}
                                      </p>
                                    )}
                                  </div>
                                </button>

                                <button
                                  className={
                                    isFollowing
                                      ? "follow-button following"
                                      : "follow-button"
                                  }
                                  onClick={() =>
                                    toggleFollow(
                                      person.id,
                                    )
                                  }
                                >
                                  {isFollowing
                                    ? "Following"
                                    : "Follow"}
                                </button>
                              </article>
                            );
                          },
                        )}
                      </div>
                    </section>
                  )}

                  {visiblePosts.length >
                    0 && (
                    <section className="result-section">
                      <div className="section-title-row">
                        <div>
                          <h2>
                            Posts
                          </h2>

                          <p>
                            Conversations and
                            shared thoughts
                          </p>
                        </div>

                        {activeTab ===
                          "all" &&
                          posts.length >
                            4 && (
                            <button
                              onClick={() =>
                                setActiveTab(
                                  "posts",
                                )
                              }
                              className="see-all"
                            >
                              See all
                            </button>
                          )}
                      </div>

                      <div className="posts-list">
                        {(activeTab ===
                        "all"
                          ? visiblePosts.slice(
                              0,
                              4,
                            )
                          : visiblePosts
                        ).map(
                          (post) => (
                            <article
                              className="post-card"
                              key={
                                post.id
                              }
                              onClick={() =>
                                openPost(
                                  post.id,
                                )
                              }
                            >
                              {post.image_url && (
                                <img
                                  src={
                                    post.image_url
                                  }
                                  alt=""
                                  className="post-image"
                                />
                              )}

                              {post.media_url &&
                                post.media_type?.startsWith(
                                  "video",
                                ) && (
                                  <div className="video-preview">
                                    <video
                                      src={
                                        post.media_url
                                      }
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />

                                    <div className="video-badge">
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                      >
                                        <path d="M8 5v14l11-7z" />
                                      </svg>

                                      Video
                                    </div>
                                  </div>
                                )}

                              <div className="post-content">
                                <div className="post-meta">
                                  <span>
                                    {new Date(
                                      post.created_at,
                                    ).toLocaleDateString(
                                      undefined,
                                      {
                                        day: "numeric",
                                        month: "short",
                                      },
                                    )}
                                  </span>
                                </div>

                                <p>
                                  {post.content ||
                                    "Shared a post"}
                                </p>

                                <span className="open-label">
                                  Open post →
                                </span>
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    </section>
                  )}

                  {visibleLoops.length >
                    0 && (
                    <section className="result-section">
                      <div className="section-title-row">
                        <div>
                          <h2>
                            Loops
                          </h2>

                          <p>
                            Short videos matching
                            your search
                          </p>
                        </div>

                        {activeTab ===
                          "all" &&
                          loops.length >
                            4 && (
                            <button
                              onClick={() =>
                                setActiveTab(
                                  "loops",
                                )
                              }
                              className="see-all"
                            >
                              See all
                            </button>
                          )}
                      </div>

                      <div className="loops-grid">
                        {(activeTab ===
                        "all"
                          ? visibleLoops.slice(
                              0,
                              4,
                            )
                          : visibleLoops
                        ).map(
                          (loop) => (
                            <article
                              className="loop-card"
                              key={
                                loop.id
                              }
                              onClick={() =>
                                openLoop(
                                  loop.id,
                                )
                              }
                            >
                              <div className="loop-video">
                                {loop.media_url ? (
                                  <video
                                    src={
                                      loop.media_url
                                    }
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                ) : (
                                  <div className="loop-fallback">
                                    <svg
                                      width="30"
                                      height="30"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                )}

                                <div className="loop-play">
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>

                              <div className="loop-text">
                                <p>
                                  {loop.content ||
                                    "Loop video"}
                                </p>

                                <span>
                                  Open Loop →
                                </span>
                              </div>
                            </article>
                          ),
                        )}
                      </div>
                    </section>
                  )}

                  {(activeTab ===
                    "people" ||
                    activeTab ===
                      "posts" ||
                    activeTab ===
                      "loops") && (
                    <button
                      className="load-more"
                      onClick={
                        loadMore
                      }
                      disabled={
                        loadingMore
                      }
                    >
                      {loadingMore ? (
                        <>
                          <span className="small-spinner" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <style jsx global>{`
        .search-page {
          min-height: 100vh;
          background: #f8f3eb;
          color: #29231f;
        }

        .search-header {
          position: sticky;
          top: 0;
          z-index: 20;
          height: 72px;
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          align-items: center;
          gap: 10px;
          padding: 0 28px;
          background: rgba(
            248,
            243,
            235,
            0.94
          );
          border-bottom: 1px solid #eadfd4;
          backdrop-filter: blur(16px);
        }

        .back-button,
        .settings-button {
          width: 40px;
          height: 40px;
          border: 1px solid #eadfd4;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fffaf5;
          color: #62564f;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .back-button:hover,
        .settings-button:hover {
          border-color: #ef704d;
          color: #ef704d;
          transform: translateY(-1px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .brand-mark {
          width: 37px;
          height: 37px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ef704d;
          color: white;
          font-size: 18px;
          font-weight: 900;
          box-shadow: 0 7px 18px
            rgba(239, 112, 77, 0.2);
        }

        .brand-name {
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .brand-subtitle {
          margin-top: 1px;
          color: #978b82;
          font-size: 11px;
          font-weight: 700;
        }

        .search-shell {
          width: min(900px, calc(100% - 32px));
          margin: 0 auto;
          padding: 38px 0 70px;
        }

        .search-box {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 7px 8px 7px 17px;
          border: 1px solid #e4d7cc;
          border-radius: 18px;
          background: #fffaf5;
          box-shadow: 0 10px 28px
            rgba(75, 52, 39, 0.05);
        }

        .search-box:focus-within {
          border-color: #ef704d;
          box-shadow: 0 0 0 4px
            rgba(239, 112, 77, 0.09);
        }

        .search-icon {
          flex: 0 0 auto;
          color: #9b8e85;
        }

        .search-box input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: #29231f;
          font-size: 15px;
          font-weight: 650;
        }

        .search-box input::placeholder {
          color: #a99d94;
        }

        .clear-button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: #eee5dd;
          color: #776b63;
          font-size: 21px;
          line-height: 1;
          cursor: pointer;
        }

        .search-submit {
          min-height: 42px;
          padding: 0 19px;
          border: 0;
          border-radius: 13px;
          background: #ef704d;
          color: white;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .search-submit:hover:not(:disabled) {
          background: #e45f3b;
          transform: translateY(-1px);
        }

        .search-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .search-start {
          min-height: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .search-start-icon,
        .empty-icon {
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 23px;
          background: #fff0e7;
          color: #ef704d;
          margin-bottom: 20px;
        }

        .search-start h1,
        .result-heading h1 {
          margin: 0;
          letter-spacing: -0.04em;
          font-size: 28px;
          font-weight: 950;
        }

        .search-start p {
          max-width: 430px;
          margin: 9px 0 0;
          color: #897d74;
          font-size: 14px;
          line-height: 1.65;
        }

        .result-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin: 38px 0 22px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #ef704d;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .result-count {
          min-width: 39px;
          height: 39px;
          padding: 0 10px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff0e7;
          color: #d95f40;
          font-size: 13px;
          font-weight: 950;
        }

        .tabs {
          display: flex;
          gap: 7px;
          padding-bottom: 18px;
          border-bottom: 1px solid #e8ddd3;
        }

        .tab {
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 9px 14px;
          background: transparent;
          color: #897d74;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .tab:hover {
          background: #fff7f0;
          color: #ef704d;
        }

        .tab.active {
          background: #ef704d;
          color: white;
        }

        .results {
          padding-top: 8px;
        }

        .result-section {
          padding: 27px 0;
          border-bottom: 1px solid #e8ddd3;
        }

        .section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 15px;
        }

        .section-title-row h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .section-title-row p {
          margin: 4px 0 0;
          color: #958980;
          font-size: 12px;
          font-weight: 600;
        }

        .see-all {
          border: 0;
          background: transparent;
          color: #df6645;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .people-list {
          display: grid;
          gap: 9px;
        }

        .person-card {
          min-height: 78px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 10px 12px;
          border: 1px solid #eadfd4;
          border-radius: 17px;
          background: #fffaf5;
          transition: 0.18s ease;
        }

        .person-card:hover {
          border-color: #edcbbd;
          transform: translateY(-1px);
          box-shadow: 0 10px 22px
            rgba(75, 52, 39, 0.05);
        }

        .person-main {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .person-avatar {
          width: 52px;
          height: 52px;
          flex: 0 0 auto;
          object-fit: cover;
          border-radius: 17px;
          background: #f0e7df;
        }

        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffe4d8;
          color: #d75e3d;
          font-size: 18px;
          font-weight: 950;
        }

        .person-info {
          min-width: 0;
        }

        .person-info strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #302823;
          font-size: 14px;
          font-weight: 900;
        }

        .person-info > span {
          display: block;
          margin-top: 2px;
          color: #9a8e85;
          font-size: 11px;
          font-weight: 700;
        }

        .person-info p {
          overflow: hidden;
          margin: 5px 0 0;
          color: #81756d;
          font-size: 11px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .follow-button {
          min-width: 88px;
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #ef704d;
          border-radius: 11px;
          background: #ef704d;
          color: white;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .follow-button:hover {
          transform: translateY(-1px);
          background: #e35f3c;
        }

        .follow-button.following {
          border-color: #e2d5ca;
          background: #fffaf5;
          color: #746860;
        }

        .posts-list {
          display: grid;
          gap: 10px;
        }

        .post-card {
          overflow: hidden;
          display: grid;
          grid-template-columns: 120px 1fr;
          min-height: 118px;
          border: 1px solid #eadfd4;
          border-radius: 17px;
          background: #fffaf5;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .post-card:hover {
          border-color: #edcbbd;
          transform: translateY(-1px);
          box-shadow: 0 10px 22px
            rgba(75, 52, 39, 0.05);
        }

        .post-image,
        .video-preview {
          width: 120px;
          height: 100%;
          min-height: 118px;
          object-fit: cover;
          background: #eee5dc;
        }

        .video-preview {
          position: relative;
          overflow: hidden;
        }

        .video-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-badge {
          position: absolute;
          left: 8px;
          bottom: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 7px;
          border-radius: 8px;
          background: rgba(20, 16, 13, 0.72);
          color: white;
          font-size: 9px;
          font-weight: 850;
        }

        .post-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 15px 16px;
        }

        .post-meta {
          color: #a1958c;
          font-size: 10px;
          font-weight: 750;
        }

        .post-content p {
          display: -webkit-box;
          overflow: hidden;
          margin: 8px 0 9px;
          color: #403731;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 650;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .open-label,
        .loop-text span {
          margin-top: auto;
          color: #df6645;
          font-size: 10px;
          font-weight: 900;
        }

        .loops-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .loop-card {
          overflow: hidden;
          border: 1px solid #eadfd4;
          border-radius: 17px;
          background: #fffaf5;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .loop-card:hover {
          border-color: #edcbbd;
          transform: translateY(-2px);
          box-shadow: 0 10px 22px
            rgba(75, 52, 39, 0.07);
        }

        .loop-video {
          position: relative;
          height: 210px;
          overflow: hidden;
          background: #2b211d;
        }

        .loop-video video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .loop-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .loop-play {
          position: absolute;
          left: 10px;
          bottom: 10px;
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(
            255,
            250,
            245,
            0.9
          );
          color: #ef704d;
        }

        .loop-text {
          min-height: 82px;
          padding: 11px 12px;
        }

        .loop-text p {
          display: -webkit-box;
          overflow: hidden;
          margin: 0 0 8px;
          color: #443a34;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .loading-state,
        .empty-state,
        .error-state {
          min-height: 340px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .spinner {
          width: 30px;
          height: 30px;
          margin-bottom: 13px;
          border: 3px solid #e9ddd3;
          border-top-color: #ef704d;
          border-radius: 50%;
          animation: search-spin
            0.8s linear infinite;
        }

        .loading-state p {
          margin: 0;
          color: #8f837a;
          font-size: 13px;
          font-weight: 750;
        }

        .empty-state h2,
        .error-state h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
        }

        .empty-state p,
        .error-state p {
          max-width: 390px;
          margin: 7px 0 17px;
          color: #8c8077;
          font-size: 13px;
          line-height: 1.55;
        }

        .error-icon {
          width: 50px;
          height: 50px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #fff0e7;
          color: #ef704d;
          font-size: 22px;
          font-weight: 950;
        }

        .error-state button {
          border: 0;
          border-radius: 12px;
          padding: 11px 17px;
          background: #ef704d;
          color: white;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .load-more {
          width: 100%;
          min-height: 46px;
          margin-top: 22px;
          border: 1px solid #e5d7cc;
          border-radius: 14px;
          background: #fffaf5;
          color: #6f635b;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .load-more:hover:not(:disabled) {
          border-color: #ef704d;
          color: #ef704d;
        }

        .load-more:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .small-spinner {
          width: 15px;
          height: 15px;
          display: inline-block;
          margin-right: 7px;
          vertical-align: -3px;
          border: 2px solid #e7dbd1;
          border-top-color: #ef704d;
          border-radius: 50%;
          animation: search-spin
            0.7s linear infinite;
        }

        @keyframes search-spin {
          to {
            transform: rotate(360deg);
          }
        }

        html.dark .search-page {
          background: #171412;
          color: #f5ece5;
        }

        html.dark .search-header {
          background: rgba(
            23,
            20,
            18,
            0.94
          );
          border-color: #342d28;
        }

        html.dark .back-button,
        html.dark .settings-button,
        html.dark .search-box,
        html.dark .person-card,
        html.dark .post-card,
        html.dark .loop-card,
        html.dark .load-more {
          border-color: #3a322d;
          background: #211d1a;
        }

        html.dark .back-button,
        html.dark .settings-button {
          color: #b7aaa1;
        }

        html.dark .search-box input {
          color: #f7eee8;
        }

        html.dark .search-box input::placeholder {
          color: #7f746d;
        }

        html.dark .clear-button {
          background: #342c27;
          color: #b3a69d;
        }

        html.dark .search-start p,
        html.dark .section-title-row p,
        html.dark .person-info > span,
        html.dark .person-info p,
        html.dark .post-meta,
        html.dark .loading-state p,
        html.dark .empty-state p,
        html.dark .error-state p {
          color: #978c84;
        }

        html.dark .search-start h1,
        html.dark .result-heading h1,
        html.dark .section-title-row h2,
        html.dark .empty-state h2,
        html.dark .error-state h2 {
          color: #f6eee8;
        }

        html.dark .tabs,
        html.dark .result-section {
          border-color: #352e29;
        }

        html.dark .tab {
          color: #9a8f87;
        }

        html.dark .tab:hover {
          background: #2a211d;
        }

        html.dark .tab.active {
          color: white;
        }

        html.dark .person-info strong,
        html.dark .post-content p,
        html.dark .loop-text p {
          color: #eee5de;
        }

        html.dark .following {
          border-color: #433831;
          background: #211d1a;
          color: #c1b4aa;
        }

        html.dark .search-start-icon,
        html.dark .empty-icon,
        html.dark .result-count,
        html.dark .error-icon {
          background: #30221d;
          color: #f3a184;
        }

        html.dark .person-avatar.avatar-placeholder {
          background: #39271f;
          color: #f1a083;
        }

        html.dark .post-image,
        html.dark .video-preview {
          background: #302824;
        }

        @media (max-width: 800px) {
          .search-header {
            padding: 0 16px;
          }

          .search-shell {
            width: min(
              100% - 24px,
              680px
            );
            padding-top: 24px;
          }

          .search-submit {
            padding: 0 14px;
          }

          .loops-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .loop-video {
            height: 220px;
          }
        }

        @media (max-width: 560px) {
          .search-header {
            height: 64px;
          }

          .brand-subtitle {
            display: none;
          }

          .brand-mark {
            width: 34px;
            height: 34px;
          }

          .search-box {
            min-height: 54px;
            padding-left: 13px;
          }

          .search-box input {
            font-size: 13px;
          }

          .search-submit {
            min-height: 38px;
            padding: 0 11px;
            font-size: 11px;
          }

          .result-heading h1 {
            font-size: 21px;
          }

          .tabs {
            overflow-x: auto;
            scrollbar-width: none;
          }

          .tabs::-webkit-scrollbar {
            display: none;
          }

          .tab {
            flex: 0 0 auto;
          }

          .person-card {
            padding: 9px;
          }

          .person-avatar {
            width: 46px;
            height: 46px;
          }

          .person-info p {
            display: none;
          }

          .follow-button {
            min-width: 78px;
          }

          .post-card {
            grid-template-columns: 88px 1fr;
            min-height: 104px;
          }

          .post-image,
          .video-preview {
            width: 88px;
            min-height: 104px;
          }

          .post-content {
            padding: 12px;
          }

          .post-content p {
            font-size: 12px;
            -webkit-line-clamp: 2;
          }

          .loops-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
            gap: 8px;
          }

          .loop-video {
            height: 190px;
          }

          .loop-text {
            min-height: 74px;
            padding: 9px;
          }

          .loop-text p {
            font-size: 11px;
          }
        }
      `}</style>
    </>
  );
}