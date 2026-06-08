import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),linear-gradient(135deg,#f8fbff,#eef5ff_48%,#f8fafc)] px-6 py-10 text-slate-950">
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl place-items-center">
            <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm font-medium text-slate-500 shadow-soft">
              Loading login...
            </div>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
