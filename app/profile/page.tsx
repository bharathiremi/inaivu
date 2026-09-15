"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  created_at: string;
  updated_at: string;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  media_url: string | null;
  media_type: string | null;
  media_path: string | null;
};

type PostStats = {
  likes: number;
  comments: number;
};

export default function ProfilePage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const avatarInputRef =
    useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [posts, setPosts] =
    useState<Post[]>([]);

  const [postStats, setPostStats] =
    useState<Record<string, PostStats>>({});

  const [followersCount, setFollowersCount] =
    useState(0);

  const [followingCount, setFollowingCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploadingAvatar, setUploadingAvatar] =
    useState(false);

  const [showEdit, setShowEdit] =
    useState(false);

  const [fullName, setFullName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [bio, setBio] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [error, setError] =
    useState("");

  const loadProfile = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
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

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id,username,full_name,bio,avatar_url,created_at,updated_at",
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Profile load error:",
            profileError,
          );
          throw profileError;
        }

        const currentProfile =
          profileData as Profile;

        setProfile(currentProfile);

        setFullName(
          currentProfile.full_name || "",
        );

        setUsername(
          currentProfile.username || "",
        );

        setBio(
          currentProfile.bio || "",
        );

        /*
         * Load user's posts.
         */
        const {
          data: postData,
          error: postsError,
        } = await supabase
          .from("posts")
          .select(
            "id,user_id,content,image_url,created_at,updated_at,media_url,media_type,media_path",
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (postsError) {
          console.error(
            "Posts load error:",
            postsError,
          );
        }

        const userPosts =
          (postData ?? []) as Post[];

        setPosts(userPosts);

        /*
         * Load followers / following counts.
         */
        const followersResult =
          await supabase
            .from("follows")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("following_id", user.id);

        const followingResult =
          await supabase
            .from("follows")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("follower_id", user.id);

        setFollowersCount(
          followersResult.count ?? 0,
        );

        setFollowingCount(
          followingResult.count ?? 0,
        );

        /*
         * Load post statistics.
         */
        if (userPosts.length > 0) {
          const postIds =
            userPosts.map(
              (post) => post.id,
            );

          const [
            likesResult,
            commentsResult,
          ] = await Promise.all([
            supabase
              .from("post_likes")
              .select("post_id")
              .in(
                "post_id",
                postIds,
              ),

            supabase
              .from("post_comments")
              .select("post_id")
              .in(
                "post_id",
                postIds,
              ),
          ]);

          const stats: Record<
            string,
            PostStats
          > = {};

          postIds.forEach((id) => {
            stats[id] = {
              likes: 0,
              comments: 0,
            };
          });

          (
            likesResult.data ?? []
          ).forEach((row) => {
            if (stats[row.post_id]) {
              stats[row.post_id].likes += 1;
            }
          });

          (
            commentsResult.data ?? []
          ).forEach((row) => {
            if (stats[row.post_id]) {
              stats[row.post_id].comments += 1;
            }
          });

          setPostStats(stats);
        } else {
          setPostStats({});
        }
      } catch (err) {
        console.error(
          "Profile error:",
          err,
        );

        setError(
          "Unable to load your profile.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function openEditProfile() {
    if (!profile) return;

    setFullName(
      profile.full_name || "",
    );

    setUsername(
      profile.username || "",
    );

    setBio(
      profile.bio || "",
    );

    setShowEdit(true);
    setNotice("");
  }

  async function saveProfile() {
    if (!userId) return;

    const cleanName =
      fullName.trim();

    const cleanUsername =
      username
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    const cleanBio =
      bio.trim();

    if (!cleanName) {
      setNotice(
        "Please enter your name.",
      );
      return;
    }

    if (
      cleanUsername &&
      !/^[a-z0-9._]{3,30}$/.test(
        cleanUsername,
      )
    ) {
      setNotice(
        "Username must be 3–30 characters using letters, numbers, dots or underscores.",
      );
      return;
    }

    try {
      setSaving(true);
      setNotice("");

      const {
        data,
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          username:
            cleanUsername || null,
          bio: cleanBio,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", userId)
        .select(
          "id,username,full_name,bio,avatar_url,created_at,updated_at",
        )
        .single();

      if (updateError) {
        console.error(
          "Profile update error:",
          updateError,
        );

        if (
          updateError.code ===
          "23505"
        ) {
          setNotice(
            "That username is already taken.",
          );
        } else {
          setNotice(
            updateError.message ||
              "Unable to save profile.",
          );
        }

        return;
      }

      const updatedProfile =
        data as Profile;

      setProfile(
        updatedProfile,
      );

      setFullName(
        updatedProfile.full_name ||
          "",
      );

      setUsername(
        updatedProfile.username ||
          "",
      );

      setBio(
        updatedProfile.bio || "",
      );

      setShowEdit(false);

      setNotice(
        "Profile updated successfully.",
      );
    } catch (err) {
      console.error(
        "Save profile error:",
        err,
      );

      setNotice(
        "Unable to save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(
    file: File | null,
  ) {
    if (!file || !userId) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      setNotice(
        "Please choose an image.",
      );
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setNotice(
        "Profile photo must be under 10 MB.",
      );
      return;
    }

    try {
      setUploadingAvatar(true);
      setNotice("");

      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const path =
        `${userId}/${Date.now()}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("avatars")
        .upload(
          path,
          file,
          {
            cacheControl: "3600",
            upsert: false,
          },
        );

      if (uploadError) {
        console.error(
          "Avatar upload error:",
          uploadError,
        );

        setNotice(
          uploadError.message ||
            "Unable to upload profile photo.",
        );

        return;
      }

      const {
        data: publicData,
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const avatarUrl =
        publicData.publicUrl;

      const {
        data: updatedProfile,
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          avatar_url:
            avatarUrl,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", userId)
        .select(
          "id,username,full_name,bio,avatar_url,created_at,updated_at",
        )
        .single();

      if (updateError) {
        console.error(
          "Avatar profile update error:",
          updateError,
        );

        setNotice(
          updateError.message ||
            "Photo uploaded but profile update failed.",
        );

        return;
      }

      setProfile(
        updatedProfile as Profile,
      );

      setNotice(
        "Profile photo updated.",
      );
    } catch (err) {
      console.error(
        "Avatar error:",
        err,
      );

      setNotice(
        "Unable to update profile photo.",
      );
    } finally {
      setUploadingAvatar(false);

      if (
        avatarInputRef.current
      ) {
        avatarInputRef.current.value =
          "";
      }
    }
  }

  function openPost(postId: string) {
    router.push(
      `/home?postId=${encodeURIComponent(
        postId,
      )}`,
    );
  }

  function formatJoinDate(
    dateString: string,
  ) {
    try {
      return new Date(
        dateString,
      ).toLocaleDateString(
        undefined,
        {
          month: "long",
          year: "numeric",
        },
      );
    } catch {
      return "";
    }
  }

  if (loading) {
    return (
      <>
        <main className="profile-page loading-page">
          <div className="loading-card">
            <div className="loading-logo">
              இ
            </div>

            <div className="spinner" />

            <p>
              Loading profile...
            </p>
          </div>
        </main>

        <style jsx global>{`
          .profile-page.loading-page {
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
            width: 54px;
            height: 54px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 18px;
            background: #ef704d;
            color: white;
            font-size: 25px;
            font-weight: 900;
          }

          .spinner {
            width: 28px;
            height: 28px;
            margin: 0 auto 12px;
            border: 3px solid #eadfd4;
            border-top-color: #ef704d;
            border-radius: 50%;
            animation: profile-spin
              0.8s linear infinite;
          }

          .loading-card p {
            margin: 0;
            color: #877b73;
            font-size: 14px;
            font-weight: 700;
          }

          @keyframes profile-spin {
            to {
              transform: rotate(360deg);
            }
          }

          html.dark
            .profile-page.loading-page {
            background: #171412;
            color: #f7efe7;
          }

          html.dark .spinner {
            border-color: #332b26;
            border-top-color: #ef704d;
          }

          html.dark .loading-card p {
            color: #9f948c;
          }
        `}</style>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <main className="profile-page error-page">
          <div className="error-box">
            <div className="error-symbol">
              !
            </div>

            <h1>
              Profile unavailable
            </h1>

            <p>
              {error ||
                "We couldn't load your profile."}
            </p>

            <button
              onClick={() =>
                loadProfile()
              }
            >
              Try again
            </button>
          </div>
        </main>

        <style jsx global>{`
          .profile-page.error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f8f3eb;
          }

          .error-box {
            width: min(420px, 100%);
            padding: 32px;
            border: 1px solid #eadfd4;
            border-radius: 28px;
            background: #fffaf5;
            text-align: center;
          }

          .error-symbol {
            width: 50px;
            height: 50px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
            background: #ef704d;
            color: white;
            font-size: 22px;
            font-weight: 900;
          }

          .error-box h1 {
            margin: 0;
            font-size: 21px;
            font-weight: 900;
          }

          .error-box p {
            margin: 8px 0 20px;
            color: #897d75;
            font-size: 14px;
          }

          .error-box button {
            border: 0;
            border-radius: 13px;
            padding: 11px 18px;
            background: #ef704d;
            color: white;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
          }

          html.dark .profile-page.error-page {
            background: #171412;
          }

          html.dark .error-box {
            border-color: #342d28;
            background: #211d1a;
          }

          html.dark .error-box h1 {
            color: #f5ebe3;
          }

          html.dark .error-box p {
            color: #988d85;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <main className="profile-page">
        <header className="profile-header">
          <button
            className="back-button"
            onClick={() =>
              router.back()
            }
            aria-label="Go back"
          >
            ←
          </button>

          <div className="header-title">
            <span>Profile</span>
          </div>

          <button
            className="settings-button"
            onClick={() =>
              router.push("/settings")
            }
            aria-label="Settings"
          >
            ⚙
          </button>
        </header>

        <section className="profile-shell">
          <div className="profile-card">
            <div className="profile-main">
              <div className="avatar-section">
                <button
                  className="avatar-button"
                  onClick={() =>
                    avatarInputRef.current?.click()
                  }
                  disabled={
                    uploadingAvatar
                  }
                  aria-label="Change profile photo"
                >
                  {profile.avatar_url ? (
                    <img
                      src={
                        profile.avatar_url
                      }
                      alt={
                        profile.full_name ||
                        "Profile"
                      }
                      className="profile-avatar"
                    />
                  ) : (
                    <div className="profile-avatar avatar-placeholder">
                      {(
                        profile.full_name ||
                        profile.username ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <span className="camera-badge">
                    {uploadingAvatar
                      ? "..."
                      : "＋"}
                  </span>
                </button>

                <input
                  ref={
                    avatarInputRef
                  }
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(
                    event,
                  ) =>
                    uploadAvatar(
                      event.target.files?.[0] ||
                        null,
                    )
                  }
                />
              </div>

              <div className="identity">
                <h1>
                  {profile.full_name ||
                    "Your name"}
                </h1>

                <div className="username">
                  {profile.username
                    ? `@${profile.username}`
                    : "@username"}
                </div>

                {profile.bio ? (
                  <p className="bio">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="bio empty-bio">
                    Add a bio to tell people
                    about yourself.
                  </p>
                )}

                {profile.created_at && (
                  <div className="joined">
                    <span>◷</span>
                    Joined{" "}
                    {formatJoinDate(
                      profile.created_at,
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="profile-actions">
              <button
                className="edit-button"
                onClick={
                  openEditProfile
                }
              >
                Edit profile
              </button>

              <button
                className="saved-button"
                onClick={() =>
                  router.push("/saved")
                }
                aria-label="Open saved Loops"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
                </svg>
                Saved
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <strong>
                  {posts.length}
                </strong>

                <span>Posts</span>
              </div>

              <div className="stat">
                <strong>
                  {followersCount}
                </strong>

                <span>Followers</span>
              </div>

              <div className="stat">
                <strong>
                  {followingCount}
                </strong>

                <span>Following</span>
              </div>
            </div>
          </div>

          <div className="posts-section">
            <div className="section-heading">
              <div>
                <h2>Your posts</h2>

                <p>
                  Everything you've
                  shared on Inaivu
                </p>
              </div>

              <span className="post-total">
                {posts.length}
              </span>
            </div>

            {posts.length === 0 ? (
              <div className="empty-posts">
                <div className="empty-post-icon">
                  +
                </div>

                <h3>
                  Nothing here yet
                </h3>

                <p>
                  Share your first
                  post and it will
                  appear here.
                </p>

                <button
                  onClick={() =>
                    router.push("/")
                  }
                >
                  Create a post
                </button>
              </div>
            ) : (
              <div className="posts-grid">
                {posts.map(
                  (post) => {
                    const stats =
                      postStats[
                        post.id
                      ] || {
                        likes: 0,
                        comments: 0,
                      };

                    const media =
                      post.media_url ||
                      post.image_url;

                    return (
                      <article
                        key={post.id}
                        className="post-tile"
                        onClick={() =>
                          openPost(
                            post.id,
                          )
                        }
                      >
                        {media ? (
                          <div className="post-media">
                            {post.media_type?.startsWith(
                              "video",
                            ) ? (
                              <video
                                src={media}
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={media}
                                alt=""
                              />
                            )}

                            <div className="media-overlay">
                              <span>
                                ♥{" "}
                                {
                                  stats.likes
                                }
                              </span>

                              <span>
                                ●{" "}
                                {
                                  stats.comments
                                }
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-post">
                            <p>
                              {post.content ||
                                "Shared a post"}
                            </p>

                            <div className="text-post-footer">
                              <span>
                                ♥{" "}
                                {
                                  stats.likes
                                }
                              </span>

                              <span>
                                ●{" "}
                                {
                                  stats.comments
                                }
                              </span>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </section>

        <nav className="mobile-nav">
          <button
            onClick={() =>
              router.push("/")
            }
          >
            <span>⌂</span>
            <small>Home</small>
          </button>

          <button
            onClick={() =>
              router.push("/messages")
            }
          >
            <span>✦</span>
            <small>Messages</small>
          </button>

          <button
            className="mobile-create"
            onClick={() =>
              router.push("/")
            }
          >
            +
          </button>

          <button
            onClick={() =>
              router.push(
                "/notifications",
              )
            }
          >
            <span>♡</span>
            <small>Alerts</small>
          </button>

          <button className="active">
            {profile.avatar_url ? (
              <img
                src={
                  profile.avatar_url
                }
                alt=""
              />
            ) : (
              <span>
                {(
                  profile.full_name ||
                  profile.username ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}

            <small>Profile</small>
          </button>
        </nav>

        {showEdit && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowEdit(false);
              }
            }}
          >
            <div className="edit-modal">
              <div className="modal-header">
                <div>
                  <h2>
                    Edit profile
                  </h2>

                  <p>
                    Keep your Inaivu
                    profile up to date.
                  </p>
                </div>

                <button
                  className="close-modal"
                  onClick={() =>
                    setShowEdit(false)
                  }
                >
                  ×
                </button>
              </div>

              <div className="edit-avatar-row">
                <button
                  className="edit-avatar"
                  onClick={() =>
                    avatarInputRef.current?.click()
                  }
                >
                  {profile.avatar_url ? (
                    <img
                      src={
                        profile.avatar_url
                      }
                      alt=""
                    />
                  ) : (
                    <span>
                      {(
                        profile.full_name ||
                        profile.username ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </button>

                <div>
                  <strong>
                    Profile photo
                  </strong>

                  <p>
                    Tap the photo to
                    change it.
                  </p>
                </div>
              </div>

              <label className="field">
                <span>
                  Full name
                </span>

                <input
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target
                        .value,
                    )
                  }
                  maxLength={80}
                  placeholder="Your name"
                />
              </label>

              <label className="field">
                <span>
                  Username
                </span>

                <div className="username-input">
                  <span>@</span>

                  <input
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    maxLength={30}
                    placeholder="username"
                  />
                </div>
              </label>

              <label className="field">
                <span>
                  Bio
                </span>

                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(
                      event.target.value,
                    )
                  }
                  maxLength={160}
                  rows={4}
                  placeholder="Tell people a little about yourself..."
                />

                <small>
                  {bio.length}/160
                </small>
              </label>

              {notice && (
                <div className="modal-notice">
                  {notice}
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() =>
                    setShowEdit(false)
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="save-button"
                  onClick={
                    saveProfile
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {notice &&
          !showEdit && (
            <div className="toast">
              <span>✓</span>
              <span>{notice}</span>

              <button
                onClick={() =>
                  setNotice("")
                }
              >
                ×
              </button>
            </div>
          )}
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .profile-page {
          min-height: 100vh;
          padding-bottom: 40px;
          background: #f8f3eb;
          color: #29231f;
        }

        .profile-header {
          position: sticky;
          top: 0;
          z-index: 30;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        .settings-button {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fffaf5;
          color: #51463f;
          font-size: 21px;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .back-button:hover,
        .settings-button:hover {
          background: #fff0e7;
          transform: translateY(-1px);
        }

        .header-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .profile-shell {
          width: min(
            900px,
            calc(100% - 40px)
          );
          margin: 0 auto;
          padding: 28px 0 80px;
        }

        .profile-card {
          padding: 28px;
          border: 1px solid #e8ddd3;
          border-radius: 28px;
          background: #fffaf5;
          box-shadow:
            0 10px 35px
            rgba(74, 49, 35, 0.05);
        }

        .profile-main {
          display: flex;
          align-items: flex-start;
          gap: 24px;
        }

        .avatar-section {
          flex: 0 0 auto;
        }

        .avatar-button {
          position: relative;
          width: 118px;
          height: 118px;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .profile-avatar {
          width: 118px;
          height: 118px;
          display: block;
          object-fit: cover;
          border-radius: 34px;
          background: #f1dfd0;
        }

        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a5543d;
          font-size: 42px;
          font-weight: 900;
        }

        .camera-badge {
          position: absolute;
          right: -5px;
          bottom: -5px;
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 4px solid #fffaf5;
          border-radius: 13px;
          background: #ef704d;
          color: white;
          font-size: 17px;
          font-weight: 900;
        }

        .identity {
          min-width: 0;
          padding-top: 4px;
        }

        .identity h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .username {
          margin-top: 5px;
          color: #ef704d;
          font-size: 14px;
          font-weight: 800;
        }

        .bio {
          max-width: 560px;
          margin: 13px 0 0;
          color: #655a53;
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
        }

        .empty-bio {
          color: #a1948b;
          font-style: italic;
        }

        .joined {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          color: #9a8d84;
          font-size: 11px;
          font-weight: 700;
        }

        .profile-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 24px;
        }

        .edit-button {
          width: 100%;
          margin-top: 0;
          min-height: 44px;
          border: 1px solid #e5d6ca;
          border-radius: 14px;
          background: #fff;
          color: #4d433c;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .edit-button:hover {
          border-color: #ef704d;
          background: #fff2eb;
          color: #d95f40;
        }

        .saved-button {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #e5d6ca;
          border-radius: 14px;
          background: #fff0e7;
          color: #d95f40;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .saved-button:hover {
          border-color: #ef704d;
          background: #ffe6d8;
          transform: translateY(-1px);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          margin-top: 24px;
          padding-top: 23px;
          border-top: 1px solid #eee3da;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat + .stat {
          border-left: 1px solid #eee3da;
        }

        .stat strong {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .stat span {
          color: #91847b;
          font-size: 11px;
          font-weight: 800;
        }

        .posts-section {
          margin-top: 30px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .section-heading p {
          margin: 4px 0 0;
          color: #93867d;
          font-size: 12px;
        }

        .post-total {
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #fff0e7;
          color: #dc6344;
          font-size: 12px;
          font-weight: 900;
        }

        .posts-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .post-tile {
          min-width: 0;
          aspect-ratio: 1;
          overflow: hidden;
          border: 1px solid #e7dbd1;
          border-radius: 20px;
          background: #fffaf5;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .post-tile:hover {
          transform: translateY(-2px);
          box-shadow:
            0 10px 25px
            rgba(74, 49, 35, 0.09);
        }

        .post-media {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .post-media img,
        .post-media video {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .media-overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          gap: 13px;
          padding: 25px 12px 11px;
          background: linear-gradient(
            transparent,
            rgba(0, 0, 0, 0.58)
          );
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .text-post {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 17px;
          background: #fff0dc;
        }

        .text-post p {
          margin: 0;
          color: #57463d;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 700;
          display: -webkit-box;
          -webkit-line-clamp: 7;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .text-post-footer {
          display: flex;
          gap: 12px;
          color: #9c715d;
          font-size: 11px;
          font-weight: 800;
        }

        .empty-posts {
          padding: 70px 25px;
          border: 1px solid #e8ddd3;
          border-radius: 25px;
          background: #fffaf5;
          text-align: center;
        }

        .empty-post-icon {
          width: 62px;
          height: 62px;
          margin: 0 auto 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 21px;
          background: #fff0e6;
          color: #ef704d;
          font-size: 29px;
          font-weight: 700;
        }

        .empty-posts h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
        }

        .empty-posts p {
          max-width: 330px;
          margin: 7px auto 18px;
          color: #94877e;
          font-size: 13px;
          line-height: 1.6;
        }

        .empty-posts button {
          border: 0;
          border-radius: 13px;
          padding: 11px 18px;
          background: #ef704d;
          color: white;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .mobile-nav {
          display: none;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(
            37,
            29,
            24,
            0.45
          );
          backdrop-filter: blur(7px);
        }

        .edit-modal {
          width: min(
            500px,
            100%
          );
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 25px;
          border: 1px solid #e8ddd3;
          border-radius: 27px;
          background: #fffaf5;
          box-shadow:
            0 30px 90px
            rgba(34, 23, 18, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 21px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #958980;
          font-size: 12px;
        }

        .close-modal {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 11px;
          background: #f7eee7;
          color: #776a61;
          font-size: 22px;
          cursor: pointer;
        }

        .edit-avatar-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          margin-bottom: 20px;
          border-radius: 17px;
          background: #f8f0e8;
        }

        .edit-avatar {
          width: 62px;
          height: 62px;
          flex: 0 0 auto;
          padding: 0;
          overflow: hidden;
          border: 0;
          border-radius: 19px;
          background: #f1dfd0;
          color: #a5543d;
          font-size: 22px;
          font-weight: 900;
          cursor: pointer;
        }

        .edit-avatar img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .edit-avatar-row strong {
          font-size: 13px;
          font-weight: 900;
        }

        .edit-avatar-row p {
          margin: 4px 0 0;
          color: #94867d;
          font-size: 11px;
        }

        .field {
          position: relative;
          display: block;
          margin-bottom: 17px;
        }

        .field > span {
          display: block;
          margin-bottom: 7px;
          color: #51463f;
          font-size: 12px;
          font-weight: 900;
        }

        .field input,
        .field textarea {
          width: 100%;
          border: 1px solid #e3d7cd;
          border-radius: 14px;
          outline: none;
          background: white;
          color: #302924;
          font: inherit;
          font-size: 13px;
          transition: 0.18s ease;
        }

        .field input {
          height: 45px;
          padding: 0 13px;
        }

        .field textarea {
          resize: vertical;
          min-height: 95px;
          padding: 12px 13px;
          line-height: 1.55;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #ef704d;
          box-shadow:
            0 0 0 3px
            rgba(239, 112, 77, 0.1);
        }

        .username-input {
          display: flex;
          align-items: center;
          border: 1px solid #e3d7cd;
          border-radius: 14px;
          background: white;
          overflow: hidden;
        }

        .username-input span {
          padding-left: 13px;
          color: #ef704d;
          font-size: 14px;
          font-weight: 900;
        }

        .username-input input {
          border: 0;
          border-radius: 0;
          box-shadow: none !important;
        }

        .field small {
          position: absolute;
          right: 5px;
          bottom: -15px;
          color: #a2948a;
          font-size: 10px;
        }

        .modal-notice {
          padding: 10px 12px;
          margin: 8px 0 15px;
          border-radius: 12px;
          background: #fff0e8;
          color: #b6573c;
          font-size: 12px;
          font-weight: 800;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 22px;
        }

        .cancel-button,
        .save-button {
          min-height: 42px;
          padding: 0 17px;
          border-radius: 13px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid #e3d7cd;
          background: white;
          color: #756960;
        }

        .save-button {
          border: 0;
          background: #ef704d;
          color: white;
        }

        .save-button:disabled,
        .cancel-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .toast {
          position: fixed;
          left: 50%;
          bottom: 28px;
          z-index: 150;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: calc(100% - 30px);
          padding: 12px 13px 12px 15px;
          border-radius: 15px;
          transform: translateX(-50%);
          background: #292522;
          color: white;
          box-shadow:
            0 15px 40px
            rgba(0, 0, 0, 0.2);
          font-size: 12px;
          font-weight: 800;
        }

        .toast > span:first-child {
          color: #79d59b;
          font-size: 15px;
        }

        .toast button {
          width: 25px;
          height: 25px;
          border: 0;
          background: transparent;
          color: rgba(
            255,
            255,
            255,
            0.6
          );
          font-size: 18px;
          cursor: pointer;
        }

        @media (max-width: 700px) {
          .profile-page {
            padding-bottom: 82px;
          }

          .profile-header {
            height: 65px;
            padding: 0 15px;
          }

          .back-button,
          .settings-button {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .header-title {
            font-size: 18px;
          }

          .profile-shell {
            width: calc(100% - 24px);
            padding-top: 14px;
          }

          .profile-card {
            padding: 19px;
            border-radius: 23px;
          }

          .profile-main {
            gap: 16px;
          }

          .avatar-button,
          .profile-avatar {
            width: 88px;
            height: 88px;
            border-radius: 26px;
          }

          .camera-badge {
            width: 30px;
            height: 30px;
            right: -4px;
            bottom: -4px;
            border-width: 3px;
            border-radius: 11px;
            font-size: 14px;
          }

          .identity h1 {
            font-size: 21px;
          }

          .username {
            font-size: 12px;
          }

          .bio {
            margin-top: 9px;
            font-size: 12px;
            line-height: 1.55;
          }

          .joined {
            margin-top: 7px;
            font-size: 10px;
          }

          .edit-button {
            margin-top: 18px;
          }

          .stats {
            margin-top: 19px;
            padding-top: 18px;
          }

          .stat strong {
            font-size: 17px;
          }

          .stat span {
            font-size: 10px;
          }

          .posts-section {
            margin-top: 22px;
          }

          .section-heading h2 {
            font-size: 16px;
          }

          .section-heading p {
            font-size: 10px;
          }

          .posts-grid {
            gap: 7px;
          }

          .post-tile {
            border-radius: 13px;
          }

          .text-post {
            padding: 10px;
          }

          .text-post p {
            font-size: 10px;
            line-height: 1.45;
          }

          .text-post-footer,
          .media-overlay {
            font-size: 9px;
          }

          .media-overlay {
            padding:
              22px 8px 7px;
            gap: 8px;
          }

          .empty-posts {
            padding: 55px 20px;
            border-radius: 21px;
          }

          .mobile-nav {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 80;
            height: 68px;
            display: flex;
            align-items: center;
            justify-content: space-around;
            padding: 4px 8px;
            border-top: 1px solid #e7ddd4;
            background: rgba(
              255,
              250,
              245,
              0.97
            );
            backdrop-filter: blur(18px);
          }

          .mobile-nav button {
            min-width: 55px;
            height: 58px;
            border: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            background: transparent;
            color: #887b72;
            cursor: pointer;
          }

          .mobile-nav button span {
            font-size: 17px;
            line-height: 1;
          }

          .mobile-nav small {
            font-size: 9px;
            font-weight: 800;
          }

          .mobile-nav button.active {
            color: #ef704d;
          }

          .mobile-nav button.active img,
          .mobile-nav button.active > span {
            width: 25px;
            height: 25px;
            border-radius: 9px;
            object-fit: cover;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1dfd0;
            color: #a5543d;
            font-size: 11px;
            font-weight: 900;
          }

          .mobile-create {
            width: 45px !important;
            min-width: 45px !important;
            height: 45px !important;
            margin-top: -17px;
            border-radius: 15px !important;
            background: #ef704d !important;
            color: white !important;
            box-shadow:
              0 8px 20px
              rgba(239, 112, 77, 0.3);
            font-size: 25px !important;
          }

          .edit-modal {
            padding: 20px;
            border-radius: 23px;
          }

          .toast {
            bottom: 82px;
          }
        }

        html.dark .profile-page {
          background: #171412;
          color: #f7efe7;
        }

        html.dark .profile-header {
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
          .settings-button {
          background: #211d1a;
          color: #eee3da;
        }

        html.dark
          .back-button:hover,
        html.dark
          .settings-button:hover {
          background: #2b2521;
        }

        html.dark .profile-card,
        html.dark .empty-posts,
        html.dark .post-tile {
          border-color: #342d28;
          background: #211d1a;
          box-shadow: none;
        }

        html.dark .avatar-placeholder {
          background: #352a24;
          color: #e98568;
        }

        html.dark .camera-badge {
          border-color: #211d1a;
        }

        html.dark .bio {
          color: #c2b7ae;
        }

        html.dark .empty-bio {
          color: #82766e;
        }

        html.dark .joined,
        html.dark .section-heading p {
          color: #8e827a;
        }

        html.dark .edit-button {
          border-color: #40352f;
          background: #29231f;
          color: #ddd0c7;
        }

        html.dark .edit-button:hover {
          border-color: #ef704d;
          background: #30221d;
        }

        html.dark .saved-button {
          border-color: #40352f;
          background: #30221d;
          color: #f3a184;
        }

        html.dark .saved-button:hover {
          border-color: #ef704d;
          background: #39271f;
        }

        html.dark .stats {
          border-top-color: #342d28;
        }

        html.dark .stat + .stat {
          border-left-color: #342d28;
        }

        html.dark .stat span {
          color: #8e827a;
        }

        html.dark .post-total {
          background: #30221d;
          color: #ef8061;
        }

        html.dark .post-tile:hover {
          box-shadow:
            0 10px 25px
            rgba(0, 0, 0, 0.2);
        }

        html.dark .text-post {
          background: #30241d;
        }

        html.dark .text-post p {
          color: #dfcfc3;
        }

        html.dark .text-post-footer {
          color: #ad806c;
        }

        html.dark .empty-post-icon {
          background: #30221d;
          color: #ef8061;
        }

        html.dark .empty-posts p {
          color: #8e827a;
        }

        html.dark .mobile-nav {
          border-top-color: #342d28;
          background: rgba(
            29,
            25,
            22,
            0.97
          );
        }

        html.dark .mobile-nav button {
          color: #8e827a;
        }

        html.dark
          .mobile-nav button.active {
          color: #ef8061;
        }

        html.dark
          .mobile-nav button.active
          img,
        html.dark
          .mobile-nav button.active
          > span {
          background: #352a24;
          color: #e98568;
        }

        html.dark .edit-modal {
          border-color: #342d28;
          background: #211d1a;
        }

        html.dark .modal-header p,
        html.dark .edit-avatar-row p {
          color: #8e827a;
        }

        html.dark .close-modal {
          background: #302925;
          color: #c7bbb2;
        }

        html.dark .edit-avatar-row {
          background: #2a231f;
        }

        html.dark .field > span {
          color: #ddd0c7;
        }

        html.dark
          .field input,
        html.dark
          .field textarea,
        html.dark .username-input {
          border-color: #40352f;
          background: #191715;
          color: #f1e8e1;
        }

        html.dark
          .field input::placeholder,
        html.dark
          .field textarea::placeholder {
          color: #70665f;
        }

        html.dark .modal-notice {
          background: #34231d;
          color: #ed977d;
        }

        html.dark .cancel-button {
          border-color: #40352f;
          background: #29231f;
          color: #c7bbb2;
        }
      `}</style>
    </>
  );
}