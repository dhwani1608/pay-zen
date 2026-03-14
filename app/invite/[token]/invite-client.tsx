"use client";

import Link from "next/link";
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
    <main className="auth-paper auth-paper--invite">
      <section className="auth-paper__showcase">
        <div className="scribble-badge">Invitation ready</div>
        <h1>{groupName} wants you on the board.</h1>
        <p>
          Step into the same shared ledger, settlement plan, and notes wall as
          the rest of the group.
        </p>
      </section>

      <section className="auth-paper__form">
        <div className="auth-card auth-card--paper auth-card--centered">
          <p className="auth-card__eyebrow">Invite</p>
          <h2>Join {groupName}</h2>
          <p className="auth-card__copy">
            {memberCount} member{memberCount !== 1 ? "s" : ""} already inside
            this group.
          </p>

          {error ? <div className="form-error">{error}</div> : null}

          {isLoggedIn ? (
            <button
              className="primary-button auth-form__submit"
              onClick={handleJoin}
              disabled={pending}
              type="button"
            >
              {pending ? "Joining…" : "Accept invite"}
            </button>
          ) : (
            <div className="invite-actions">
              <p>Sign in first to accept this invite.</p>
              <div className="invite-actions__buttons">
                <Link href="/login" className="primary-button">
                  Sign in
                </Link>
                <Link href="/register" className="secondary-button">
                  Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
