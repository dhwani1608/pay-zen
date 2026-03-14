"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authenticate } from "@/app/actions/authenticate";
import { FadeIn, SlideUp } from "@/components/motion-wrapper";

const initialState = { error: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    authenticate,
    initialState,
  );

  return (
    <main className="auth-paper">
      <section className="auth-paper__showcase">
        <SlideUp>
          <div className="scribble-badge">Return to your board</div>
          <h1>Pick up the same paper trail where you left it.</h1>
          <p>
            Log in to manage groups, clear balances, post notes, and move from
            a rough estimate to a clean settlement plan.
          </p>
        </SlideUp>

        <FadeIn delay={0.25} className="auth-paper__notes">
          <article>
            <strong>One board</strong>
            <span>Wallet activity, expenses, and follow-up notes stay in the same place.</span>
          </article>
          <article>
            <strong>Fast actions</strong>
            <span>Create groups, add members, and settle dues without digging through layers.</span>
          </article>
          <article>
            <strong>Readable history</strong>
            <span>Every edit and payment leaves a visible trail instead of a hidden backend state.</span>
          </article>
        </FadeIn>
      </section>

      <section className="auth-paper__form">
        <div className="auth-card auth-card--paper">
          <p className="auth-card__eyebrow">Login</p>
          <h2>Open your sketchbook</h2>
          <p className="auth-card__copy">
            Use your email and password to get back into PayZen.
          </p>

          <form action={formAction} className="auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            {state.error ? <p className="form-error">{state.error}</p> : null}

            <button
              className="primary-button auth-form__submit"
              disabled={pending}
              type="submit"
            >
              {pending ? "Opening…" : "Open board"}
            </button>
          </form>

          <p className="auth-card__footer">
            Need an account? <Link href="/register">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
