import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
      <div className="auth-shell">
        <div className="auth-main">
          <div className="auth-card text-center space-y-4">
            <h1 className="text-2xl font-bold text-[var(--text-strong)]">
              Invalid or Expired Invite
            </h1>
            <p className="text-[var(--muted)]">
              This invite link is no longer valid. Ask the group admin for a new
              one.
            </p>
            <a href="/" className="primary-button inline-flex">
              Go to PayZen
            </a>
          </div>
        </div>
      </div>
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
