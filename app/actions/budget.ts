"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendBudgetAlertEmail } from "@/lib/email";

/** Set or update the monthly spending limit for a group. */
export async function setMonthlyLimit(groupId: string, limit: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  if (!Number.isFinite(limit) || limit < 0) {
    return { error: "Invalid limit amount." };
  }

  try {
    await prisma.group.update({
      where: { id: groupId },
      data: { monthlyLimit: limit || null, limitAlertSent: false },
    });
    return { success: limit > 0 ? `Monthly limit set to ₹${limit.toLocaleString("en-IN")}.` : "Monthly limit removed." };
  } catch (error) {
    console.error("Set limit failed:", error);
    return { error: "Failed to update budget limit." };
  }
}

/** Check if group spending has hit ≥80% of the monthly limit. */
export async function checkBudgetAndAlert(groupId: string) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: { select: { email: true, name: true } } } },
        expenses: {
          where: {
            date: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
      },
    });

    if (!group || !group.monthlyLimit) return;
    if (group.limitAlertSent) return;

    const totalSpend = group.expenses.reduce((sum, e) => sum + e.amount, 0);
    const threshold = group.monthlyLimit * 0.8;

    if (totalSpend >= threshold) {
      const emails = group.members
        .map((m) => m.user.email)
        .filter(Boolean) as string[];

      if (emails.length > 0) {
        await sendBudgetAlertEmail(
          emails,
          group.name,
          totalSpend,
          group.monthlyLimit,
        );
      }

      await prisma.group.update({
        where: { id: groupId },
        data: { limitAlertSent: true },
      });
    }
  } catch (error) {
    console.error("Budget check failed:", error);
  }
}
