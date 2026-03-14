"use server";

import { auth } from "@/auth";
import { ExpenseCategory, SplitMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type SplitInput = {
  userId: string;
  value?: number; // Used for PERCENT (e.g., 25) or CUSTOM (e.g., 50.50)
};

type AddExpensePayload = {
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  category: ExpenseCategory;
  splitMethod: SplitMethod;
  participants: SplitInput[];
};

export async function addExpense(data: AddExpensePayload) {
  // 1. Verify Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized. Please log in." };
  }

  const {
    groupId,
    description,
    amount,
    payerId,
    category,
    splitMethod,
    participants,
  } =
    data;

  // 2. Basic Validation
  if (amount <= 0) return { error: "Amount must be greater than 0." };
  if (!participants || participants.length === 0)
    return { error: "Must include participants." };

  try {
    // 3. Calculate exact split amounts based on the method
    const calculatedSplits: {
      userId: string;
      amount: number;
      percentage?: number;
    }[] = [];

    if (splitMethod === "EQUAL") {
      // Handle the penny-drop problem (splitting 100 by 3)
      const baseAmount = Math.floor((amount / participants.length) * 100) / 100;
      let remainder = Math.round(
        (amount - baseAmount * participants.length) * 100,
      );

      participants.forEach((p) => {
        let userAmount = baseAmount;
        // Give the leftover pennies to the first few users
        if (remainder > 0) {
          userAmount += 0.01;
          remainder -= 1;
        }
        calculatedSplits.push({
          userId: p.userId,
          amount: Number(userAmount.toFixed(2)),
        });
      });
    } else if (splitMethod === "PERCENT") {
      let totalPercent = 0;
      participants.forEach((p) => {
        const percent = p.value || 0;
        totalPercent += percent;
        const userAmount = (amount * percent) / 100;
        calculatedSplits.push({
          userId: p.userId,
          amount: Number(userAmount.toFixed(2)),
          percentage: percent,
        });
      });

      if (Math.round(totalPercent) !== 100) {
        return { error: "Percentages must add up to exactly 100." };
      }
    } else if (splitMethod === "CUSTOM") {
      let totalCustom = 0;
      participants.forEach((p) => {
        const userAmount = p.value || 0;
        totalCustom += userAmount;
        calculatedSplits.push({
          userId: p.userId,
          amount: Number(userAmount.toFixed(2)),
        });
      });

      if (Math.abs(totalCustom - amount) > 0.01) {
        // Allowing a tiny margin for float errors
        return {
          error: `Custom amounts must add up to the total amount (${amount}).`,
        };
      }
    }

    // 4. Save to Database using a Transaction
    // A transaction ensures both the expense and all splits are created together.
    // If one fails, the whole operation rolls back.
    const newExpense = await prisma.$transaction(async (tx) => {
      // Create the main expense record
      const expense = await tx.expense.create({
        data: {
          groupId,
          description,
          amount,
          payerId,
          category,
          splitMethod,
        },
      });

      // Map over our calculated splits and create the records
      const splitData = calculatedSplits.map((split) => ({
        expenseId: expense.id,
        userId: split.userId,
        amount: split.amount,
        percentage: split.percentage,
      }));

      await tx.expenseSplit.createMany({
        data: splitData,
      });

    return expense;
    });

    // Check budget limit and send alerts if needed
    const { checkBudgetAndAlert } = await import("@/app/actions/budget");
    await checkBudgetAndAlert(groupId);

    return { success: true, expenseId: newExpense.id };
  } catch (error) {
    console.error("Error adding expense:", error);
    return { error: "Failed to add expense to the ledger." };
  }
}

export async function deleteExpense({ expenseId }: { expenseId: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  try {
    await prisma.expense.delete({
      where: { id: expenseId },
    });
    return { success: "Transaction deleted." };
  } catch {
    return { error: "Failed to delete transaction." };
  }
}

export async function editExpense(
  expenseId: string,
  data: AddExpensePayload
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const { amount, description, payerId, category, splitMethod, participants } = data;

  if (amount <= 0) return { error: "Amount must be greater than 0." };
  if (!participants || participants.length === 0) return { error: "Must include participants." };

  try {
    const calculatedSplits: { userId: string; amount: number; percentage?: number }[] = [];

    if (splitMethod === "EQUAL") {
      const baseAmount = Math.floor((amount / participants.length) * 100) / 100;
      let remainder = Math.round((amount - baseAmount * participants.length) * 100);
      participants.forEach((p) => {
        let userAmount = baseAmount;
        if (remainder > 0) {
          userAmount += 0.01;
          remainder -= 1;
        }
        calculatedSplits.push({ userId: p.userId, amount: Number(userAmount.toFixed(2)) });
      });
    } else if (splitMethod === "PERCENT") {
      let totalPercent = 0;
      participants.forEach((p) => {
        const percent = p.value || 0;
        totalPercent += percent;
        const userAmount = (amount * percent) / 100;
        calculatedSplits.push({ userId: p.userId, amount: Number(userAmount.toFixed(2)), percentage: percent });
      });
      if (Math.round(totalPercent) !== 100) return { error: "Percentages must add up exactly to 100." };
    } else if (splitMethod === "CUSTOM") {
      let totalCustom = 0;
      participants.forEach((p) => {
        const userAmount = p.value || 0;
        totalCustom += userAmount;
        calculatedSplits.push({ userId: p.userId, amount: Number(userAmount.toFixed(2)) });
      });
      if (Math.abs(totalCustom - amount) > 0.01) return { error: "Custom amounts must equal total." };
    }

    await prisma.$transaction(async (tx) => {
      // Update basic fields
      await tx.expense.update({
        where: { id: expenseId },
        data: { amount, description, payerId, category, splitMethod },
      });

      // Erase old splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId },
      });

      // Insert new splits
      const splitData = calculatedSplits.map(s => ({
        expenseId,
        userId: s.userId,
        amount: s.amount,
        percentage: s.percentage,
      }));
      await tx.expenseSplit.createMany({ data: splitData });
    });

    return { success: "Transaction updated." };
  } catch {
    return { error: "Failed to update transaction." };
  }
}
