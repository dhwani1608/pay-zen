"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Create a shareable invite link for a group (valid 7 days). */
export async function createInviteLink(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { token: invite.token };
  } catch (error) {
    console.error("Create invite failed:", error);
    return { error: "Failed to create invite link." };
  }
}

/** Accept an invite token and join the group. */
export async function acceptInvite(token: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in first." };

  try {
    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      include: { group: { include: { members: true } } },
    });

    if (!invite) return { error: "Invalid invite link." };
    if (invite.expiresAt < new Date()) return { error: "This invite has expired." };

    // Already a member?
    const alreadyMember = invite.group.members.some(
      (m) => m.userId === session.user!.id,
    );
    if (alreadyMember) return { groupId: invite.groupId, alreadyMember: true };

    await prisma.groupMember.create({
      data: { groupId: invite.groupId, userId: session.user!.id },
    });

    return { groupId: invite.groupId, groupName: invite.group.name };
  } catch (error) {
    console.error("Accept invite failed:", error);
    return { error: "Failed to join group." };
  }
}
