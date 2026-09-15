"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  bio: string;
  avatar_url: string | null;
};

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, bio, avatar_url")
      .eq("id", user.id)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setProfile(data);
    setName(data.full_name || "");
    setUsername(data.username || "");
    setBio(data.bio || "");
    setAvatarPreview(data.avatar_url || "");

    setLoading(false);
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be smaller than 5 MB.");
      return;
    }

    setError("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(userId: string) {
    if (!avatarFile) {
      return profile?.avatar_url || null;
    }

    const extension =
      avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, avatarFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: avatarFile.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanBio = bio.trim();

    if (!cleanName) {
      setError("Name cannot be empty.");
      setSaving(false);
      return;
    }

    if (cleanUsername && !/^[a-z0-9._]{3,30}$/.test(cleanUsername)) {
      setError(
        "Username must be 3–30 characters and use only letters, numbers, dots or underscores."
      );
      setSaving(false);
      return;
    }

    try {
      const avatarUrl = await uploadAvatar(user.id);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          username: cleanUsername || null,
          bio: cleanBio,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "That username is already taken."
            : updateError.message
        );
        setSaving(false);
        return;
      }

      setSuccess("Profile updated successfully.");

      setTimeout(() => {
        router.push("/profile");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving your profile."
      );
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5ef]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#77736c]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#ef704d]/20 border-t-[#ef704d]" />
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#20201e]">
      <header className="sticky top-0 z-30 border-b border-[#e9e3da] bg-[#fffdf9]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/profile"
            className="flex items-center gap-3 text-sm font-bold text-[#77736c] transition hover:text-[#ef704d]"
          >
            <span className="text-xl">←</span>
            Profile
          </Link>

          <div className="text-base font-black tracking-tight">Edit profile</div>

          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="overflow-hidden rounded-[28px] border border-[#e8e2d9] bg-[#fffdf9] shadow-sm">
          <div className="border-b border-[#eee8df] px-6 py-7 sm:px-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ef704d]">
              Your profile
            </p>

            <h1 className="text-3xl font-black tracking-tight">
              Make it yours.
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#77736c]">
              Update how people see you across Inaivu.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-7 px-6 py-7 sm:px-8">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-[#f6c95f] text-4xl font-black text-[#20201e] ring-8 ring-[#fff1d8]">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    name.charAt(0).toUpperCase() || "I"
                  )}
                </div>

                <label
                  htmlFor="avatar"
                  className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#ef704d] text-lg text-white shadow-lg transition hover:bg-[#d95638]"
                >
                  +
                </label>

                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <p className="mt-4 text-xs font-medium text-[#99948b]">
                JPG, PNG or WEBP • Max 5 MB
              </p>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-bold"
              >
                Full name
              </label>

              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={80}
                className="h-14 w-full rounded-2xl border border-[#ded9d0] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
              />
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-bold"
              >
                Username
              </label>

              <div className="flex h-14 overflow-hidden rounded-2xl border border-[#ded9d0] bg-white focus-within:border-[#ef704d] focus-within:ring-4 focus-within:ring-[#ef704d]/10">
                <span className="flex items-center bg-[#f8f5ef] px-4 text-sm font-bold text-[#99948b]">
                  @
                </span>

                <input
                  id="username"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .replace(/\s/g, "")
                        .toLowerCase()
                    )
                  }
                  placeholder="username"
                  maxLength={30}
                  className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-[#aaa59d]"
                />
              </div>

              <p className="mt-2 text-xs text-[#99948b]">
                3–30 characters • letters, numbers, dots and underscores
              </p>
            </div>

            {/* Bio */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="bio"
                  className="block text-sm font-bold"
                >
                  Bio
                </label>

                <span className="text-xs text-[#aaa59d]">
                  {bio.length}/160
                </span>
              </div>

              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="Tell people a little about yourself..."
                rows={5}
                maxLength={160}
                className="w-full resize-none rounded-2xl border border-[#ded9d0] bg-white px-4 py-3 text-[15px] leading-6 outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium leading-5 text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#ef704d] px-5 text-[15px] font-bold text-white shadow-lg shadow-[#ef704d]/20 transition hover:bg-[#d95638] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <span className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving changes...
                </span>
              ) : (
                "Save changes"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}