"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!accepted) {
      setError("Please accept the terms to continue.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setSuccess(
      "Account created successfully. Please check your email if confirmation is required."
    );

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#20201e]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Signup form */}
        <section className="order-2 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:order-1">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="mb-9 lg:hidden">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef704d] text-2xl font-black text-white shadow-lg shadow-[#ef704d]/20">
                இ
              </div>

              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ef704d]">
                Inaivu
              </p>
            </div>

            <div className="mb-7">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#ef704d]">
                Join Inaivu
              </p>

              <h2 className="text-4xl font-black tracking-tight">
                Create your account
              </h2>

              <p className="mt-3 text-[15px] leading-6 text-[#77736c]">
                Your people, your conversations, your space.
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-bold"
                >
                  Your name
                </label>

                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-14 w-full rounded-2xl border border-[#ded9d0] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
                />
              </div>

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
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
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

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-bold"
                >
                  Confirm password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter password again"
                    className="h-14 w-full rounded-2xl border border-[#ded9d0] bg-white px-4 pr-14 text-[15px] outline-none transition placeholder:text-[#aaa59d] focus:border-[#ef704d] focus:ring-4 focus:ring-[#ef704d]/10"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-[#77736c] transition hover:bg-[#f8f5ef] hover:text-[#ef704d]"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ebe6dd] bg-[#fffdf9] p-4">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#ef704d]"
                />

                <span className="text-xs leading-5 text-[#77736c]">
                  I agree to the Inaivu terms and understand that I should
                  respect other people and their content.
                </span>
              </label>

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
                disabled={loading}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#ef704d] px-5 text-[15px] font-bold text-white shadow-lg shadow-[#ef704d]/20 transition hover:bg-[#d95638] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[#77736c]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-[#ef704d] hover:text-[#d95638]"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        {/* Right branding panel */}
        <section className="relative order-1 hidden overflow-hidden bg-[#ef704d] lg:order-2 lg:flex">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#f6c95f]/40" />
          <div className="absolute -bottom-40 -left-20 h-[480px] w-[480px] rounded-full bg-[#d95638]/50" />
          <div className="absolute left-24 top-24 h-24 w-24 rounded-full border border-white/30" />

          <div className="relative z-10 flex w-full flex-col justify-between p-14 xl:p-20">
            <div className="flex justify-end">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#ef704d] shadow-lg">
                இ
              </div>
            </div>

            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-white/70">
                One place for your people
              </p>

              <h1 className="max-w-xl text-5xl font-black leading-[1.05] tracking-tight text-white xl:text-6xl">
                Connect.
                <br />
                Share.
                <br />
                Belong.
              </h1>

              <p className="mt-7 max-w-md text-lg leading-8 text-white/80">
                Create your Inaivu account and start building your own social
                space.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium text-white/70">
              <span className="h-2 w-2 rounded-full bg-white" />
              Welcome to Inaivu
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}