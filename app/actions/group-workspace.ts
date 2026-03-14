"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/group";
import { revalidatePath } from "next/cache";

export async function createGroup({
  name,
  description,
}: {
  name: string;
  description?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Group name is required." };
  }

  const group = await prisma.group.create({
    data: {
      name: trimmedName,
      description: description?.trim() || "Shared expenses and settlements.",
      inviteCode: generateInviteCode(),
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
        },
      },
    },
  });

  revalidatePath("/");
  return { success: "Group created.", groupId: group.id };
}

export async function joinGroup({
  inviteCode,
}: {
  inviteCode: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized." };
  }

  const normalizedCode = inviteCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { error: "Invite code is required." };
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: normalizedCode },
  });

  if (!group) {
    return { error: "Group not found." };
  }

  try {
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: session.user.id,
      },
    });
  } catch {
    return { error: "You are already a member of this group." };
  }

  revalidatePath("/");
  return { success: `Joined ${group.name}.`, groupId: group.id };
}

export async function exitGroup({ groupId }: { groupId: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  try {
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          userId: session.user.id,
          groupId,
        },
      },
    });

    // Check if group is empty now
    const membersCount = await prisma.groupMember.count({
      where: { groupId },
    });

    if (membersCount === 0) {
      await prisma.settlement.deleteMany({ where: { groupId } });
      await prisma.group.delete({ where: { id: groupId } });
    }

    revalidatePath("/");
    return { success: "Left the group." };
  } catch (err) {
    console.error("Error exiting group:", err);
    return { error: "Failed to leave the group. Make sure you are a member and do not have unsettled dependencies." };
  }
}
