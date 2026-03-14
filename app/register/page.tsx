"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/actions/register";
import { FadeIn, SlideUp } from "@/components/motion-wrapper";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await registerUser(formData);

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (result.success) {
      setSuccess(result.success);
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    }
  }

  return (
    <main className="auth-paper">
      <section className="auth-paper__showcase">
        <SlideUp>
          <div className="scribble-badge">Build a fresh board</div>
          <h1>Start a shared money board your group can actually read.</h1>
          <p>
            Registration creates your wallet and a starter ledger so you can
            move straight into splitting bills, inviting people, and planning
            budgets.
          </p>
        </SlideUp>

        <FadeIn delay={0.25} className="auth-paper__notes">
          <article>
            <strong>Starter ledger</strong>
            <span>A default group appears immediately, ready for the first expense.</span>
          </article>
          <article>
            <strong>Wallet included</strong>
            <span>Funding, settlements, and the personal money trail are ready from day one.</span>
          </article>
          <article>
            <strong>Expandable workspace</strong>
            <span>Add more circles, notes, invites, and templates as your routine grows.</span>
          </article>
        </FadeIn>
      </section>

      <section className="auth-paper__form">
        <div className="auth-card auth-card--paper">
          <p className="auth-card__eyebrow">Create account</p>
          <h2>Set up your desk</h2>
          <p className="auth-card__copy">
            We&apos;ll create your wallet and starter workspace automatically.
          </p>

          <form action={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Aarav Mehta"
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="aarav@example.com"
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

            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}

            <button
              className="primary-button auth-form__submit"
              disabled={pending}
              type="submit"
            >
              {pending ? "Sketching…" : "Create board"}
            </button>
          </form>

          <p className="auth-card__footer">
            Already registered? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
