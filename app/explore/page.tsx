"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

type PostWithMeta = Post & {
  profile?: Profile;
  likes: number;
  comments: number;
  isLiked: boolean;
};

type Tab = "for-you" | "loops" | "people";

export default function ExplorePage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [userId, setUserId] =
    useState<string | null>(null);

  const [tab, setTab] =
    useState<Tab>("for-you");

  const [posts, setPosts] = useState<
    PostWithMeta[]
  >([]);

  const [loops, setLoops] = useState<
    PostWithMeta[]
  >([]);

  const [people, setPeople] =
    useState<Profile[]>([]);

  const [following, setFollowing] =
    useState<Set<string>>(new Set());

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [expandedPosts, setExpandedPosts] =
    useState<Set<string>>(new Set());

  const [commentOpen, setCommentOpen] =
    useState<string | null>(null);

  const [commentText, setCommentText] =
    useState("");

  const [commentLoading, setCommentLoading] =
    useState(false);

  const [toast, setToast] =
    useState("");

  const [searchText, setSearchText] =
    useState("");

  const normalizeError = (
    errorValue: unknown,
  ) => {
    if (
      errorValue instanceof Error
    ) {
      return errorValue.message;
    }

    if (
      typeof errorValue === "object" &&
      errorValue !== null &&
      "message" in errorValue
    ) {
      return String(
        (
          errorValue as {
            message?: unknown;
          }
        ).message ||
          "Something went wrong.",
      );
    }

    return "Something went wrong.";
  };

  const showToast = (
    message: string,
  ) => {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 2200);
  };

  const enrichPosts = useCallback(
    async (
      rawPosts: Post[],
      currentUserId: string,
    ): Promise<PostWithMeta[]> => {
      if (!rawPosts.length) {
        return [];
      }

      const userIds = Array.from(
        new Set(
          rawPosts.map(
            (post) => post.user_id,
          ),
        ),
      );

      const postIds = rawPosts.map(
        (post) => post.id,
      );

      const [
        profilesResult,
        likesResult,
        commentsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,username,full_name,bio,avatar_url",
          )
          .in("id", userIds),

        supabase
          .from("post_likes")
          .select("post_id,user_id")
          .in(
            "post_id",
            postIds,
          ),

        supabase
          .from("post_comments")
          .select("id,post_id")
          .in(
            "post_id",
            postIds,
          ),
      ]);

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      if (likesResult.error) {
        throw likesResult.error;
      }

      if (commentsResult.error) {
        throw commentsResult.error;
      }

      const profiles =
        (profilesResult.data ||
          []) as Profile[];

      const likes =
        likesResult.data || [];

      const comments =
        commentsResult.data || [];

      const profileMap =
        new Map<string, Profile>();

      profiles.forEach((profile) => {
        profileMap.set(
          profile.id,
          profile,
        );
      });

      const likeCount =
        new Map<string, number>();

      const likedByMe =
        new Set<string>();

      likes.forEach((like) => {
        likeCount.set(
          like.post_id,
          (likeCount.get(
            like.post_id,
          ) || 0) + 1,
        );

        if (
          like.user_id ===
          currentUserId
        ) {
          likedByMe.add(
            like.post_id,
          );
        }
      });

      const commentCount =
        new Map<string, number>();

      comments.forEach((comment) => {
        commentCount.set(
          comment.post_id,
          (commentCount.get(
            comment.post_id,
          ) || 0) + 1,
        );
      });

      return rawPosts.map(
        (post) => ({
          ...post,
          profile:
            profileMap.get(
              post.user_id,
            ),
          likes:
            likeCount.get(
              post.id,
            ) || 0,
          comments:
            commentCount.get(
              post.id,
            ) || 0,
          isLiked:
            likedByMe.has(
              post.id,
            ),
        }),
      );
    },
    [supabase],
  );

  const loadPeople = useCallback(
    async (
      currentUserId: string,
    ) => {
      const peopleResult =
        await supabase
          .from("profiles")
          .select(
            "id,username,full_name,bio,avatar_url",
          )
          .neq(
            "id",
            currentUserId,
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(12);

      if (peopleResult.error) {
        throw peopleResult.error;
      }

      const profiles =
        (peopleResult.data ||
          []) as Profile[];

      setPeople(profiles);

      if (!profiles.length) {
        setFollowing(
          new Set(),
        );
        return;
      }

      const ids =
        profiles.map(
          (profile) =>
            profile.id,
        );

      const followResult =
        await supabase
          .from("follows")
          .select("following_id")
          .eq(
            "follower_id",
            currentUserId,
          )
          .in(
            "following_id",
            ids,
          );

      if (!followResult.error) {
        setFollowing(
          new Set(
            (
              followResult.data ||
              []
            ).map(
              (row) =>
                row.following_id,
            ),
          ),
        );
      }
    },
    [supabase],
  );

  const loadExplore = useCallback(
    async (
      silent = false,
    ) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const {
          data: {
            user,
          },
          error: authError,
        } =
          await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const [
          postsResult,
          loopsResult,
        ] = await Promise.all([
          supabase
            .from("posts")
            .select(
              "id,user_id,content,image_url,media_url,media_type,created_at",
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(30),

          supabase
            .from("posts")
            .select(
              "id,user_id,content,image_url,media_url,media_type,created_at",
            )
            .not(
              "media_url",
              "is",
              null,
            )
            .ilike(
              "media_type",
              "video%",
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(30),
        ]);

        if (postsResult.error) {
          throw postsResult.error;
        }

        if (loopsResult.error) {
          throw loopsResult.error;
        }

        const [
          enrichedPosts,
          enrichedLoops,
        ] = await Promise.all([
          enrichPosts(
            (postsResult.data ||
              []) as Post[],
            user.id,
          ),

          enrichPosts(
            (loopsResult.data ||
              []) as Post[],
            user.id,
          ),
        ]);

        setPosts(
          enrichedPosts,
        );

        setLoops(
          enrichedLoops,
        );

        await loadPeople(
          user.id,
        );
      } catch (err) {
        console.error(
          "Explore load error:",
          err,
        );

        setError(
          normalizeError(err),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      enrichPosts,
      loadPeople,
      router,
      supabase,
    ],
  );

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  async function toggleLike(
    postId: string,
  ) {
    if (!userId) {
      return;
    }

    const target =
      [...posts, ...loops].find(
        (post) =>
          post.id === postId,
      );

    if (!target) {
      return;
    }

    const oldLiked =
      target.isLiked;

    const oldCount =
      target.likes;

    const updateList = (
      list: PostWithMeta[],
    ) =>
      list.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked:
                !oldLiked,
              likes:
                oldLiked
                  ? Math.max(
                      0,
                      oldCount - 1,
                    )
                  : oldCount + 1,
            }
          : post,
      );

    setPosts(updateList);
    setLoops(updateList);

    try {
      if (oldLiked) {
        const {
          error: deleteError,
        } = await supabase
          .from("post_likes")
          .delete()
          .eq(
            "post_id",
            postId,
          )
          .eq(
            "user_id",
            userId,
          );

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("post_likes")
          .insert({
            post_id:
              postId,
            user_id:
              userId,
          });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (err) {
      console.error(
        "Like error:",
        err,
      );

      setPosts((list) =>
        list.map((post) =>
          post.id ===
          postId
            ? {
                ...post,
                isLiked:
                  oldLiked,
                likes:
                  oldCount,
              }
            : post,
        ),
      );

      setLoops((list) =>
        list.map((post) =>
          post.id ===
          postId
            ? {
                ...post,
                isLiked:
                  oldLiked,
                likes:
                  oldCount,
              }
            : post,
        ),
      );

      showToast(
        "Could not update like",
      );
    }
  }

  async function toggleFollow(
    targetId: string,
  ) {
    if (!userId) {
      return;
    }

    const wasFollowing =
      following.has(targetId);

    setFollowing((previous) => {
      const next =
        new Set(previous);

      if (wasFollowing) {
        next.delete(
          targetId,
        );
      } else {
        next.add(
          targetId,
        );
      }

      return next;
    });

    try {
      if (wasFollowing) {
        const {
          error: deleteError,
        } = await supabase
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
        const {
          error: insertError,
        } = await supabase
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

        if (wasFollowing) {
          next.add(
            targetId,
          );
        } else {
          next.delete(
            targetId,
          );
        }

        return next;
      });

      showToast(
        "Could not update follow",
      );
    }
  }

  function toggleExpanded(
    postId: string,
  ) {
    setExpandedPosts(
      (previous) => {
        const next =
          new Set(previous);

        if (
          next.has(postId)
        ) {
          next.delete(
            postId,
          );
        } else {
          next.add(
            postId,
          );
        }

        return next;
      },
    );
  }

  async function submitComment(
    postId: string,
  ) {
    if (
      !userId ||
      !commentText.trim()
    ) {
      return;
    }

    try {
      setCommentLoading(
        true,
      );

      const {
        error: commentError,
      } = await supabase
        .from(
          "post_comments",
        )
        .insert({
          post_id:
            postId,
          user_id:
            userId,
          content:
            commentText.trim(),
        });

      if (commentError) {
        throw commentError;
      }

      setPosts((list) =>
        list.map((post) =>
          post.id ===
          postId
            ? {
                ...post,
                comments:
                  post.comments +
                  1,
              }
            : post,
        ),
      );

      setLoops((list) =>
        list.map((post) =>
          post.id ===
          postId
            ? {
                ...post,
                comments:
                  post.comments +
                  1,
              }
            : post,
        ),
      );

      setCommentText("");
      showToast(
        "Comment added",
      );
    } catch (err) {
      console.error(
        "Comment error:",
        err,
      );

      showToast(
        normalizeError(err),
      );
    } finally {
      setCommentLoading(
        false,
      );
    }
  }

  async function sharePost(
    postId: string,
  ) {
    const url =
      `${window.location.origin}/home?postId=${encodeURIComponent(
        postId,
      )}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "Inaivu post",
          url,
        });
      } else {
        await navigator.clipboard.writeText(
          url,
        );

        showToast(
          "Link copied",
        );
      }
    } catch {
      // User cancelled share.
    }
  }

  function openProfile(
    id: string,
  ) {
    router.push(
      `/profile/${encodeURIComponent(
        id,
      )}`,
    );
  }

  function openPost(
    id: string,
  ) {
    router.push(
      `/home?postId=${encodeURIComponent(
        id,
      )}`,
    );
  }

  function openLoop(
    id: string,
  ) {
    router.push(
      `/loop?postId=${encodeURIComponent(
        id,
      )}`,
    );
  }

  function submitSearch(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const clean =
      searchText.trim();

    if (!clean) {
      router.push(
        "/search",
      );
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        clean,
      )}`,
    );
  }

  const visiblePosts =
    useMemo(() => {
      if (
        !searchText.trim()
      ) {
        return posts;
      }

      const query =
        searchText
          .trim()
          .toLowerCase();

      return posts.filter(
        (post) => {
          const text =
            `${post.content || ""} ${
              post.profile
                ?.full_name || ""
            } ${
              post.profile
                ?.username || ""
            }`.toLowerCase();

          return text.includes(
            query,
          );
        },
      );
    }, [
      posts,
      searchText,
    ]);

  const visibleLoops =
    useMemo(() => {
      if (
        !searchText.trim()
      ) {
        return loops;
      }

      const query =
        searchText
          .trim()
          .toLowerCase();

      return loops.filter(
        (loop) => {
          const text =
            `${loop.content || ""} ${
              loop.profile
                ?.full_name || ""
            } ${
              loop.profile
                ?.username || ""
            }`.toLowerCase();

          return text.includes(
            query,
          );
        },
      );
    }, [
      loops,
      searchText,
    ]);

  const visiblePeople =
    useMemo(() => {
      if (
        !searchText.trim()
      ) {
        return people;
      }

      const query =
        searchText
          .trim()
          .toLowerCase();

      return people.filter(
        (person) => {
          const text =
            `${person.full_name || ""} ${
              person.username || ""
            } ${
              person.bio || ""
            }`.toLowerCase();

          return text.includes(
            query,
          );
        },
      );
    }, [
      people,
      searchText,
    ]);

  function PostCard({
    post,
    isLoop = false,
  }: {
    post: PostWithMeta;
    isLoop?: boolean;
  }) {
    const isExpanded =
      expandedPosts.has(
        post.id,
      );

    const isCommentOpen =
      commentOpen ===
      post.id;

    const content =
      post.content || "";

    const longContent =
      content.length > 180;

    return (
      <article className="post-card">
        <div className="post-top">
          <button
            className="author-button"
            onClick={() =>
              openProfile(
                post.user_id,
              )
            }
          >
            {post.profile
              ?.avatar_url ? (
              <img
                src={
                  post.profile
                    .avatar_url
                }
                alt=""
                className="avatar"
              />
            ) : (
              <div className="avatar avatar-placeholder">
                {(
                  post.profile
                    ?.full_name ||
                  post.profile
                    ?.username ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div className="author-details">
              <strong>
                {post.profile
                  ?.full_name ||
                  "Inaivu user"}
              </strong>

              <span>
                {post.profile
                  ?.username
                  ? `@${post.profile.username}`
                  : "Inaivu"}
              </span>
            </div>
          </button>

          <button
            className="more-button"
            aria-label="More options"
            onClick={() =>
              showToast(
                "More options coming soon",
              )
            }
          >
            •••
          </button>
        </div>

        {content && (
          <div className="post-copy">
            <p
              className={
                !isExpanded &&
                longContent
                  ? "clamped"
                  : ""
              }
            >
              {content}
            </p>

            {longContent && (
              <button
                className="read-more"
                onClick={() =>
                  toggleExpanded(
                    post.id,
                  )
                }
              >
                {isExpanded
                  ? "Show less"
                  : "Read more"}
              </button>
            )}
          </div>
        )}

        {post.image_url && (
          <button
            className="media-frame image-frame"
            onClick={() =>
              openPost(
                post.id,
              )
            }
          >
            <img
              src={
                post.image_url
              }
              alt=""
            />
          </button>
        )}

        {post.media_url &&
          post.media_type?.startsWith(
            "video",
          ) && (
            <button
              className={
                isLoop
                  ? "media-frame loop-frame"
                  : "media-frame video-frame"
              }
              onClick={() =>
                openLoop(
                  post.id,
                )
              }
            >
              <video
                src={
                  post.media_url
                }
                muted
                playsInline
                preload="metadata"
              />

              <span className="video-overlay">
                <span className="play-circle">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>

              {isLoop && (
                <span className="loop-label">
                  LOOP
                </span>
              )}
            </button>
          )}

        <div className="post-actions">
          <button
            className={
              post.isLiked
                ? "action liked"
                : "action"
            }
            onClick={() =>
              toggleLike(
                post.id,
              )
            }
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill={
                post.isLiked
                  ? "currentColor"
                  : "none"
              }
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 8 4c1.4 0 2.7.7 4 2 1.3-1.3 2.6-2 4-2a4.8 4.8 0 0 1 4.8 4.8Z" />
            </svg>

            <span>
              {post.likes}
            </span>
          </button>

          <button
            className="action"
            onClick={() =>
              setCommentOpen(
                isCommentOpen
                  ? null
                  : post.id,
              )
            }
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
            </svg>

            <span>
              {post.comments}
            </span>
          </button>

          <button
            className="action"
            onClick={() =>
              sharePost(
                post.id,
              )
            }
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>

            <span>
              Share
            </span>
          </button>

          <button
            className="action open-action"
            onClick={() =>
              isLoop
                ? openLoop(
                    post.id,
                  )
                : openPost(
                    post.id,
                  )
            }
          >
            Open
          </button>
        </div>

        {isCommentOpen && (
          <div className="comment-box">
            <input
              value={
                commentText
              }
              onChange={(
                event,
              ) =>
                setCommentText(
                  event.target
                    .value,
                )
              }
              placeholder="Write a comment..."
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  submitComment(
                    post.id,
                  );
                }
              }}
            />

            <button
              onClick={() =>
                submitComment(
                  post.id,
                )
              }
              disabled={
                commentLoading ||
                !commentText.trim()
              }
            >
              {commentLoading
                ? "..."
                : "Send"}
            </button>
          </div>
        )}

        <div className="post-time">
          {new Date(
            post.created_at,
          ).toLocaleDateString(
            undefined,
            {
              day: "numeric",
              month: "short",
              year: "numeric",
            },
          )}
        </div>
      </article>
    );
  }

  if (loading) {
    return (
      <main className="explore-page">
        <div className="loading-screen">
          <div className="brand-loader">
            இ
          </div>

          <div className="spinner" />

          <p>
            Loading Explore...
          </p>
        </div>

        <style jsx global>{`
          .explore-page {
            min-height: 100vh;
            background: #f8f3eb;
            color: #29231f;
          }

          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
          }

          .brand-loader {
            width: 58px;
            height: 58px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 19px;
            background: #ef704d;
            color: white;
            font-size: 27px;
            font-weight: 950;
          }

          .spinner {
            width: 25px;
            height: 25px;
            border: 3px solid #e5d9cf;
            border-top-color: #ef704d;
            border-radius: 50%;
            animation: explore-spin 0.8s linear infinite;
          }

          .loading-screen p {
            margin: 0;
            color: #8d8178;
            font-size: 13px;
            font-weight: 750;
          }

          @keyframes explore-spin {
            to {
              transform: rotate(360deg);
            }
          }

          html.dark .explore-page {
            background: #171412;
            color: #f5ece5;
          }

          html.dark .spinner {
            border-color: #3a312c;
            border-top-color: #ef704d;
          }

          html.dark .loading-screen p {
            color: #968a82;
          }
        `}</style>
      </main>
    );
  }

  return (
    <>
      <main className="explore-page">
        <header className="explore-header">
          <div className="header-inner">
            <button
              className="back-button"
              onClick={() =>
                router.back()
              }
              aria-label="Back"
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
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="brand">
              <div className="brand-mark">
                இ
              </div>

              <div>
                <strong>
                  Inaivu
                </strong>
                <span>
                  Explore
                </span>
              </div>
            </div>

            <button
              className="refresh-button"
              onClick={() =>
                loadExplore(
                  true,
                )
              }
              disabled={
                refreshing
              }
              aria-label="Refresh"
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
                <path d="M20 11a8.1 8.1 0 0 0-15.5-3M4 4v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 3M20 20v-4h-4" />
              </svg>
            </button>
          </div>
        </header>

        <div className="explore-container">
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-kicker">
                DISCOVER
              </span>

              <h1>
                Find something
                <br />
                worth staying for.
              </h1>

              <p>
                Explore conversations,
                people and Loop videos
                across Inaivu.
              </p>
            </div>

            <div className="hero-shape">
              <div className="shape-ring ring-one" />
              <div className="shape-ring ring-two" />
              <div className="shape-dot dot-one" />
              <div className="shape-dot dot-two" />

              <span>
                இ
              </span>
            </div>
          </section>

          <form
            className="explore-search"
            onSubmit={
              submitSearch
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
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
              value={
                searchText
              }
              onChange={(
                event,
              ) =>
                setSearchText(
                  event.target
                    .value,
                )
              }
              placeholder="Search people, posts or Loops..."
            />

            {searchText && (
              <button
                type="button"
                className="search-clear"
                onClick={() =>
                  setSearchText(
                    "",
                  )
                }
              >
                ×
              </button>
            )}

            <button
              type="submit"
              className="search-go"
            >
              Search
            </button>
          </form>

          <nav className="tabs">
            <button
              className={
                tab === "for-you"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setTab(
                  "for-you",
                )
              }
            >
              For you
            </button>

            <button
              className={
                tab === "loops"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setTab("loops")
              }
            >
              Loops
            </button>

            <button
              className={
                tab === "people"
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setTab(
                  "people",
                )
              }
            >
              People
            </button>
          </nav>

          {error ? (
            <section className="state-card">
              <div className="state-icon">
                !
              </div>

              <h2>
                Explore could not load
              </h2>

              <p>
                {error}
              </p>

              <button
                onClick={() =>
                  loadExplore()
                }
              >
                Try again
              </button>
            </section>
          ) : tab ===
            "people" ? (
            <section className="content-section">
              <div className="section-heading">
                <div>
                  <span>
                    PEOPLE
                  </span>

                  <h2>
                    People you may like
                  </h2>
                </div>

                <strong>
                  {
                    visiblePeople.length
                  }
                </strong>
              </div>

              {visiblePeople.length ===
              0 ? (
                <div className="empty-card">
                  <div className="empty-icon">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle
                        cx="9"
                        cy="7"
                        r="4"
                      />
                      <path d="M3 21a6 6 0 0 1 12 0" />
                      <path d="M16 11a3 3 0 0 0 0-6" />
                      <path d="M21 21a5 5 0 0 0-4-4.85" />
                    </svg>
                  </div>

                  <h3>
                    No people found
                  </h3>

                  <p>
                    Try another search.
                  </p>
                </div>
              ) : (
                <div className="people-grid">
                  {visiblePeople.map(
                    (person) => {
                      const isFollowing =
                        following.has(
                          person.id,
                        );

                      return (
                        <article
                          className="person-explore-card"
                          key={
                            person.id
                          }
                        >
                          <button
                            className="person-click"
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
                                alt=""
                                className="person-avatar"
                              />
                            ) : (
                              <div className="person-avatar person-avatar-placeholder">
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

                            <strong>
                              {person.full_name ||
                                "Inaivu user"}
                            </strong>

                            <span>
                              {person.username
                                ? `@${person.username}`
                                : "Inaivu"}
                            </span>

                            {person.bio && (
                              <p>
                                {person.bio}
                              </p>
                            )}
                          </button>

                          <button
                            className={
                              isFollowing
                                ? "person-follow following"
                                : "person-follow"
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
              )}
            </section>
          ) : tab ===
            "loops" ? (
            <section className="content-section">
              <div className="section-heading">
                <div>
                  <span>
                    LOOP
                  </span>

                  <h2>
                    Short videos
                  </h2>
                </div>

                <button
                  className="section-link"
                  onClick={() =>
                    router.push(
                      "/loop",
                    )
                  }
                >
                  Open Loop →
                </button>
              </div>

              {visibleLoops.length ===
              0 ? (
                <div className="empty-card">
                  <div className="empty-icon">
                    ▶
                  </div>

                  <h3>
                    No Loops found
                  </h3>

                  <p>
                    There are no matching
                    videos right now.
                  </p>
                </div>
              ) : (
                <div className="loop-list">
                  {visibleLoops.map(
                    (loop) => (
                      <PostCard
                        key={
                          loop.id
                        }
                        post={
                          loop
                        }
                        isLoop
                      />
                    ),
                  )}
                </div>
              )}
            </section>
          ) : (
            <div className="for-you-layout">
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <span>
                      TRENDING NOW
                    </span>

                    <h2>
                      Conversations worth
                      seeing
                    </h2>
                  </div>

                  <strong>
                    {
                      visiblePosts.length
                    }
                  </strong>
                </div>

                {visiblePosts.length ===
                0 ? (
                  <div className="empty-card">
                    <div className="empty-icon">
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                      </svg>
                    </div>

                    <h3>
                      Nothing to explore yet
                    </h3>

                    <p>
                      Once people start posting,
                      their conversations will
                      appear here.
                    </p>

                    <button
                      onClick={() =>
                        router.push(
                          "/home",
                        )
                      }
                    >
                      Go to Home
                    </button>
                  </div>
                ) : (
                  <div className="post-list">
                    {visiblePosts.map(
                      (post) => (
                        <PostCard
                          key={
                            post.id
                          }
                          post={
                            post
                          }
                        />
                      ),
                    )}
                  </div>
                )}
              </section>

              <aside className="discover-sidebar">
                <div className="side-card">
                  <div className="side-card-title">
                    <div>
                      <span>
                        PEOPLE
                      </span>

                      <h3>
                        Suggested
                      </h3>
                    </div>

                    <button
                      onClick={() =>
                        setTab(
                          "people",
                        )
                      }
                    >
                      See all
                    </button>
                  </div>

                  <div className="suggested-list">
                    {people
                      .slice(
                        0,
                        5,
                      )
                      .map(
                        (
                          person,
                        ) => {
                          const isFollowing =
                            following.has(
                              person.id,
                            );

                          return (
                            <div
                              className="suggested-person"
                              key={
                                person.id
                              }
                            >
                              <button
                                className="suggested-main"
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
                                    alt=""
                                  />
                                ) : (
                                  <div className="suggested-avatar">
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

                                <div>
                                  <strong>
                                    {person.full_name ||
                                      "Inaivu user"}
                                  </strong>

                                  <span>
                                    {person.username
                                      ? `@${person.username}`
                                      : "Inaivu"}
                                  </span>
                                </div>
                              </button>

                              <button
                                className={
                                  isFollowing
                                    ? "mini-follow following"
                                    : "mini-follow"
                                }
                                onClick={() =>
                                  toggleFollow(
                                    person.id,
                                  )
                                }
                              >
                                {isFollowing
                                  ? "✓"
                                  : "+"}
                              </button>
                            </div>
                          );
                        },
                      )}
                  </div>
                </div>

                <div className="side-card loop-side-card">
                  <div className="side-card-title">
                    <div>
                      <span>
                        LOOP
                      </span>

                      <h3>
                        Watch something
                      </h3>
                    </div>

                    <button
                      onClick={() =>
                        router.push(
                          "/loop",
                        )
                      }
                    >
                      Open
                    </button>
                  </div>

                  {loops
                    .slice(
                      0,
                      3,
                    )
                    .map(
                      (loop) => (
                        <button
                          className="side-loop"
                          key={
                            loop.id
                          }
                          onClick={() =>
                            openLoop(
                              loop.id,
                            )
                          }
                        >
                          <div className="side-loop-video">
                            {loop.media_url && (
                              <video
                                src={
                                  loop.media_url
                                }
                                muted
                                playsInline
                                preload="metadata"
                              />
                            )}

                            <span>
                              ▶
                            </span>
                          </div>

                          <div>
                            <strong>
                              {loop.content ||
                                "Watch this Loop"}
                            </strong>

                            <small>
                              {loop.likes} likes
                            </small>
                          </div>
                        </button>
                      ),
                    )}

                  {loops.length ===
                    0 && (
                    <p className="side-empty">
                      No Loops yet.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}

      <style jsx global>{`
        .explore-page {
          min-height: 100vh;
          background: #f8f3eb;
          color: #29231f;
        }

        .explore-header {
          position: sticky;
          top: 0;
          z-index: 50;
          height: 70px;
          background: rgba(
            248,
            243,
            235,
            0.94
          );
          border-bottom: 1px solid #e9ded4;
          backdrop-filter: blur(18px);
        }

        .header-inner {
          width: min(1180px, calc(100% - 40px));
          height: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 44px 1fr 44px;
          align-items: center;
          gap: 12px;
        }

        .back-button,
        .refresh-button {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e4d8ce;
          border-radius: 13px;
          background: #fffaf5;
          color: #655a52;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .back-button:hover,
        .refresh-button:hover:not(:disabled) {
          border-color: #ef704d;
          color: #ef704d;
          transform: translateY(-1px);
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-mark {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #ef704d;
          color: white;
          font-size: 18px;
          font-weight: 950;
          box-shadow: 0 7px 18px
            rgba(239, 112, 77, 0.18);
        }

        .brand strong {
          display: block;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .brand span {
          display: block;
          margin-top: 1px;
          color: #998d84;
          font-size: 10px;
          font-weight: 800;
        }

        .explore-container {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 34px 0 80px;
        }

        .hero {
          min-height: 255px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 42px 48px;
          border-radius: 30px;
          background: #fffaf5;
          border: 1px solid #eadfd5;
          box-shadow: 0 18px 45px
            rgba(76, 53, 39, 0.06);
        }

        .hero-copy {
          position: relative;
          z-index: 2;
          max-width: 620px;
        }

        .hero-kicker {
          display: inline-block;
          margin-bottom: 10px;
          color: #ef704d;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .hero h1 {
          margin: 0;
          color: #302823;
          font-size: clamp(32px, 5vw, 56px);
          line-height: 0.98;
          font-weight: 950;
          letter-spacing: -0.055em;
        }

        .hero p {
          max-width: 490px;
          margin: 17px 0 0;
          color: #8c8077;
          font-size: 14px;
          line-height: 1.65;
          font-weight: 600;
        }

        .hero-shape {
          position: relative;
          width: 250px;
          height: 200px;
          flex: 0 0 auto;
        }

        .hero-shape > span {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 2;
          width: 86px;
          height: 86px;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 30px;
          background: #ef704d;
          color: white;
          font-size: 42px;
          font-weight: 950;
          box-shadow: 0 18px 35px
            rgba(239, 112, 77, 0.2);
        }

        .shape-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid #f2c5b6;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .ring-one {
          width: 160px;
          height: 160px;
        }

        .ring-two {
          width: 230px;
          height: 230px;
          border-color: #f1ddd5;
        }

        .shape-dot {
          position: absolute;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #ef704d;
        }

        .dot-one {
          top: 17px;
          right: 28px;
        }

        .dot-two {
          left: 20px;
          bottom: 21px;
          width: 7px;
          height: 7px;
          background: #e9a28d;
        }

        .explore-search {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0 18px;
          padding: 7px 8px 7px 18px;
          border: 1px solid #e4d7cd;
          border-radius: 18px;
          background: #fffaf5;
          box-shadow: 0 9px 26px
            rgba(76, 53, 39, 0.04);
        }

        .explore-search:focus-within {
          border-color: #ef704d;
          box-shadow: 0 0 0 4px
            rgba(239, 112, 77, 0.08);
        }

        .explore-search > svg {
          flex: 0 0 auto;
          color: #9a8e85;
        }

        .explore-search input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: #302823;
          font-size: 14px;
          font-weight: 650;
        }

        .explore-search input::placeholder {
          color: #a69a91;
        }

        .search-clear {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: #eee5dd;
          color: #766a62;
          font-size: 20px;
          cursor: pointer;
        }

        .search-go {
          min-height: 42px;
          padding: 0 18px;
          border: 0;
          border-radius: 13px;
          background: #ef704d;
          color: white;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .tabs {
          display: flex;
          gap: 6px;
          padding: 5px;
          width: fit-content;
          border: 1px solid #e8dcd2;
          border-radius: 15px;
          background: #fffaf5;
        }

        .tab {
          min-width: 95px;
          min-height: 37px;
          padding: 0 14px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #897d74;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .tab:hover {
          color: #ef704d;
          background: #fff2e9;
        }

        .tab.active {
          background: #ef704d;
          color: white;
        }

        .for-you-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          align-items: start;
          gap: 22px;
        }

        .content-section {
          margin-top: 30px;
        }

        .for-you-layout .content-section {
          min-width: 0;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 15px;
        }

        .section-heading > div > span,
        .side-card-title > div > span {
          display: block;
          margin-bottom: 5px;
          color: #ef704d;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .section-heading h2 {
          margin: 0;
          color: #302823;
          font-size: 20px;
          line-height: 1.15;
          font-weight: 950;
          letter-spacing: -0.035em;
        }

        .section-heading > strong {
          min-width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #fff0e7;
          color: #d96040;
          font-size: 11px;
          font-weight: 950;
        }

        .section-link {
          border: 0;
          background: transparent;
          color: #df6645;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .post-list,
        .loop-list {
          display: grid;
          gap: 13px;
        }

        .post-card {
          overflow: hidden;
          border: 1px solid #e8ddd3;
          border-radius: 19px;
          background: #fffaf5;
          box-shadow: 0 9px 26px
            rgba(76, 53, 39, 0.035);
        }

        .post-top {
          min-height: 69px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
        }

        .author-button,
        .suggested-main,
        .person-click {
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .author-button {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0;
          text-align: left;
        }

        .avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          border-radius: 14px;
          object-fit: cover;
          background: #eee4da;
        }

        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffe2d6;
          color: #d55f3f;
          font-size: 15px;
          font-weight: 950;
        }

        .author-details {
          min-width: 0;
        }

        .author-details strong {
          display: block;
          overflow: hidden;
          color: #332b26;
          font-size: 12px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .author-details span {
          display: block;
          margin-top: 2px;
          color: #a0958d;
          font-size: 10px;
          font-weight: 700;
        }

        .more-button {
          width: 32px;
          height: 32px;
          border: 0;
          background: transparent;
          color: #9c9087;
          font-size: 13px;
          letter-spacing: 2px;
          cursor: pointer;
        }

        .post-copy {
          padding: 0 16px 14px;
        }

        .post-copy p {
          margin: 0;
          color: #463c35;
          font-size: 13px;
          line-height: 1.65;
          font-weight: 600;
          white-space: pre-wrap;
        }

        .post-copy p.clamped {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
        }

        .read-more {
          margin-top: 6px;
          border: 0;
          padding: 0;
          background: transparent;
          color: #df6645;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .media-frame {
          position: relative;
          display: block;
          width: 100%;
          border: 0;
          padding: 0;
          background: #2a211d;
          cursor: pointer;
        }

        .image-frame {
          max-height: 580px;
        }

        .image-frame img {
          display: block;
          width: 100%;
          max-height: 580px;
          object-fit: cover;
        }

        .video-frame {
          height: 390px;
        }

        .loop-frame {
          height: 430px;
        }

        .media-frame video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            transparent 55%,
            rgba(0, 0, 0, 0.28)
          );
        }

        .play-circle {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 2px;
          border-radius: 50%;
          background: rgba(
            255,
            250,
            245,
            0.92
          );
          color: #ef704d;
          box-shadow: 0 10px 25px
            rgba(0, 0, 0, 0.18);
        }

        .loop-label {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 6px 9px;
          border-radius: 8px;
          background: rgba(
            239,
            112,
            77,
            0.94
          );
          color: white;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        .post-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 10px;
          border-top: 1px solid #eee3da;
        }

        .action {
          min-height: 35px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 9px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #796e66;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .action:hover {
          background: #fff0e8;
          color: #df6645;
        }

        .action.liked {
          color: #e65f42;
        }

        .open-action {
          margin-left: auto;
          color: #df6645;
        }

        .comment-box {
          display: flex;
          gap: 7px;
          padding: 0 11px 10px;
        }

        .comment-box input {
          min-width: 0;
          flex: 1;
          height: 39px;
          padding: 0 12px;
          border: 1px solid #e4d8ce;
          border-radius: 11px;
          outline: 0;
          background: #fff;
          color: #332b26;
          font-size: 11px;
        }

        .comment-box input:focus {
          border-color: #ef704d;
        }

        .comment-box button {
          height: 39px;
          padding: 0 13px;
          border: 0;
          border-radius: 11px;
          background: #ef704d;
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .comment-box button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .post-time {
          padding: 0 15px 12px;
          color: #aaa097;
          font-size: 9px;
          font-weight: 700;
        }

        .discover-sidebar {
          position: sticky;
          top: 94px;
          display: grid;
          gap: 14px;
          margin-top: 30px;
        }

        .side-card {
          padding: 17px;
          border: 1px solid #e8ddd3;
          border-radius: 19px;
          background: #fffaf5;
          box-shadow: 0 9px 26px
            rgba(76, 53, 39, 0.035);
        }

        .side-card-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .side-card-title h3 {
          margin: 0;
          color: #332b26;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .side-card-title > button {
          border: 0;
          background: transparent;
          color: #df6645;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .suggested-list {
          display: grid;
          gap: 5px;
        }

        .suggested-person {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          padding: 7px 5px;
          border-radius: 12px;
        }

        .suggested-person:hover {
          background: #fff2e9;
        }

        .suggested-main {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0;
          text-align: left;
        }

        .suggested-main img,
        .suggested-avatar {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          object-fit: cover;
          border-radius: 11px;
        }

        .suggested-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffe4d8;
          color: #d55f3f;
          font-size: 12px;
          font-weight: 950;
        }

        .suggested-main strong {
          display: block;
          max-width: 150px;
          overflow: hidden;
          color: #403731;
          font-size: 10px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .suggested-main span {
          display: block;
          margin-top: 2px;
          color: #9b9088;
          font-size: 9px;
          font-weight: 700;
        }

        .mini-follow {
          width: 29px;
          height: 29px;
          border: 1px solid #ef704d;
          border-radius: 9px;
          background: #ef704d;
          color: white;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .mini-follow.following {
          border-color: #e3d6cd;
          background: #fffaf5;
          color: #7e726a;
        }

        .side-loop {
          width: 100%;
          display: grid;
          grid-template-columns: 55px 1fr;
          gap: 10px;
          padding: 7px 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .side-loop-video {
          position: relative;
          width: 55px;
          height: 67px;
          overflow: hidden;
          border-radius: 10px;
          background: #2a211d;
        }

        .side-loop-video video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .side-loop-video > span {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(
            -50%,
            -50%
          );
          width: 23px;
          height: 23px;
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
          font-size: 8px;
        }

        .side-loop > div:last-child {
          min-width: 0;
          padding-top: 4px;
        }

        .side-loop strong {
          display: -webkit-box;
          overflow: hidden;
          color: #443a34;
          font-size: 10px;
          line-height: 1.4;
          font-weight: 800;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .side-loop small {
          display: block;
          margin-top: 5px;
          color: #a0958c;
          font-size: 8px;
          font-weight: 700;
        }

        .side-empty {
          margin: 0;
          color: #9b9087;
          font-size: 10px;
          font-weight: 700;
        }

        .people-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 11px;
        }

        .person-explore-card {
          position: relative;
          min-width: 0;
          padding: 18px 15px 14px;
          border: 1px solid #e8ddd3;
          border-radius: 18px;
          background: #fffaf5;
          text-align: center;
          box-shadow: 0 9px 25px
            rgba(76, 53, 39, 0.035);
        }

        .person-click {
          width: 100%;
          padding: 0;
          text-align: center;
        }

        .person-avatar {
          width: 58px;
          height: 58px;
          display: block;
          margin: 0 auto 9px;
          object-fit: cover;
          border-radius: 18px;
          background: #eee4da;
        }

        .person-avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffe4d8;
          color: #d55f3f;
          font-size: 18px;
          font-weight: 950;
        }

        .person-click strong {
          display: block;
          overflow: hidden;
          color: #39302a;
          font-size: 12px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .person-click span {
          display: block;
          margin-top: 3px;
          color: #9a8e86;
          font-size: 9px;
          font-weight: 700;
        }

        .person-click p {
          display: -webkit-box;
          overflow: hidden;
          margin: 7px 0 10px;
          color: #81766e;
          font-size: 9px;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .person-follow {
          width: 100%;
          min-height: 34px;
          margin-top: 12px;
          border: 1px solid #ef704d;
          border-radius: 10px;
          background: #ef704d;
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .person-follow.following {
          border-color: #e2d6cc;
          background: #fffaf5;
          color: #746960;
        }

        .empty-card,
        .state-card {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 35px;
          border: 1px dashed #dfd2c8;
          border-radius: 19px;
          background: #fffaf5;
          text-align: center;
        }

        .empty-icon,
        .state-icon {
          width: 55px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border-radius: 18px;
          background: #fff0e7;
          color: #ef704d;
          font-size: 22px;
          font-weight: 950;
        }

        .empty-card h3,
        .state-card h2 {
          margin: 0;
          color: #3b322c;
          font-size: 16px;
          font-weight: 950;
        }

        .empty-card p,
        .state-card p {
          max-width: 410px;
          margin: 7px 0 16px;
          color: #958a82;
          font-size: 11px;
          line-height: 1.6;
        }

        .empty-card button,
        .state-card button {
          min-height: 37px;
          padding: 0 15px;
          border: 0;
          border-radius: 11px;
          background: #ef704d;
          color: white;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .toast {
          position: fixed;
          left: 50%;
          bottom: 25px;
          z-index: 100;
          transform: translateX(-50%);
          padding: 11px 16px;
          border-radius: 12px;
          background: #29231f;
          color: white;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 14px 35px
            rgba(0, 0, 0, 0.18);
        }

        html.dark .explore-page {
          background: #171412;
          color: #f5ece5;
        }

        html.dark .explore-header {
          background: rgba(
            23,
            20,
            18,
            0.94
          );
          border-color: #352d28;
        }

        html.dark .back-button,
        html.dark .refresh-button,
        html.dark .hero,
        html.dark .explore-search,
        html.dark .tabs,
        html.dark .post-card,
        html.dark .side-card,
        html.dark .person-explore-card,
        html.dark .empty-card,
        html.dark .state-card {
          border-color: #3a322d;
          background: #211d1a;
        }

        html.dark .hero h1,
        html.dark .section-heading h2,
        html.dark .section-heading > div > h2,
        html.dark .side-card-title h3,
        html.dark .person-click strong,
        html.dark .empty-card h3,
        html.dark .state-card h2 {
          color: #f5ece5;
        }

        html.dark .hero p,
        html.dark .author-details span,
        html.dark .post-copy p,
        html.dark .person-click span,
        html.dark .person-click p,
        html.dark .empty-card p,
        html.dark .state-card p,
        html.dark .suggested-main span,
        html.dark .side-loop small,
        html.dark .side-empty,
        html.dark .post-time {
          color: #9d9289;
        }

        html.dark .explore-search input {
          color: #f4ece6;
        }

        html.dark .explore-search input::placeholder {
          color: #7f746d;
        }

        html.dark .search-clear {
          background: #342c27;
          color: #b5a79e;
        }

        html.dark .tab {
          color: #9b9088;
        }

        html.dark .tab:hover {
          background: #2a211d;
        }

        html.dark .section-heading > strong {
          background: #30221d;
          color: #f2a082;
        }

        html.dark .post-actions {
          border-color: #382f2a;
        }

        html.dark .action {
          color: #9f948b;
        }

        html.dark .action:hover {
          background: #30221d;
          color: #f1a082;
        }

        html.dark .comment-box input {
          border-color: #403731;
          background: #181513;
          color: #f2e9e3;
        }

        html.dark .suggested-person:hover {
          background: #2a211d;
        }

        html.dark .mini-follow.following,
        html.dark .person-follow.following {
          border-color: #443932;
          background: #211d1a;
          color: #b7aaa1;
        }

        html.dark .avatar-placeholder,
        html.dark .person-avatar-placeholder,
        html.dark .suggested-avatar {
          background: #39271f;
          color: #f0a083;
        }

        @media (max-width: 950px) {
          .for-you-layout {
            grid-template-columns: 1fr;
          }

          .discover-sidebar {
            position: static;
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .people-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .hero-shape {
            width: 190px;
          }
        }

        @media (max-width: 680px) {
          .header-inner,
          .explore-container {
            width: min(
              100% - 24px,
              620px
            );
          }

          .explore-header {
            height: 64px;
          }

          .hero {
            min-height: 310px;
            padding: 28px 25px;
          }

          .hero-shape {
            position: absolute;
            right: -25px;
            bottom: -45px;
            width: 180px;
            opacity: 0.72;
          }

          .hero-copy {
            max-width: 100%;
          }

          .hero h1 {
            font-size: 37px;
          }

          .hero p {
            max-width: 300px;
          }

          .tabs {
            width: 100%;
          }

          .tab {
            flex: 1;
          }

          .discover-sidebar {
            grid-template-columns: 1fr;
          }

          .people-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .video-frame {
            height: 310px;
          }

          .loop-frame {
            height: 360px;
          }
        }

        @media (max-width: 480px) {
          .explore-container {
            padding-top: 18px;
          }

          .brand span {
            display: none;
          }

          .explore-search {
            min-height: 52px;
            padding-left: 13px;
          }

          .explore-search input {
            font-size: 12px;
          }

          .search-go {
            min-height: 38px;
            padding: 0 11px;
            font-size: 10px;
          }

          .hero {
            min-height: 285px;
            border-radius: 24px;
          }

          .hero h1 {
            font-size: 33px;
          }

          .hero p {
            font-size: 12px;
          }

          .section-heading h2 {
            font-size: 17px;
          }

          .post-card {
            border-radius: 16px;
          }

          .post-top {
            min-height: 62px;
            padding: 9px 11px;
          }

          .avatar {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .post-copy {
            padding: 0 13px 12px;
          }

          .post-copy p {
            font-size: 12px;
          }

          .image-frame {
            max-height: 430px;
          }

          .image-frame img {
            max-height: 430px;
          }

          .video-frame {
            height: 270px;
          }

          .loop-frame {
            height: 315px;
          }

          .post-actions {
            padding: 7px;
          }

          .action {
            padding: 0 7px;
            font-size: 9px;
          }

          .people-grid {
            gap: 8px;
          }

          .person-explore-card {
            padding: 15px 9px 11px;
          }

          .person-avatar {
            width: 50px;
            height: 50px;
          }
        }
      `}</style>
    </>
  );
}