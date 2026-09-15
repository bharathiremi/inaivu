"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#20201e]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left branding panel */}
        <section className="relative hidden overflow-hidden bg-[#ef704d] lg:flex">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#f6c95f]/40" />
          <div className="absolute -bottom-40 -right-20 h-[480px] w-[480px] rounded-full bg-[#d95638]/50" />
          <div className="absolute right-24 top-24 h-24 w-24 rounded-full border border-white/30" />

          <div className="relative z-10 flex w-full flex-col justify-between p-14 xl:p-20">
            <div>
              <div className="mb-12 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#ef704d] shadow-lg">
                இ
              </div>

              <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-white/70">
                Welcome to Inaivu
              </p>

              <h1 className="max-w-xl text-5xl font-black leading-[1.05] tracking-tight text-white xl:text-6xl">
                Stay connected.
                <br />
                Stay together.
              </h1>

              <p className="mt-7 max-w-md text-lg leading-8 text-white/80">
                A simple place to connect with people, share moments and
                keep your conversations close.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium text-white/70">
              <span className="h-2 w-2 rounded-full bg-white" />
              Connect • Share • Discover
            </div>
          </div>
        </section>

        {/* Login */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="mb-10 lg:hidden">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl font-black text-white shadow-lg shadow-[#ef704d]/20">
                இ
              </div>

              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ef704d]">
                Inaivu
              </p>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#ef704d]">
                Welcome back
              </p>

              <h2 className="text-4xl font-black tracking-tight">
                Sign in to Inaivu
              </h2>

              <p className="mt-3 text-[15px] leading-6 text-[#77736c]">
                Continue where you left off.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-14 w-full rounded-2xl border border-[#ded9d0] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-bold"
                  >
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-14 w-full rounded-2xl border border-[#ded9d0] bg-white px-4 pr-14 text-[15px] outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-[#77736c] transition hover:bg-[#f8f5ef] hover:text-[#ef704d]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#ef704d] px-5 text-[15px] font-bold text-white shadow-lg shadow-[#ef704d]/20 transition hover:bg-[#d95638] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#ded9d0]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#aaa59d]">
                Inaivu
              </span>
              <div className="h-px flex-1 bg-[#ded9d0]" />
            </div>

            <p className="text-center text-sm text-[#77736c]">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-[#ef704d] hover:text-[#d95638]"
              >
                Create one
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-[#aaa59d]">
              By continuing, you agree to use Inaivu responsibly and respect
              other people on the platform.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}