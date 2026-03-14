import { auth, signOut } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard";
import { redirect } from "next/navigation";
import { LandingHero } from "@/components/landing-hero";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingHero />;
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
    <main className="page-shell">
      <header className="desk-header">
        <div className="desk-header__identity">
          <div className="desk-header__seal">
            {dashboardData.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="desk-header__eyebrow">Studio Desk</p>
            <h1 className="desk-header__title">
              {dashboardData.userName.split(" ")[0]}&apos;s sketchboard
            </h1>
            <p className="desk-header__subtitle">
              Shared spending, notes, settlements, and group decisions in one paper trail.
            </p>
          </div>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="secondary-button desk-header__signout" type="submit">
            Leave desk
          </button>
        </form>
      </header>

      <DashboardClient data={dashboardData} />
    </main>
  );
}
