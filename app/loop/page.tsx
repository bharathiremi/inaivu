"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type Profile = {
  id: string;
  username: string | null;
  full_name: string;
  bio?: string;
  avatar_url: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  media_url: string | null;
  media_type: string | null;
  media_path: string | null;
};

type PostView = Post & {
  profile: Profile | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  following: boolean;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: Profile | null;
};

export default function LoopPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);

  const [notice, setNotice] = useState("");

  const [muted, setMuted] = useState(true);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);

  const [commentsOpen, setCommentsOpen] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const [activeVideo, setActiveVideo] =
    useState<HTMLVideoElement | null>(null);

  const videoRefs = useRef<
    Record<string, HTMLVideoElement | null>
  >({});

  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    async function loadSavedLoops() {
      const result = await supabase
        .from("saved_loops")
        .select("post_id")
        .eq("user_id", userId);

      if (cancelled) {
        return;
      }

      if (result.error) {
        console.error("Load saved Loops failed:", {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
        });
        setSavedPosts([]);
        return;
      }

      setSavedPosts(
        (result.data ?? [])
          .map((row) => row.post_id)
          .filter(
            (id): id is string =>
              typeof id === "string",
          ),
      );
    }

    void loadSavedLoops();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    start();

    const channel = supabase
      .channel("inaivu-loop")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          loadLoopPosts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_likes",
        },
        () => {
          loadLoopPosts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
        },
        () => {
          loadLoopPosts();
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
          loadLoopPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function start() {
    setLoading(true);

    const result = await supabase.auth.getUser();

    if (!result.data.user) {
      router.replace("/login");
      return;
    }

    const id = result.data.user.id;

    setUserId(id);

    await Promise.all([
      loadProfile(id),
      loadLoopPosts(id),
    ]);

    setLoading(false);
  }

  async function loadProfile(id: string) {
    const result = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url",
      )
      .eq("id", id)
      .maybeSingle();

    if (result.error) {
      console.error(result.error);
      return;
    }

    setProfile(result.data as Profile | null);
  }

  async function loadLoopPosts(currentUserId = userId) {
    const id = currentUserId;

    const result = await supabase
      .from("posts")
      .select(
        "id, user_id, content, image_url, created_at, updated_at, media_url, media_type, media_path",
      )
      .not("media_url", "is", null)
      .ilike("media_type", "video%")
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (result.error) {
      console.error(result.error);
      setNotice(result.error.message);
      return;
    }

    const rawPosts = (result.data || []) as Post[];

    if (rawPosts.length === 0) {
      setPosts([]);
      return;
    }

    const userIds = Array.from(
      new Set(
        rawPosts.map(
          (post: Post) => post.user_id,
        ),
      ),
    );

    const postIds = rawPosts.map(
      (post: Post) => post.id,
    );

    const [
      profilesResult,
      likesResult,
      commentsResult,
      followsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, full_name, bio, avatar_url",
        )
        .in("id", userIds),

      supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds),

      supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),

      id
        ? supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", id)
            .in("following_id", userIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    const profiles =
      (profilesResult.data || []) as Profile[];

    const likes =
      (likesResult.data || []) as {
        post_id: string;
        user_id: string;
      }[];

    const commentRows =
      (commentsResult.data || []) as {
        post_id: string;
      }[];

    const follows =
      (followsResult.data || []) as {
        following_id: string;
      }[];

    const profileMap: Record<
      string,
      Profile
    > = {};

    profiles.forEach((item: Profile) => {
      profileMap[item.id] = item;
    });

    const likeMap: Record<string, number> = {};

    likes.forEach(
      (item: {
        post_id: string;
        user_id: string;
      }) => {
        likeMap[item.post_id] =
          (likeMap[item.post_id] || 0) + 1;
      },
    );

    const likedMap: Record<
      string,
      boolean
    > = {};

    likes.forEach(
      (item: {
        post_id: string;
        user_id: string;
      }) => {
        if (item.user_id === id) {
          likedMap[item.post_id] = true;
        }
      },
    );

    const commentMap: Record<
      string,
      number
    > = {};

    commentRows.forEach(
      (item: { post_id: string }) => {
        commentMap[item.post_id] =
          (commentMap[item.post_id] || 0) + 1;
      },
    );

    const followingMap: Record<
      string,
      boolean
    > = {};

    follows.forEach(
      (item: { following_id: string }) => {
        followingMap[item.following_id] = true;
      },
    );

    const resultPosts: PostView[] =
      rawPosts.map((post: Post) => ({
        ...post,
        profile:
          profileMap[post.user_id] || null,
        likeCount:
          likeMap[post.id] || 0,
        commentCount:
          commentMap[post.id] || 0,
        liked:
          likedMap[post.id] || false,
        following:
          followingMap[post.user_id] || false,
      }));

    setPosts(resultPosts);
  }

  function chooseLoopFile(
    selected: File | null,
  ) {
    if (!selected) {
      return;
    }

    if (!selected.type.startsWith("video/")) {
      setNotice(
        "Please select a video file.",
      );
      return;
    }

    const maxSize =
      100 * 1024 * 1024;

    if (selected.size > maxSize) {
      setNotice(
        "Maximum video size is 100 MB.",
      );
      return;
    }

    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }

    const previewUrl =
      URL.createObjectURL(selected);

    setUploadFile(selected);
    setUploadPreview(previewUrl);
  }

  function closeUpload() {
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }

    setUploadOpen(false);
    setUploadFile(null);
    setUploadPreview("");
    setUploadCaption("");
  }

  async function publishLoop() {
    if (!userId) {
      return;
    }

    if (!uploadFile) {
      setNotice(
        "Select a video first.",
      );
      return;
    }

    setUploading(true);
    setNotice("");

    let uploadedPath = "";

    try {
      const extension =
        uploadFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "mp4";

      const safeExtension =
        extension.replace(
          /[^a-z0-9]/g,
          "",
        ) || "mp4";

      const randomPart =
        Math.random()
          .toString(36)
          .slice(2, 10);

      const path =
        `${userId}/loops/${Date.now()}-${randomPart}.${safeExtension}`;

      uploadedPath = path;

      const upload =
        await supabase.storage
          .from("posts")
          .upload(
            path,
            uploadFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                uploadFile.type ||
                "video/mp4",
            },
          );

      if (upload.error) {
        const storageError = upload.error as {
          name?: string;
          message?: string;
          statusCode?: string | number;
          status?: string | number;
          error?: string;
          details?: string;
          hint?: string;
        };

        const message =
          storageError.message ||
          storageError.error ||
          "Video upload failed. Check the posts Storage bucket policy.";

        console.error("Loop storage upload failed:", {
          name: storageError.name,
          message,
          statusCode: storageError.statusCode,
          status: storageError.status,
          details: storageError.details,
          hint: storageError.hint,
          raw: storageError,
        });

        throw new Error(
          storageError.statusCode || storageError.status
            ? `Storage upload failed (${storageError.statusCode || storageError.status}): ${message}`
            : message,
        );
      }

      const publicUrl =
        supabase.storage
          .from("posts")
          .getPublicUrl(path);

      const mediaUrl =
        publicUrl.data.publicUrl;

      const insertResult =
        await supabase
          .from("posts")
          .insert({
            user_id: userId,
            content: uploadCaption.trim(),
            image_url: null,
            media_url: mediaUrl,
            // posts.media_type accepts the app-level media type,
            // not the browser MIME type (for example, video/mp4).
            media_type: "video",
            media_path: path,
          })
          .select(
            "id, user_id, content, image_url, created_at, updated_at, media_url, media_type, media_path",
          )
          .single();

      if (insertResult.error) {
        const dbError = insertResult.error as {
          name?: string;
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };

        await supabase.storage
          .from("posts")
          .remove([uploadedPath]);

        const message =
          dbError.message ||
          "Could not create the Loop post in the database.";

        console.error("Loop post insert failed:", {
          name: dbError.name,
          message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint,
          raw: dbError,
        });

        throw new Error(
          dbError.code
            ? `Loop post insert failed (${dbError.code}): ${message}`
            : message,
        );
      }

      closeUpload();

      await loadLoopPosts(userId);

      setNotice(
        "Your Loop was published.",
      );
    } catch (error) {
      const caught = error as {
        name?: string;
        message?: string;
        code?: string;
        statusCode?: string | number;
        status?: string | number;
        error?: string;
        details?: string;
        hint?: string;
      } | null;

      const errorMessage =
        error instanceof Error
          ? error.message
          : caught?.message ||
            caught?.error ||
            "Loop upload failed.";

      console.error("Loop upload error:", {
        name: caught?.name,
        message: errorMessage,
        code: caught?.code,
        statusCode: caught?.statusCode,
        status: caught?.status,
        details: caught?.details,
        hint: caught?.hint,
        raw: error,
      });

      setNotice(errorMessage);
    } finally {
      setUploading(false);
    }
  }

  async function likePost(
    post: PostView,
  ) {
    if (!userId) {
      return;
    }

    if (post.liked) {
      const result =
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId);

      if (result.error) {
        setNotice(
          result.error.message,
        );
        return;
      }
    } else {
      const result =
        await supabase
          .from("post_likes")
          .insert({
            post_id: post.id,
            user_id: userId,
          });

      if (result.error) {
        setNotice(
          result.error.message,
        );
        return;
      }
    }

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: !item.liked,
              likeCount:
                item.likeCount +
                (item.liked ? -1 : 1),
            }
          : item,
      ),
    );
  }

  async function showComments(
    postId: string,
  ) {
    setCommentsOpen(postId);
    setCommentsLoading(true);

    const result =
      await supabase
        .from("post_comments")
        .select(
          "id, post_id, user_id, content, created_at",
        )
        .eq("post_id", postId)
        .order("created_at", {
          ascending: true,
        });

    if (result.error) {
      setCommentsLoading(false);
      setNotice(
        result.error.message,
      );
      return;
    }

    const rows =
      (result.data || []) as Comment[];

    if (rows.length === 0) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }

    const ids = Array.from(
      new Set(
        rows.map(
          (item: Comment) =>
            item.user_id,
        ),
      ),
    );

    const profileResult =
      await supabase
        .from("profiles")
        .select(
          "id, username, full_name, bio, avatar_url",
        )
        .in("id", ids);

    const profileRows =
      (profileResult.data ||
        []) as Profile[];

    const profileMap: Record<
      string,
      Profile
    > = {};

    profileRows.forEach(
      (item: Profile) => {
        profileMap[item.id] = item;
      },
    );

    setComments(
      rows.map((item: Comment) => ({
        ...item,
        profile:
          profileMap[item.user_id] ||
          null,
      })),
    );

    setCommentsLoading(false);
  }

  async function sendComment(
    postId: string,
  ) {
    if (
      !userId ||
      !commentText.trim()
    ) {
      return;
    }

    const text =
      commentText.trim();

    const result =
      await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: userId,
          content: text,
        });

    if (result.error) {
      setNotice(
        result.error.message,
      );
      return;
    }

    setCommentText("");

    await showComments(postId);

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              commentCount:
                post.commentCount + 1,
            }
          : post,
      ),
    );
  }

  async function followCreator(
    creatorId: string,
  ) {
    if (
      !userId ||
      creatorId === userId
    ) {
      return;
    }

    const post =
      posts.find(
        (item) =>
          item.user_id ===
          creatorId,
      );

    const currentlyFollowing =
      post?.following || false;

    if (currentlyFollowing) {
      const result =
        await supabase
          .from("follows")
          .delete()
          .eq(
            "follower_id",
            userId,
          )
          .eq(
            "following_id",
            creatorId,
          );

      if (result.error) {
        setNotice(
          result.error.message,
        );
        return;
      }
    } else {
      const result =
        await supabase
          .from("follows")
          .insert({
            follower_id: userId,
            following_id: creatorId,
          });

      if (result.error) {
        setNotice(
          result.error.message,
        );
        return;
      }
    }

    setPosts((current) =>
      current.map((item) =>
        item.user_id === creatorId
          ? {
              ...item,
              following:
                !currentlyFollowing,
            }
          : item,
      ),
    );
  }

  async function toggleSave(
    postId: string,
  ) {
    if (!userId) {
      setNotice("Please sign in to save a Loop.");
      return;
    }

    const exists = savedPosts.includes(postId);

    if (exists) {
      const result = await supabase
        .from("saved_loops")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", postId);

      if (result.error) {
        console.error("Remove saved Loop failed:", {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
        });

        setNotice(
          result.error.message ||
            "Could not remove this Loop from saved.",
        );
        return;
      }

      setSavedPosts((current) =>
        current.filter((id) => id !== postId),
      );
      setNotice("Removed from saved.");
      return;
    }

    const result = await supabase
      .from("saved_loops")
      .insert({
        user_id: userId,
        post_id: postId,
      });

    if (result.error) {
      console.error("Save Loop failed:", {
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        code: result.error.code,
      });

      setNotice(
        result.error.message ||
          "Could not save this Loop.",
      );
      return;
    }

    setSavedPosts((current) =>
      current.includes(postId)
        ? current
        : [...current, postId],
    );
    setNotice("Loop saved.");
  }

  async function shareLoop(
    post: PostView,
  ) {
    const shareData = {
      title: "Inaivu Loop",
      text:
        post.content ||
        "Watch this Loop on Inaivu",
      url: window.location.href,
    };

    try {
      if (
        navigator.share
      ) {
        await navigator.share(
          shareData,
        );
        return;
      }

      await navigator.clipboard.writeText(
        window.location.href,
      );

      setNotice(
        "Loop link copied.",
      );
    } catch {
      // User cancelled sharing.
    }
  }

  async function deleteLoop(
    post: PostView,
  ) {
    if (
      !userId ||
      post.user_id !== userId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this Loop?",
      );

    if (!confirmed) {
      return;
    }

    if (post.media_path) {
      await supabase.storage
        .from("posts")
        .remove([
          post.media_path,
        ]);
    }

    const result =
      await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq(
          "user_id",
          userId,
        );

    if (result.error) {
      setNotice(
        result.error.message,
      );
      return;
    }

    setPosts((current) =>
      current.filter(
        (item) =>
          item.id !== post.id,
      ),
    );

    setNotice(
      "Loop deleted.",
    );
  }

  function setVideoRef(
    postId: string,
    node: HTMLVideoElement | null,
  ) {
    videoRefs.current[postId] =
      node;
  }

  function toggleVideo(
    post: PostView,
  ) {
    const video =
      videoRefs.current[post.id];

    if (!video) {
      return;
    }

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    const next = !muted;

    setMuted(next);

    Object.values(
      videoRefs.current,
    ).forEach((video) => {
      if (video) {
        video.muted = next;
      }
    });
  }

  useEffect(() => {
    if (!feedRef.current) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (
          entries: IntersectionObserverEntry[],
        ) => {
          const visibleEntries =
            entries.filter(
              (entry) =>
                entry.isIntersecting &&
                entry.intersectionRatio >
                  0.55,
            );

          if (
            visibleEntries.length ===
            0
          ) {
            return;
          }

          const bestEntry =
            visibleEntries.reduce(
              (
                best,
                current,
              ) =>
                current.intersectionRatio >
                best.intersectionRatio
                  ? current
                  : best,
            );

          const target =
            bestEntry.target as HTMLVideoElement;

          Object.values(
            videoRefs.current,
          ).forEach((video) => {
            if (
              video &&
              video !== target
            ) {
              video.pause();
            }
          });

          target.muted = muted;

          target
            .play()
            .catch(() => {});

          setActiveVideo(target);
        },
        {
          threshold: [
            0.25,
            0.55,
            0.75,
            0.9,
          ],
        },
      );

    Object.values(
      videoRefs.current,
    ).forEach((video) => {
      if (video) {
        observer.observe(video);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [
    posts,
    muted,
  ]);

  const hasSaved =
    useMemo(
      () =>
        new Set(
          savedPosts,
        ),
      [savedPosts],
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5ef]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl font-black text-white">
            இ
          </div>

          <p className="text-sm font-semibold text-[#756860]">
            Loading Loop...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="loop-page min-h-screen bg-[#f8f5ef] text-[#24211f]">
      <style jsx global>{`
        .dark .loop-page {
          background: #100d0b !important;
          color: #f7f2ee !important;
        }

        .dark .loop-page header {
          background: rgba(21,17,15,.97) !important;
          border-color: rgba(255,255,255,.08) !important;
        }

        .dark .loop-page .loop-card {
          background: #181411 !important;
          border-color: rgba(255,255,255,.08) !important;
        }

        .dark .loop-page .loop-surface {
          background: #211b18 !important;
          border-color: rgba(255,255,255,.08) !important;
        }

        .dark .loop-page input,
        .dark .loop-page textarea {
          background: #211b18 !important;
          color: #fff !important;
          border-color: rgba(255,255,255,.1) !important;
        }

        .dark .loop-page input::placeholder,
        .dark .loop-page textarea::placeholder {
          color: rgba(255,255,255,.42) !important;
        }

        .dark .loop-page nav {
          background: rgba(21,17,15,.98) !important;
          border-color: rgba(255,255,255,.08) !important;
        }

        .dark .loop-page .loop-text {
          color: #f1ebe6 !important;
        }

        .dark .loop-page .loop-muted {
          color: rgba(255,255,255,.55) !important;
        }

        .dark .loop-page .loop-button {
          color: #eee7e1 !important;
        }

        .dark .loop-page .loop-button:hover {
          background: rgba(255,255,255,.07) !important;
        }

        .loop-feed {
          scrollbar-width: none;
        }

        .loop-feed::-webkit-scrollbar {
          display: none;
        }

        .loop-video {
          aspect-ratio: 9 / 16;
          max-height: calc(100vh - 120px);
        }

        @media (max-width: 640px) {
          .loop-video {
            max-height: calc(100vh - 145px);
          }
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-[#e8ddd3] bg-[#fffdf9]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <button
            onClick={() =>
              router.push("/")
            }
            className="flex items-center gap-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef704d] text-lg font-black text-white">
              இ
            </div>

            <div className="hidden sm:block">
              <div className="text-lg font-black">
                Inaivu
              </div>

              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9b8b82]">
                Loop
              </div>
            </div>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() =>
                router.push("/")
              }
              className="rounded-full px-4 py-2 text-sm font-bold text-[#665b55] hover:bg-[#f8f5ef]"
            >
              Home
            </button>

            <button
              onClick={() =>
                router.push("/messages")
              }
              className="rounded-full px-4 py-2 text-sm font-bold text-[#665b55] hover:bg-[#f8f5ef]"
            >
              Messages
            </button>

            <button
              onClick={() =>
                setUploadOpen(true)
              }
              className="rounded-full bg-[#ef704d] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#df6040]"
            >
              + Create Loop
            </button>

            <button
              onClick={() =>
                router.push("/profile")
              }
            >
              <Avatar
                profile={profile}
                size="small"
              />
            </button>
          </div>
        </div>
      </header>

      {uploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="loop-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">
                  Create a Loop
                </h2>

                <p className="mt-1 text-sm text-[#8f8077]">
                  Share a short video with Inaivu.
                </p>
              </div>

              <button
                onClick={closeUpload}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f5ef] text-lg font-bold"
              >
                ×
              </button>
            </div>

            {!uploadFile ? (
              <label className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#e8ddd3] bg-[#f8f5ef] p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0e9] text-3xl">
                  🎬
                </div>

                <div className="font-black">
                  Choose your video
                </div>

                <p className="mt-2 max-w-xs text-sm text-[#8f8077]">
                  MP4, WebM, MOV and other browser-supported video formats.
                </p>

                <span className="mt-5 rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white">
                  Select video
                </span>

                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) =>
                    chooseLoopFile(
                      event.target.files?.item(
                        0,
                      ) || null,
                    )
                  }
                />
              </label>
            ) : (
              <>
                <div className="mt-5 overflow-hidden rounded-3xl bg-black">
                  <video
                    src={uploadPreview}
                    controls
                    playsInline
                    muted
                    className="mx-auto max-h-[55vh] w-full object-contain"
                  />
                </div>

                <div className="mt-4 rounded-2xl bg-[#f8f5ef] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">
                        {uploadFile.name}
                      </div>

                      <div className="mt-1 text-xs text-[#8f8077]">
                        {(
                          uploadFile.size /
                          1024 /
                          1024
                        ).toFixed(1)}{" "}
                        MB
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (
                          uploadPreview
                        ) {
                          URL.revokeObjectURL(
                            uploadPreview,
                          );
                        }

                        setUploadFile(
                          null,
                        );
                        setUploadPreview(
                          "",
                        );
                      }}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#d95638]"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <textarea
                  value={uploadCaption}
                  onChange={(event) =>
                    setUploadCaption(
                      event.target.value,
                    )
                  }
                  placeholder="Add a caption..."
                  rows={4}
                  maxLength={1000}
                  className="mt-4 w-full resize-none rounded-2xl border border-[#e8ddd3] bg-[#f8f5ef] p-4 text-sm outline-none focus:border-[#ef704d]"
                />

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={closeUpload}
                    className="rounded-full px-5 py-2.5 text-sm font-bold text-[#766a62]"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={uploading}
                    onClick={publishLoop}
                    className="rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {uploading
                      ? "Uploading..."
                      : "Publish Loop"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div
        ref={feedRef}
        className="loop-feed mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col items-center gap-6 overflow-y-auto px-3 py-4 pb-24"
      >
        {posts.length === 0 ? (
          <div className="loop-card mt-10 w-full max-w-2xl rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-10 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff0e9] text-4xl">
              ▶
            </div>

            <h1 className="text-2xl font-black">
              No Loops yet
            </h1>

            <p className="mt-2 text-sm text-[#8f8077]">
              Be the first to share a video on Inaivu.
            </p>

            <button
              onClick={() =>
                setUploadOpen(true)
              }
              className="mt-6 rounded-full bg-[#ef704d] px-6 py-3 text-sm font-bold text-white"
            >
              Create your first Loop
            </button>
          </div>
        ) : (
          posts.map((post) => {
            const saved =
              hasSaved.has(post.id);

            return (
              <article
                key={post.id}
                className="loop-card relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] shadow-sm"
              >
                <div className="relative bg-black">
                  <video
                    ref={(node) =>
                      setVideoRef(
                        post.id,
                        node,
                      )
                    }
                    src={
                      post.media_url ||
                      undefined
                    }
                    muted={muted}
                    playsInline
                    loop
                    preload="metadata"
                    className="loop-video mx-auto block w-full cursor-pointer object-contain"
                    onClick={() =>
                      toggleVideo(post)
                    }
                    onDoubleClick={() =>
                      likePost(post)
                    }
                  />

                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          router.push(
                            `/profile/${post.user_id}`,
                          )
                        }
                        className="pointer-events-auto"
                      >
                        <Avatar
                          profile={
                            post.profile
                          }
                          size="small"
                        />
                      </button>

                      <div className="text-white">
                        <button
                          onClick={() =>
                            router.push(
                              `/profile/${post.user_id}`,
                            )
                          }
                          className="pointer-events-auto block text-left text-sm font-black"
                        >
                          {post.profile
                            ?.full_name ||
                            post.profile
                              ?.username ||
                            "Inaivu user"}
                        </button>

                        <div className="text-[11px] text-white/65">
                          {post.profile
                            ?.username
                            ? `@${post.profile.username}`
                            : "Inaivu member"}
                        </div>
                      </div>

                      {post.user_id !==
                        userId && (
                        <button
                          onClick={() =>
                            followCreator(
                              post.user_id,
                            )
                          }
                          className={`pointer-events-auto rounded-full px-3 py-1.5 text-xs font-bold ${
                            post.following
                              ? "bg-white/15 text-white"
                              : "bg-white text-[#d95638]"
                          }`}
                        >
                          {post.following
                            ? "Following"
                            : "Follow"}
                        </button>
                      )}
                    </div>

                    <div className="pointer-events-auto flex items-center gap-2">
                      <button
                        onClick={
                          toggleMute
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur-sm"
                      >
                        {muted
                          ? "🔇"
                          : "🔊"}
                      </button>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-20">
                    {post.content && (
                      <p className="max-w-xl whitespace-pre-wrap text-sm font-medium leading-6 text-white">
                        {post.content}
                      </p>
                    )}

                    <div className="mt-2 text-[11px] text-white/60">
                      {timeAgo(
                        post.created_at,
                      )}
                    </div>
                  </div>

                  {activeVideo ===
                    videoRefs.current[
                      post.id
                    ] && (
                    <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      Playing
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#eee5dc] px-4 py-3">
                  <button
                    onClick={() =>
                      likePost(post)
                    }
                    className={`loop-button flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
                      post.liked
                        ? "bg-[#fff0e9] text-[#d95638]"
                        : "text-[#665b55] hover:bg-[#f8f5ef]"
                    }`}
                  >
                    <span className="text-lg">
                      {post.liked
                        ? "♥"
                        : "♡"}
                    </span>

                    <span>
                      {post.likeCount}
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      showComments(
                        post.id,
                      )
                    }
                    className="loop-button flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#665b55] hover:bg-[#f8f5ef]"
                  >
                    <span className="text-lg">
                      💬
                    </span>

                    <span>
                      {post.commentCount}
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      shareLoop(post)
                    }
                    className="loop-button flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#665b55] hover:bg-[#f8f5ef]"
                  >
                    <span className="text-lg">
                      ↗
                    </span>

                    <span className="hidden sm:inline">
                      Share
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      void toggleSave(post.id);
                    }}
                    aria-label={
                      saved
                        ? "Remove from saved"
                        : "Save Loop"
                    }
                    title={
                      saved
                        ? "Remove from saved"
                        : "Save Loop"
                    }
                    className={`loop-button flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition ${
                      saved
                        ? "bg-[#fff0e9] text-[#d95638]"
                        : "text-[#665b55] hover:bg-[#f8f5ef]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="relative flex h-5 w-5 items-center justify-center"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-5 w-5 transition-transform ${
                          saved ? "scale-110" : ""
                        }`}
                        fill={saved ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 4.75A2.25 2.25 0 0 1 8.25 2.5h7.5A2.25 2.25 0 0 1 18 4.75V21l-6-3.6L6 21V4.75Z" />
                      </svg>
                    </span>

                    <span className="hidden sm:inline">
                      {saved ? "Saved" : "Save"}
                    </span>
                  </button>

                  {post.user_id ===
                    userId && (
                    <button
                      onClick={() =>
                        deleteLoop(
                          post,
                        )
                      }
                      className="rounded-full px-3 py-2 text-xs font-bold text-[#a46656] hover:bg-[#fff0e9]"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {commentsOpen ===
                  post.id && (
                  <div className="loop-surface border-t border-[#e8ddd3] bg-[#faf7f2] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-black">
                          Comments
                        </h3>

                        <p className="mt-0.5 text-xs text-[#8f8077]">
                          Join the conversation
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setCommentsOpen(
                            "",
                          );
                          setComments([]);
                        }}
                        className="rounded-full px-3 py-2 text-sm font-bold text-[#766a62]"
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-72 space-y-3 overflow-y-auto">
                      {commentsLoading ? (
                        <div className="py-8 text-center text-sm text-[#8f8077]">
                          Loading comments...
                        </div>
                      ) : comments.length ===
                        0 ? (
                        <div className="py-8 text-center">
                          <div className="text-2xl">
                            💬
                          </div>

                          <p className="mt-2 text-sm font-semibold text-[#8f8077]">
                            No comments yet.
                          </p>
                        </div>
                      ) : (
                        comments.map(
                          (
                            comment,
                          ) => (
                            <div
                              key={
                                comment.id
                              }
                              className="flex gap-3"
                            >
                              <Avatar
                                profile={
                                  comment.profile
                                }
                                size="small"
                              />

                              <div className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3">
                                <div className="text-xs font-black">
                                  {comment
                                    .profile
                                    ?.full_name ||
                                    comment
                                      .profile
                                      ?.username ||
                                    "User"}
                                </div>

                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#4b433e]">
                                  {
                                    comment.content
                                  }
                                </p>

                                <div className="mt-1 text-[10px] text-[#a09188]">
                                  {timeAgo(
                                    comment.created_at,
                                  )}
                                </div>
                              </div>
                            </div>
                          ),
                        )
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
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
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();

                            sendComment(
                              post.id,
                            );
                          }
                        }}
                        placeholder="Write a comment..."
                        className="min-w-0 flex-1 rounded-full border border-[#e8ddd3] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ef704d]"
                      />

                      <button
                        onClick={() =>
                          sendComment(
                            post.id,
                          )
                        }
                        className="rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e8ddd3] bg-[#fffdf9] px-3 py-2 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <MobileButton
            label="Home"
            icon="⌂"
            onClick={() =>
              router.push("/")
            }
          />

          <MobileButton
            label="Loop"
            icon="▶"
            active
            onClick={() =>
              router.push("/loop")
            }
          />

          <button
            onClick={() =>
              setUploadOpen(true)
            }
            className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl text-white shadow-lg"
          >
            +
          </button>

          <MobileButton
            label="Chat"
            icon="✦"
            onClick={() =>
              router.push(
                "/messages",
              )
            }
          />

          <button
            onClick={() =>
              router.push("/profile")
            }
          >
            <Avatar
              profile={profile}
              size="small"
            />
          </button>
        </div>
      </nav>

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[200] w-[calc(100%-32px)] max-w-md -translate-x-1/2">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#292522] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
            <span>{notice}</span>

            <button
              onClick={() =>
                setNotice("")
              }
              className="shrink-0 text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Avatar({
  profile,
  size = "medium",
}: {
  profile: Profile | null;
  size?: "small" | "medium" | "large";
}) {
  const sizeClass =
    size === "small"
      ? "h-9 w-9 text-sm"
      : size === "large"
        ? "h-16 w-16 text-xl"
        : "h-11 w-11 text-base";

  const initial =
    profile?.full_name
      ?.charAt(0)
      ?.toUpperCase() ||
    profile?.username
      ?.charAt(0)
      ?.toUpperCase() ||
    "U";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6c95f] font-bold text-[#4d362d]`}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={
            profile.full_name ||
            "User"
          }
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </div>
  );
}

function MobileButton({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 ${
        active
          ? "text-[#d95638]"
          : "text-[#766a62]"
      }`}
    >
      <span className="text-base">
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
    (now.getTime() -
      date.getTime()) /
      1000,
  );

  if (seconds < 60) {
    return "Just now";
  }

  if (seconds < 3600) {
    return `${Math.floor(
      seconds / 60,
    )}m`;
  }

  if (seconds < 86400) {
    return `${Math.floor(
      seconds / 3600,
    )}h`;
  }

  if (seconds < 604800) {
    return `${Math.floor(
      seconds / 86400,
    )}d`;
  }

  return date.toLocaleDateString();
}