import Link from "next/link";
import { auth, signOut } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen overflow-hidden">
        {/* Ambient background orbs */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute left-[-10%] top-[-5%] h-[500px] w-[500px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(0,212,170,0.12), transparent 65%)",
              animation: "orbFloat 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute right-[-5%] top-[20%] h-[400px] w-[400px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(245,166,35,0.1), transparent 65%)",
              animation: "orbFloat 14s ease-in-out infinite reverse",
            }}
          />
          <div
            className="absolute bottom-[10%] left-[30%] h-[350px] w-[350px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(0,150,255,0.08), transparent 65%)",
              animation: "orbFloat 10s ease-in-out infinite 3s",
            }}
          />
        </div>

        <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
          <header
            className="flex items-center justify-between"
            style={{ animation: "fadeInUp 0.5s ease-out" }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--accent)]">
                PayZen
              </p>
              <h1 className="mt-1.5 text-lg font-semibold text-[var(--text)]">
                Calm finances for shared plans
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link className="secondary-button" href="/login">
                Log in
              </Link>
              <Link className="primary-button" href="/register">
                Create account
              </Link>
            </div>
          </header>

          <div className="grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-8">
              <div
                className="pill-badge"
                style={{ animationDelay: "0.1s" }}
              >
                Premium fintech experience
              </div>
              <div className="space-y-6">
                <h2
                  className="max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-6xl"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--text-strong) 0%, var(--accent) 60%, var(--accent-soft) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    animation: "fadeInUp 0.6s ease-out 0.15s both",
                  }}
                >
                  Split trips, settle dues, and fund your wallet through
                  Stripe. Zero awkward texts.
                </h2>
                <p
                  className="max-w-2xl text-lg leading-8 text-[var(--muted)]"
                  style={{ animation: "fadeInUp 0.6s ease-out 0.25s both" }}
                >
                  PayZen is the operating system for shared money:
                  structured groups, real-time balances, smart reporting, and
                  a wallet that settles debts without the awkward conversations.
                </p>
              </div>

              <div
                className="flex flex-wrap gap-4"
                style={{ animation: "fadeInUp 0.6s ease-out 0.35s both" }}
              >
                <Link className="primary-button" href="/register">
                  Launch your workspace
                </Link>
                <Link className="secondary-button" href="/login">
                  Enter dashboard
                </Link>
              </div>

              <div
                className="grid gap-3 sm:grid-cols-3"
                style={{ animation: "fadeInUp 0.6s ease-out 0.45s both" }}
              >
                <article className="feature-card">
                  <p className="feature-value" style={{ color: "var(--accent)" }}>
                    Live
                  </p>
                  <p className="feature-label">
                    Real-time balances with optimized settlement paths
                  </p>
                </article>
                <article className="feature-card">
                  <p className="feature-value" style={{ color: "var(--accent-soft)" }}>
                    Stripe
                  </p>
                  <p className="feature-label">
                    Secure wallet top-ups via Stripe Checkout
                  </p>
                </article>
                <article className="feature-card">
                  <p className="feature-value" style={{ color: "var(--accent)" }}>
                    Clear
                  </p>
                  <p className="feature-label">
                    Expenses, transfers, and history — one clean dashboard
                  </p>
                </article>
              </div>
            </div>

            <div
              className="hero-panel"
              style={{ animation: "fadeInUp 0.8s ease-out 0.3s both" }}
            >
              <div className="hero-panel__top">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
                    Theme
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--text-strong)]">
                    Editorial finance, not template UI
                  </h3>
                </div>
                <div className="status-dot">
                  <span />
                  Wallet synced
                </div>
              </div>

              <div className="hero-ledger">
                <div className="hero-ledger__row">
                  <span>Goa retreat</span>
                  <strong>₹18,400</strong>
                </div>
                <div className="hero-ledger__row">
                  <span>Pending settlement</span>
                  <strong>₹3,200</strong>
                </div>
                <div className="hero-ledger__row">
                  <span>Wallet top-up</span>
                  <strong>₹5,000</strong>
                </div>
              </div>

              <div className="hero-metrics">
                <div>
                  <p>Team confidence</p>
                  <h4>98%</h4>
                </div>
                <div>
                  <p>Avg settlement</p>
                  <h4>under 1 min</h4>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  let dashboardData;
  try {
    dashboardData = await getDashboardData(session.user.id);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found.") {
      redirect("/api/auth/signout?callbackUrl=/");
    }
    throw error;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
      <header
        className="mb-8 flex flex-col gap-6 rounded-[var(--radius-xl)] border border-[var(--glass-border)] p-6 shadow-[var(--shadow-md)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(0,212,170,0.06), transparent 50%), var(--bg-secondary)",
          animation: "fadeInUp 0.5s ease-out",
        }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--accent)]">
            PayZen Workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
            Welcome back, {dashboardData.userName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Review your balances, send money from your wallet, and clear
            the next debt without leaving the dashboard.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="secondary-button" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <DashboardClient data={dashboardData} />
    </main>
  );
}
