"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AdSlot from "@/components/AdSlot";

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
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: Profile | null;
};

export default function HomePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [posts, setPosts] = useState<PostView[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [notice, setNotice] = useState("");

  useEffect(() => {
    start();

    const channel = supabase
      .channel("inaivu-home")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          loadPosts();
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
          loadPosts();
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
          loadPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function start() {
    setLoading(true);

    const result = await supabase.auth.getUser();

    if (!result.data.user) {
      router.push("/login");
      return;
    }

    const id = result.data.user.id;

    setUserId(id);

    await Promise.all([
      loadProfile(id),
      loadPeople(id),
      loadFollowing(id),
      loadPosts(),
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

  async function loadPeople(id: string) {
    const result = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url",
      )
      .neq("id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (result.error) {
      console.error(result.error);
      return;
    }

    setPeople((result.data || []) as Profile[]);
  }

  async function loadFollowing(id: string) {
    const result = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", id);

    if (result.error) {
      console.error(result.error);
      return;
    }

    const ids = (result.data || []).map(
      (item: { following_id: string }) =>
        item.following_id,
    );

    setFollowing(ids);
  }

  async function loadPosts() {
    const result = await supabase
      .from("posts")
      .select(
        "id, user_id, content, image_url, created_at, updated_at, media_url, media_type, media_path",
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

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

    const ids = Array.from(
      new Set(
        rawPosts.map(
          (post: Post) => post.user_id,
        ),
      ),
    );

    const postIds = rawPosts.map(
      (post: Post) => post.id,
    );

    const profilesResult = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url",
      )
      .in("id", ids);

    const likesResult = await supabase
      .from("post_likes")
      .select("post_id, user_id")
      .in("post_id", postIds);

    const commentsResult = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    const profiles = (profilesResult.data ||
      []) as Profile[];

    const likes = (likesResult.data || []) as {
      post_id: string;
      user_id: string;
    }[];

    const commentRows = (commentsResult.data ||
      []) as {
      post_id: string;
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
        if (!likeMap[item.post_id]) {
          likeMap[item.post_id] = 0;
        }

        likeMap[item.post_id] += 1;
      },
    );

    const likedMap: Record<string, boolean> = {};

    likes.forEach(
      (item: {
        post_id: string;
        user_id: string;
      }) => {
        if (item.user_id === userId) {
          likedMap[item.post_id] = true;
        }
      },
    );

    const commentMap: Record<string, number> = {};

    commentRows.forEach(
      (item: { post_id: string }) => {
        if (!commentMap[item.post_id]) {
          commentMap[item.post_id] = 0;
        }

        commentMap[item.post_id] += 1;
      },
    );

    const resultPosts: PostView[] = rawPosts.map(
      (post: Post) => ({
        ...post,
        profile:
          profileMap[post.user_id] || null,
        likeCount: likeMap[post.id] || 0,
        commentCount:
          commentMap[post.id] || 0,
        liked: likedMap[post.id] || false,
      }),
    );

    setPosts(resultPosts);
  }

  function chooseFile(selected: File | null) {
    if (!selected) {
      return;
    }

    if (
      !selected.type.startsWith("image/") &&
      !selected.type.startsWith("video/")
    ) {
      setNotice(
        "Please choose an image or video.",
      );
      return;
    }

    if (
      selected.size >
      100 * 1024 * 1024
    ) {
      setNotice("Maximum size is 100 MB.");
      return;
    }

    setFile(selected);

    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
    } else {
      setPreview("");
    }
  }

  async function publish() {
    if (!userId) {
      return;
    }

    if (!text.trim() && !file) {
      setNotice(
        "Write something or select a photo/video.",
      );
      return;
    }

    setPosting(true);

    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    let mediaPath: string | null = null;

    if (file) {
      const extension =
        file.name.split(".").pop() ||
        "file";

      const path =
        `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

      const upload = await supabase.storage
        .from("posts")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (upload.error) {
        setNotice(upload.error.message);
        setPosting(false);
        return;
      }

      const publicUrl = supabase.storage
        .from("posts")
        .getPublicUrl(path);

      mediaUrl = publicUrl.data.publicUrl;
      mediaPath = path;

      if (file.type.startsWith("image/")) {
        mediaType = "image";
      }

      if (file.type.startsWith("video/")) {
        mediaType = "video";
      }
    }

    const insertResult = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: text.trim() || null,
        image_url:
          mediaType === "image"
            ? mediaUrl
            : null,
        media_url: mediaUrl,
        media_type: mediaType,
        media_path: mediaPath,
      });

    if (insertResult.error) {
      setNotice(
        insertResult.error.message,
      );
      setPosting(false);
      return;
    }

    setText("");
    setFile(null);
    setPreview("");
    setComposer(false);

    await loadPosts();

    setNotice("Post published.");
    setPosting(false);
  }

  async function likePost(post: PostView) {
    if (!userId) {
      return;
    }

    if (post.liked) {
      const result = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId);

      if (result.error) {
        setNotice(result.error.message);
        return;
      }
    } else {
      const result = await supabase
        .from("post_likes")
        .insert({
          post_id: post.id,
          user_id: userId,
        });

      if (result.error) {
        setNotice(result.error.message);
        return;
      }
    }

    await loadPosts();
  }

  async function showComments(postId: string) {
    setCommentsOpen(postId);

    const result = await supabase
      .from("post_comments")
      .select(
        "id, post_id, user_id, content, created_at",
      )
      .eq("post_id", postId)
      .order("created_at", {
        ascending: true,
      });

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    const rows = (result.data || []) as Comment[];

    if (rows.length === 0) {
      setComments([]);
      return;
    }

    const ids = Array.from(
      new Set(
        rows.map(
          (item: Comment) => item.user_id,
        ),
      ),
    );

    const profileResult = await supabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url",
      )
      .in("id", ids);

    const profileRows =
      (profileResult.data || []) as Profile[];

    const profileMap: Record<
      string,
      Profile
    > = {};

    profileRows.forEach((item: Profile) => {
      profileMap[item.id] = item;
    });

    const finalComments: Comment[] =
      rows.map((item: Comment) => ({
        ...item,
        profile:
          profileMap[item.user_id] ||
          null,
      }));

    setComments(finalComments);
  }

  async function sendComment(postId: string) {
    if (!userId || !commentText.trim()) {
      return;
    }

    const result = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: commentText.trim(),
      });

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    setCommentText("");

    await showComments(postId);
    await loadPosts();
  }

  async function follow(personId: string) {
    if (!userId) {
      return;
    }

    const exists =
      following.includes(personId);

    if (exists) {
      const result = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", personId);

      if (result.error) {
        setNotice(result.error.message);
        return;
      }
    } else {
      const result = await supabase
        .from("follows")
        .insert({
          follower_id: userId,
          following_id: personId,
        });

      if (result.error) {
        setNotice(result.error.message);
        return;
      }
    }

    await loadFollowing(userId);
  }

  async function removePost(post: PostView) {
    if (!userId || post.user_id !== userId) {
      return;
    }

    const yes = window.confirm(
      "Delete this post?",
    );

    if (!yes) {
      return;
    }

    if (post.media_path) {
      await supabase.storage
        .from("posts")
        .remove([post.media_path]);
    }

    const result = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", userId);

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    await loadPosts();
    setNotice("Post deleted.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visiblePeople = people.filter(
    (person: Profile) => {
      const value =
        search.trim().toLowerCase();

      if (!value) {
        return true;
      }

      const name =
        person.full_name?.toLowerCase() ||
        "";

      const username =
        person.username?.toLowerCase() ||
        "";

      return (
        name.includes(value) ||
        username.includes(value)
      );
    },
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5ef]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl font-black text-white">
            இ
          </div>

          <p className="text-sm font-semibold text-[#756860]">
            Loading Inaivu...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="inaivu-home min-h-screen bg-[#f8f5ef] pb-20 text-[#24211f] lg:pb-0">
      <style jsx global>{`
        .dark .inaivu-home {
          background: #100d0b !important;
          color: #f7f2ee !important;
        }

        .dark .inaivu-home header {
          background: rgba(21,17,15,.96) !important;
          border-color: rgba(255,255,255,.08) !important;
        }

        .dark .inaivu-home article,
        .dark .inaivu-home aside > div,
        .dark .inaivu-home [class*="bg-[#fffdf9]"] {
          background: #181411 !important;
          border-color: rgba(255,255,255,.08) !important;
          color: #f7f2ee !important;
        }

        .dark .inaivu-home [class*="bg-[#f8f5ef]"],
        .dark .inaivu-home [class*="bg-[#faf7f2]"] {
          background: #211b18 !important;
          color: #f7f2ee !important;
        }

        .dark .inaivu-home [class*="text-[#24211f]"],
        .dark .inaivu-home [class*="text-[#403a36]"],
        .dark .inaivu-home [class*="text-[#4b433e]"],
        .dark .inaivu-home [class*="text-[#665b55]"] {
          color: #f1ebe6 !important;
        }

        .dark .inaivu-home [class*="text-[#756860]"],
        .dark .inaivu-home [class*="text-[#766a62]"],
        .dark .inaivu-home [class*="text-[#988981]"],
        .dark .inaivu-home [class*="text-[#8f8077]"],
        .dark .inaivu-home [class*="text-[#998a81]"],
        .dark .inaivu-home [class*="text-[#a09188]"],
        .dark .inaivu-home [class*="text-[#988a81]"],
        .dark .inaivu-home [class*="text-[#9b8b82]"] {
          color: rgba(255,255,255,.55) !important;
        }

        .dark .inaivu-home [class*="border-[#e8ddd3]"],
        .dark .inaivu-home [class*="bg-[#eee5dc]"] {
          border-color: rgba(255,255,255,.08) !important;
          background-color: rgba(255,255,255,.08) !important;
        }

        .dark .inaivu-home input,
        .dark .inaivu-home textarea {
          background: #211b18 !important;
          color: #fff !important;
          border-color: rgba(255,255,255,.1) !important;
        }

        .dark .inaivu-home input::placeholder,
        .dark .inaivu-home textarea::placeholder {
          color: rgba(255,255,255,.4) !important;
        }

        .dark .inaivu-home nav {
          background: rgba(21,17,15,.98) !important;
          border-color: rgba(255,255,255,.08) !important;
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-[#e8ddd3] bg-[#fffdf9]">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            onClick={() => router.push("/")}
            className="flex shrink-0 items-center gap-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef704d] text-lg font-black text-white">
              இ
            </div>

            <div className="hidden sm:block">
              <div className="text-lg font-black">
                Inaivu
              </div>

              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9b8b82]">
                Connect naturally
              </div>
            </div>
          </button>

          <div className="relative ml-auto w-full max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9d8d84]">
              ⌕
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search people..."
              className="h-10 w-full rounded-full border border-[#e8ddd3] bg-[#f8f5ef] pl-10 pr-4 text-sm outline-none focus:border-[#ef704d]"
            />
          </div>

          <button
            onClick={() =>
              router.push("/notifications")
            }
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#e8ddd3] bg-white text-lg md:flex"
          >
            ♡
          </button>

          <button
            onClick={() =>
              router.push("/messages")
            }
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#e8ddd3] bg-white text-lg md:flex"
          >
            ✦
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
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-2">
            <SideButton
              active
              label="Home"
              icon="⌂"
              onClick={() =>
                router.push("/")
              }
            />

            <SideButton
              label="Messages"
              icon="✦"
              onClick={() =>
                router.push("/messages")
              }
            />

            <SideButton
              label="Loop"
              icon="▶"
              onClick={() =>
                router.push("/loop")
              }
            />

            <SideButton
              label="Notifications"
              icon="♡"
              onClick={() =>
                router.push("/notifications")
              }
            />

            <SideButton
              label="Profile"
              icon="◯"
              onClick={() =>
                router.push("/profile")
              }
            />

            <SideButton
              label="Settings"
              icon="⚙"
              onClick={() =>
                router.push("/settings")
              }
            />

            <div className="my-4 h-px bg-[#e8ddd3]" />

            <SideButton
              label="Log out"
              icon="↪"
              onClick={logout}
            />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 overflow-hidden rounded-3xl bg-[#ef704d] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Welcome to Inaivu
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Share what matters.
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-white/80">
              Connect with people, share moments
              and discover something new.
            </p>

            <button
              onClick={() =>
                setComposer(true)
              }
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#d95638]"
            >
              Create a post
            </button>
          </div>

          {/* HOME ADSENSE AD */}
          <AdSlot
            adSlot="YOUR_HOME_AD_SLOT_ID"
            format="auto"
            responsive
            className="mb-5"
          />

          {composer && (
            <div className="mb-5 rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-5 shadow-sm">
              <div className="flex gap-3">
                <Avatar profile={profile} />

                <div className="min-w-0 flex-1">
                  <textarea
                    value={text}
                    onChange={(event) =>
                      setText(
                        event.target.value,
                      )
                    }
                    placeholder="What would you like to share?"
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-[#e8ddd3] bg-[#f8f5ef] p-4 text-sm outline-none focus:border-[#ef704d]"
                  />

                  {preview && (
                    <div className="mt-3 overflow-hidden rounded-2xl">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-h-80 w-full object-cover"
                      />
                    </div>
                  )}

                  {file &&
                    file.type.startsWith(
                      "video/",
                    ) && (
                      <div className="mt-3 rounded-2xl bg-[#f8f5ef] p-4 text-sm font-semibold">
                        🎬 {file.name}
                      </div>
                    )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="cursor-pointer rounded-full border border-[#e8ddd3] bg-white px-4 py-2 text-sm font-bold text-[#625750]">
                      📷 Photo / video

                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(event) =>
                          chooseFile(
                            event.target.files
                              ?.item(0) ||
                              null,
                          )
                        }
                      />
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setComposer(false);
                          setText("");
                          setFile(null);
                          setPreview("");
                        }}
                        className="rounded-full px-4 py-2 text-sm font-semibold text-[#766a62]"
                      >
                        Cancel
                      </button>

                      <button
                        disabled={posting}
                        onClick={publish}
                        className="rounded-full bg-[#ef704d] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {posting
                          ? "Publishing..."
                          : "Publish"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0e9] text-2xl">
                ✨
              </div>

              <h2 className="text-xl font-black">
                Your feed is quiet
              </h2>

              <p className="mt-2 text-sm text-[#887a72]">
                Be the first person to share
                something.
              </p>

              <button
                onClick={() =>
                  setComposer(true)
                }
                className="mt-5 rounded-full bg-[#ef704d] px-5 py-2.5 text-sm font-bold text-white"
              >
                Create your first post
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map(
                (post: PostView, index: number) => (
                  <div key={post.id}>
                    <article className="overflow-hidden rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] shadow-sm">
                      <div className="flex items-center gap-3 p-5">
                        <button
                          onClick={() =>
                            router.push(
                              `/profile/${post.user_id}`,
                            )
                          }
                        >
                          <Avatar
                            profile={
                              post.profile
                            }
                          />
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/profile/${post.user_id}`,
                            )
                          }
                          className="min-w-0 text-left"
                        >
                          <div className="truncate text-sm font-bold">
                            {post.profile
                              ?.full_name ||
                              post.profile
                                ?.username ||
                              "Inaivu user"}
                          </div>

                          <div className="mt-0.5 text-xs text-[#988981]">
                            {post.profile
                              ?.username
                              ? `@${post.profile.username}`
                              : "Inaivu member"}{" "}
                            ·{" "}
                            {timeAgo(
                              post.created_at,
                            )}
                          </div>
                        </button>

                        {post.user_id ===
                          userId && (
                          <button
                            onClick={() =>
                              removePost(post)
                            }
                            className="ml-auto rounded-full px-3 py-2 text-xs font-bold text-[#9b6657] hover:bg-[#fff0e9]"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {post.content && (
                        <div className="px-5 pb-4">
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#403a36]">
                            {post.content}
                          </p>
                        </div>
                      )}

                      {post.media_url &&
                        post.media_type ===
                          "image" && (
                          <div className="overflow-hidden bg-[#eee9e3]">
                            <img
                              src={
                                post.media_url
                              }
                              alt=""
                              className="max-h-[650px] w-full object-cover"
                            />
                          </div>
                        )}

                      {post.media_url &&
                        post.media_type ===
                          "video" && (
                          <div className="overflow-hidden bg-black">
                            <video
                              src={
                                post.media_url
                              }
                              controls
                              playsInline
                              className="max-h-[650px] w-full"
                            />
                          </div>
                        )}

                      <div className="flex items-center justify-between px-5 pt-4 text-xs text-[#8f8077]">
                        <span>
                          {post.likeCount}{" "}
                          {post.likeCount === 1
                            ? "like"
                            : "likes"}
                        </span>

                        <span>
                          {post.commentCount}{" "}
                          {post.commentCount ===
                          1
                            ? "comment"
                            : "comments"}
                        </span>
                      </div>

                      <div className="mx-5 my-3 h-px bg-[#eee5dc]" />

                      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                        <button
                          onClick={() =>
                            likePost(post)
                          }
                          className={`rounded-2xl px-3 py-2.5 text-sm font-bold ${
                            post.liked
                              ? "bg-[#fff0e9] text-[#d95638]"
                              : "text-[#665b55] hover:bg-[#f8f5ef]"
                          }`}
                        >
                          {post.liked
                            ? "♥ Liked"
                            : "♡ Like"}
                        </button>

                        <button
                          onClick={() =>
                            showComments(
                              post.id,
                            )
                          }
                          className="rounded-2xl px-3 py-2.5 text-sm font-bold text-[#665b55] hover:bg-[#f8f5ef]"
                        >
                          💬 Comment
                        </button>
                      </div>

                      {commentsOpen ===
                        post.id && (
                        <div className="border-t border-[#e8ddd3] bg-[#faf7f2] p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-black">
                              Comments
                            </h3>

                            <button
                              onClick={() => {
                                setCommentsOpen(
                                  "",
                                );
                                setComments([]);
                              }}
                              className="text-sm font-semibold text-[#8c7d74]"
                            >
                              Close
                            </button>
                          </div>

                          <div className="max-h-72 space-y-3 overflow-y-auto">
                            {comments.length ===
                            0 ? (
                              <p className="py-5 text-center text-sm text-[#998a81]">
                                No comments yet.
                              </p>
                            ) : (
                              comments.map(
                                (
                                  comment: Comment,
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

                                    <div className="rounded-2xl bg-white px-4 py-3">
                                      <div className="text-xs font-bold">
                                        {comment
                                          .profile
                                          ?.full_name ||
                                          comment
                                            .profile
                                            ?.username ||
                                          "User"}
                                      </div>

                                      <p className="mt-1 text-sm text-[#4b433e]">
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

                    {/* SECOND HOME AD AFTER EVERY 3 POSTS */}
                    {(index + 1) % 3 === 0 &&
                      index !== posts.length - 1 && (
                        <AdSlot
                          adSlot="YOUR_HOME_AD_SLOT_ID"
                          format="auto"
                          responsive
                          className="my-5"
                        />
                      )}
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-5">
              <div className="flex items-center gap-3">
                <Avatar
                  profile={profile}
                />

                <div className="min-w-0">
                  <div className="truncate text-sm font-black">
                    {profile?.full_name ||
                      "Your profile"}
                  </div>

                  <div className="truncate text-xs text-[#988a81]">
                    {profile?.username
                      ? `@${profile.username}`
                      : "Inaivu member"}
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  router.push("/profile")
                }
                className="mt-4 w-full rounded-2xl bg-[#f8f5ef] px-4 py-2.5 text-sm font-bold text-[#625750] hover:bg-[#fff0e9] hover:text-[#d95638]"
              >
                View profile
              </button>
            </div>

            <div className="rounded-3xl border border-[#e8ddd3] bg-[#fffdf9] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-black">
                  People to connect
                </h2>

                <span className="text-xs font-bold text-[#ef704d]">
                  Discover
                </span>
              </div>

              <div className="space-y-4">
                {visiblePeople
                  .slice(0, 7)
                  .map(
                    (person: Profile) => {
                      const isFollowing =
                        following.includes(
                          person.id,
                        );

                      return (
                        <div
                          key={person.id}
                          className="flex items-center gap-3"
                        >
                          <button
                            onClick={() =>
                              router.push(
                                `/profile/${person.id}`,
                              )
                            }
                          >
                            <Avatar
                              profile={
                                person
                              }
                              size="small"
                            />
                          </button>

                          <button
                            onClick={() =>
                              router.push(
                                `/profile/${person.id}`,
                              )
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate text-sm font-bold">
                              {person.full_name ||
                                person.username ||
                                "User"}
                            </div>

                            <div className="truncate text-xs text-[#988a81]">
                              {person.username
                                ? `@${person.username}`
                                : "Inaivu member"}
                            </div>
                          </button>

                          <button
                            onClick={() =>
                              follow(
                                person.id,
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                              isFollowing
                                ? "bg-[#f8f5ef] text-[#766a62]"
                                : "bg-[#ef704d] text-white"
                            }`}
                          >
                            {isFollowing
                              ? "Following"
                              : "Follow"}
                          </button>
                        </div>
                      );
                    },
                  )}
              </div>
            </div>

            <div className="rounded-3xl bg-[#fff0d8] p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ad6b4d]">
                Inaivu
              </div>

              <p className="mt-2 text-sm leading-6 text-[#765e51]">
                Connect, share and discover.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e8ddd3] bg-[#fffdf9] px-3 py-2 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <MobileButton
            label="Home"
            icon="⌂"
            active
            onClick={() =>
              router.push("/")
            }
          />

          <MobileButton
            label="Messages"
            icon="✦"
            onClick={() =>
              router.push("/messages")
            }
          />

          <MobileButton
            label="Loop"
            icon="▶"
            onClick={() =>
              router.push("/loop")
            }
          />

          <button
            onClick={() =>
              setComposer(true)
            }
            className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl text-white shadow-lg"
          >
            +
          </button>

          <MobileButton
            label="Alerts"
            icon="♡"
            onClick={() =>
              router.push("/notifications")
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
        <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full bg-[#292522] px-5 py-3 text-sm font-semibold text-white shadow-xl">
            <span>{notice}</span>

            <button
              onClick={() =>
                setNotice("")
              }
              className="text-white/60 hover:text-white"
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
    profile?.full_name?.charAt(0)
      ?.toUpperCase() ||
    profile?.username?.charAt(0)
      ?.toUpperCase() ||
    "U";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6c95f] font-bold text-[#4d362d]`}
    >
      {profile?.avatar_url ? (
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

function SideButton({
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
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
        active
          ? "bg-[#fff0e9] text-[#d95638]"
          : "text-[#665b55] hover:bg-white"
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
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
      <span>{icon}</span>

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
    (now.getTime() - date.getTime()) /
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