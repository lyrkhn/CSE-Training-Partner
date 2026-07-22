"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Login failed with HTTP ${response.status}.`);
      }

      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),linear-gradient(135deg,#f8fbff,#eef5ff_48%,#f8fafc)] px-6 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_0.88fr]">
        <section className="rounded-[2rem] border border-white/80 bg-white/70 p-8 shadow-soft backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Workspace Access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            AI RolePlay Academy
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            Sign in to test course builder, roleplay sessions, transcript review, AI assessment,
            and turn-level coaching feedback.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Course Admin", "Trainee", "Root Admin"].map((item) => (
              <div key={item} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-sm font-semibold text-slate-950">{item}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Role-based access</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.8)]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Login</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter your assigned email and password to access the training workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                autoComplete="current-password"
              />
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
