import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import InviteClient from "./invite-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: { group: { include: { members: true } } },
  });

  if (!invite || invite.expiresAt < new Date()) {
    return (
      <main className="auth-paper auth-paper--invite">
        <section className="auth-paper__showcase">
          <div className="scribble-badge">Invite unavailable</div>
          <h1>This invite link has expired.</h1>
          <p>Ask the group admin for a fresh link and you’ll be back on the board in a minute.</p>
        </section>

        <section className="auth-paper__form">
          <div className="auth-card auth-card--paper auth-card--centered">
            <h2 className="text-2xl font-bold text-[var(--text-strong)]">
              Invalid or Expired Invite
            </h2>
            <p className="text-[var(--muted)]">
              This invite link is no longer valid. Ask the group admin for a new
              one.
            </p>
            <Link href="/" className="primary-button inline-flex">
              Go to PayZen
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const isLoggedIn = Boolean(session?.user?.id);
  const alreadyMember = isLoggedIn && invite.group.members.some(
    (m) => m.userId === session!.user!.id,
  );

  if (alreadyMember) redirect("/");

  return (
    <InviteClient
      token={token}
      groupName={invite.group.name}
      memberCount={invite.group.members.length}
      isLoggedIn={isLoggedIn}
    />
  );
}
