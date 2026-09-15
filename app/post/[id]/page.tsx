"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  full_name: string;
  avatar_url: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

function getProfile(
  profile: Profile | Profile[] | null
): Profile | null {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diff = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (diff < 60) return "இப்போது";

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes} நிமிடம் முன்`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} மணி முன்`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} நாள் முன்`;

  return date.toLocaleDateString("ta-IN");
}

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const postId = params.id;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  const [userId, setUserId] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const [commentText, setCommentText] = useState("");

  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (!postId) return;

    loadPost();
  }, [postId]);

  async function loadPost() {
    setLoading(true);
    setError("");

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // -----------------------------
      // POST
      // -----------------------------

      const {
        data: postData,
        error: postError,
      } = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          content,
          media_url,
          media_type,
          created_at,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("id", postId)
        .maybeSingle();

      if (postError) {
        throw postError;
      }

      if (!postData) {
        setPost(null);
        setLoading(false);
        return;
      }

      setPost(postData as Post);

      // -----------------------------
      // LIKES
      // -----------------------------

      const {
        data: likes,
        error: likesError,
      } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", postId);

      if (likesError) {
        console.error(likesError);
      }

      setLikeCount(likes?.length ?? 0);

      setLiked(
        (likes ?? []).some(
          (like) => like.user_id === user.id
        )
      );

      // -----------------------------
      // SAVED
      // -----------------------------

      const {
        data: savedData,
        error: savedError,
      } = await supabase
        .from("saved_posts")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (savedError) {
        console.error(savedError);
      }

      setSaved(!!savedData);

      // -----------------------------
      // COMMENTS
      // -----------------------------

      const {
        data: commentData,
        error: commentsError,
      } = await supabase
        .from("post_comments")
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .order("created_at", {
          ascending: true,
        });

      if (commentsError) {
        throw commentsError;
      }

      setComments((commentData ?? []) as Comment[]);
      setCommentCount(commentData?.length ?? 0);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Post-ஐ load செய்ய முடியவில்லை."
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------
  // LIKE / UNLIKE
  // -----------------------------------

  async function toggleLike() {
    if (!userId || !postId || actionLoading) return;

    setActionLoading(true);
    setMessage("");

    const oldLiked = liked;
    const oldCount = likeCount;

    // Optimistic UI
    setLiked(!liked);
    setLikeCount(
      liked
        ? Math.max(0, likeCount - 1)
        : likeCount + 1
    );

    try {
      if (oldLiked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;
      }
    } catch (err: any) {
      console.error(err);

      setLiked(oldLiked);
      setLikeCount(oldCount);

      setError(
        err?.message || "Like update செய்ய முடியவில்லை."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // -----------------------------------
  // SAVE / UNSAVE
  // -----------------------------------

  async function toggleSave() {
    if (!userId || !postId || actionLoading) return;

    setActionLoading(true);
    setMessage("");

    const oldSaved = saved;

    // Optimistic UI
    setSaved(!saved);

    try {
      if (oldSaved) {
        const { error } = await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) throw error;

        setMessage("Saved Posts-லிருந்து நீக்கப்பட்டது.");
      } else {
        const { error } = await supabase
          .from("saved_posts")
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;

        setMessage("Post Save செய்யப்பட்டது. 🔖");
      }
    } catch (err: any) {
      console.error(err);

      setSaved(oldSaved);

      setError(
        err?.message || "Save update செய்ய முடியவில்லை."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // -----------------------------------
  // SHARE
  // -----------------------------------

  async function sharePost() {
    if (!postId) return;

    const shareUrl =
      `${window.location.origin}/post/${postId}`;

    const shareText =
      post?.content?.trim()
        ? post.content.trim().slice(0, 120)
        : "இணைவு-வில் ஒரு post";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "இணைவு",
          text: shareText,
          url: shareUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(shareUrl);

      setMessage("Post link copy செய்யப்பட்டது! 🔗");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(shareUrl);

        setMessage(
          "Share link copy செய்யப்பட்டது! 🔗"
        );
      } catch {
        setError(
          "Share link copy செய்ய முடியவில்லை."
        );
      }
    }
  }

  // -----------------------------------
  // ADD COMMENT
  // -----------------------------------

  async function addComment(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!userId || !postId) return;

    const content = commentText.trim();

    if (!content) return;

    setCommentLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          content,
        })
        .select(`
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      setComments((prev) => [
        ...prev,
        data as Comment,
      ]);

      setCommentCount((prev) => prev + 1);
      setCommentText("");
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "Comment செய்ய முடியவில்லை."
      );
    } finally {
      setCommentLoading(false);
    }
  }

  // -----------------------------------
  // DELETE COMMENT
  // -----------------------------------

  async function deleteComment(
    commentId: string
  ) {
    if (!userId) return;

    const previousComments = comments;

    setComments((prev) =>
      prev.filter(
        (comment) => comment.id !== commentId
      )
    );

    setCommentCount((prev) =>
      Math.max(0, prev - 1)
    );

    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", userId);

      if (error) throw error;
    } catch (err: any) {
      console.error(err);

      setComments(previousComments);
      setCommentCount(previousComments.length);

      setError(
        err?.message ||
          "Comment delete செய்ய முடியவில்லை."
      );
    }
  }

  // -----------------------------------
  // LOADING
  // -----------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5faf7] px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 h-10 w-32 animate-pulse rounded-xl bg-white" />

          <div className="overflow-hidden rounded-3xl border border-[#dcebe1] bg-white shadow-sm">
            <div className="h-24 animate-pulse bg-[#eef7f1]" />

            <div className="space-y-4 p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-[#edf4ef]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[#edf4ef]" />
              <div className="h-64 animate-pulse rounded-2xl bg-[#edf4ef]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // -----------------------------------
  // ERROR
  // -----------------------------------

  if (error && !post) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5faf7] px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            ⚠️
          </div>

          <h1 className="text-xl font-bold text-[#173d2a]">
            Something went wrong
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-2xl border border-[#dcebe1] px-4 py-3 font-semibold text-[#315d46] hover:bg-[#f4faf6]"
            >
              ← Back
            </button>

            <button
              onClick={loadPost}
              className="flex-1 rounded-2xl bg-[#159447] px-4 py-3 font-semibold text-white hover:bg-[#107c3b]"
            >
              மீண்டும்
            </button>
          </div>
        </div>
      </main>
    );
  }

  // -----------------------------------
  // POST NOT FOUND
  // -----------------------------------

  if (!post) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5faf7] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[#dcebe1] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf7ef] text-3xl">
            📭
          </div>

          <h1 className="text-2xl font-bold text-[#173d2a]">
            Post கிடைக்கவில்லை
          </h1>

          <p className="mt-2 text-sm text-[#718078]">
            இந்த post delete செய்யப்பட்டிருக்கலாம்
            அல்லது கிடைக்கவில்லை.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-2xl bg-[#159447] px-6 py-3 font-semibold text-white hover:bg-[#107c3b]"
          >
            Home-க்கு செல்ல
          </button>
        </div>
      </main>
    );
  }

  const profile = getProfile(post.profiles);

  return (
    <main className="min-h-screen bg-[#f5faf7]">
      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-[#dcebe1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#315d46] transition hover:bg-[#f1f8f3]"
          >
            ← Back
          </button>

          <button
            onClick={() => router.push("/")}
            className="text-xl font-black tracking-tight text-[#159447]"
          >
            இணைவு
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-[#315d46] transition hover:bg-[#f1f8f3]"
          >
            Profile
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* STATUS */}

        {message && (
          <div className="mb-4 rounded-2xl border border-[#cfe8d8] bg-[#edf9f1] px-4 py-3 text-sm font-semibold text-[#237343]">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* POST CARD */}

        <article className="overflow-hidden rounded-3xl border border-[#dcebe1] bg-white shadow-sm">
          {/* USER */}

          <div className="flex items-center justify-between p-5">
            <button
              onClick={() =>
                router.push(`/profile/${post.user_id}`)
              }
              className="flex min-w-0 items-center gap-3 text-left"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || "Profile"}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dff3e5] text-lg font-bold text-[#159447]">
                  {(
                    profile?.full_name ||
                    profile?.username ||
                    "U"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate font-bold text-[#173d2a]">
                  {profile?.full_name ||
                    profile?.username ||
                    "இணைவு பயனர்"}
                </p>

                {profile?.username && (
                  <p className="truncate text-sm text-[#7a8780]">
                    @{profile.username}
                  </p>
                )}

                <p className="mt-0.5 text-xs text-[#9aa69f]">
                  {formatTime(post.created_at)}
                </p>
              </div>
            </button>

            <button
              onClick={sharePost}
              className="rounded-xl px-3 py-2 text-xl transition hover:bg-[#f3f9f5]"
              title="Share"
            >
              ↗️
            </button>
          </div>

          {/* CONTENT */}

          {post.content?.trim() && (
            <div className="px-5 pb-5">
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#263c31]">
                {post.content}
              </p>
            </div>
          )}

          {/* IMAGE */}

          {post.media_url &&
            post.media_type?.startsWith("image") && (
              <div className="border-y border-[#edf2ee] bg-black">
                <img
                  src={post.media_url}
                  alt="Post media"
                  className="mx-auto max-h-[700px] w-full object-contain"
                />
              </div>
            )}

          {/* VIDEO */}

          {post.media_url &&
            post.media_type?.startsWith("video") && (
              <div className="border-y border-[#edf2ee] bg-black">
                <video
                  src={post.media_url}
                  controls
                  playsInline
                  className="mx-auto max-h-[700px] w-full"
                />
              </div>
            )}

          {/* ACTIONS */}

          <div className="border-t border-[#edf2ee] p-3">
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={toggleLike}
                disabled={actionLoading}
                className={`rounded-2xl px-2 py-3 text-center text-sm font-semibold transition ${
                  liked
                    ? "bg-red-50 text-red-500"
                    : "text-[#66756d] hover:bg-[#f4faf6]"
                }`}
              >
                <div className="text-lg">
                  {liked ? "❤️" : "🤍"}
                </div>
                <div className="mt-1">
                  {likeCount}
                </div>
              </button>

              <button
                onClick={() => {
                  document
                    .getElementById("comment-box")
                    ?.focus();
                }}
                className="rounded-2xl px-2 py-3 text-center text-sm font-semibold text-[#66756d] transition hover:bg-[#f4faf6]"
              >
                <div className="text-lg">💬</div>
                <div className="mt-1">
                  {commentCount}
                </div>
              </button>

              <button
                onClick={toggleSave}
                disabled={actionLoading}
                className={`rounded-2xl px-2 py-3 text-center text-sm font-semibold transition ${
                  saved
                    ? "bg-[#eaf8ee] text-[#159447]"
                    : "text-[#66756d] hover:bg-[#f4faf6]"
                }`}
              >
                <div className="text-lg">
                  {saved ? "🔖" : "📑"}
                </div>
                <div className="mt-1">
                  {saved ? "Saved" : "Save"}
                </div>
              </button>

              <button
                onClick={sharePost}
                className="rounded-2xl px-2 py-3 text-center text-sm font-semibold text-[#66756d] transition hover:bg-[#f4faf6]"
              >
                <div className="text-lg">🔗</div>
                <div className="mt-1">Share</div>
              </button>
            </div>
          </div>
        </article>

        {/* COMMENTS */}

        <section className="mt-5 overflow-hidden rounded-3xl border border-[#dcebe1] bg-white shadow-sm">
          <div className="border-b border-[#edf2ee] px-5 py-4">
            <h2 className="font-bold text-[#173d2a]">
              கருத்துகள்
            </h2>
          </div>

          {/* ADD COMMENT */}

          <form
            onSubmit={addComment}
            className="border-b border-[#edf2ee] p-4"
          >
            <div className="flex gap-3">
              <input
                id="comment-box"
                value={commentText}
                onChange={(e) =>
                  setCommentText(e.target.value)
                }
                placeholder="ஒரு கருத்தை எழுதுங்கள்..."
                maxLength={1000}
                className="min-w-0 flex-1 rounded-2xl border border-[#dcebe1] bg-[#f8fbf9] px-4 py-3 text-sm text-[#24382d] outline-none transition focus:border-[#159447] focus:bg-white"
              />

              <button
                type="submit"
                disabled={
                  commentLoading ||
                  !commentText.trim()
                }
                className="rounded-2xl bg-[#159447] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#107c3b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commentLoading
                  ? "..."
                  : "பதிவு"}
              </button>
            </div>
          </form>

          {/* COMMENT LIST */}

          <div>
            {comments.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-3xl">💬</div>

                <p className="mt-3 font-semibold text-[#506158]">
                  இன்னும் கருத்துகள் இல்லை
                </p>

                <p className="mt-1 text-sm text-[#89958e]">
                  முதல் கருத்தை நீங்களே பதிவு செய்யுங்கள்.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#edf2ee]">
                {comments.map((comment) => {
                  const commentProfile =
                    getProfile(comment.profiles);

                  const isMine =
                    comment.user_id === userId;

                  return (
                    <div
                      key={comment.id}
                      className="flex gap-3 p-5"
                    >
                      {commentProfile?.avatar_url ? (
                        <img
                          src={commentProfile.avatar_url}
                          alt={
                            commentProfile.full_name ||
                            "Profile"
                          }
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e4f5e9] text-sm font-bold text-[#159447]">
                          {(
                            commentProfile?.full_name ||
                            commentProfile?.username ||
                            "U"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <button
                              onClick={() =>
                                router.push(
                                  `/profile/${comment.user_id}`
                                )
                              }
                              className="font-bold text-[#173d2a] hover:underline"
                            >
                              {commentProfile?.full_name ||
                                commentProfile?.username ||
                                "இணைவு பயனர்"}
                            </button>

                            {commentProfile?.username && (
                              <span className="ml-2 text-xs text-[#89958e]">
                                @{commentProfile.username}
                              </span>
                            )}

                            <p className="text-xs text-[#9aa69f]">
                              {formatTime(
                                comment.created_at
                              )}
                            </p>
                          </div>

                          {isMine && (
                            <button
                              onClick={() =>
                                deleteComment(
                                  comment.id
                                )
                              }
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#35483d]">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* FOOTER NAV */}

        <div className="mt-6 flex justify-center gap-3 pb-8">
          <button
            onClick={() => router.push("/")}
            className="rounded-2xl border border-[#dcebe1] bg-white px-5 py-3 text-sm font-semibold text-[#315d46] hover:bg-[#f4faf6]"
          >
            🏠 Home
          </button>

          <button
            onClick={() => router.push("/saved")}
            className="rounded-2xl border border-[#dcebe1] bg-white px-5 py-3 text-sm font-semibold text-[#315d46] hover:bg-[#f4faf6]"
          >
            🔖 Saved
          </button>
        </div>
      </div>
    </main>
  );
}