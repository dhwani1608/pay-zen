"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/invite";

export default function InviteClient({
  token,
  groupName,
  memberCount,
  isLoggedIn,
}: {
  token: string;
  groupName: string;
  memberCount: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleJoin() {
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/");
    });
  }

  return (
    <div className="auth-shell">
      <div className="auth-main">
        <div className="auth-card text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-xl bg-[var(--accent)]/12 border border-[var(--accent)]/20 flex items-center justify-center">
            <svg width="28" height="28" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
              Join {groupName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {memberCount} member{memberCount !== 1 ? "s" : ""} already in this group
            </p>
          </div>

          {error && <div className="form-error">{error}</div>}

          {isLoggedIn ? (
            <button
              className="primary-button w-full justify-center"
              onClick={handleJoin}
              disabled={pending}
            >
              {pending ? "Joining…" : "Accept & Join Group"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Sign in to join this group
              </p>
              <a href="/login" className="primary-button inline-flex">
                Sign In
              </a>
              <a href="/register" className="secondary-button inline-flex ml-2">
                Register
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
