import { computeSettlements } from "@/lib/settlement";
import { generateInviteCode } from "@/lib/group";
import { prisma } from "@/lib/prisma";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function fallbackName(name: string | null, email: string | null, id: string) {
  return name || email || `User ${id.slice(0, 6)}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-IN",
    {
      month: "short",
      year: "2-digit",
    },
  );
}

export async function getDashboardData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 12,
          },
        },
      },
      groups: {
        include: {
          group: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
              expenses: {
                include: {
                  payer: true,
                  splits: true,
                },
                orderBy: { date: "desc" },
              },
              settlements: {
                include: {
                  fromUser: true,
                  toUser: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const hasStripe = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );

  const groups = await Promise.all(
    user.groups.map(async (membership) => {
      const group =
        membership.group.inviteCode
          ? membership.group
          : await prisma.group.update({
              where: { id: membership.group.id },
              data: {
                inviteCode: generateInviteCode(),
              },
              include: {
                members: {
                  include: {
                    user: true,
                  },
                },
                expenses: {
                  include: {
                    payer: true,
                    splits: true,
                  },
                  orderBy: { date: "desc" },
                },
                settlements: {
                  include: {
                    fromUser: true,
                    toUser: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            });
      const memberBalances = new Map<string, number>();
      const spendingByMember = new Map<string, number>();
      const categorySpend = new Map<string, number>();
      const monthlySpend = new Map<string, number>();

      for (const member of group.members) {
        memberBalances.set(member.userId, 0);
        spendingByMember.set(member.userId, 0);
      }

      for (const expense of group.expenses) {
        memberBalances.set(
          expense.payerId,
          roundCurrency((memberBalances.get(expense.payerId) ?? 0) + expense.amount),
        );
        spendingByMember.set(
          expense.payerId,
          roundCurrency((spendingByMember.get(expense.payerId) ?? 0) + expense.amount),
        );
        categorySpend.set(
          expense.category,
          roundCurrency((categorySpend.get(expense.category) ?? 0) + expense.amount),
        );
        const expenseMonthKey = monthKey(expense.date);
        monthlySpend.set(
          expenseMonthKey,
          roundCurrency((monthlySpend.get(expenseMonthKey) ?? 0) + expense.amount),
        );

        for (const split of expense.splits) {
          memberBalances.set(
            split.userId,
            roundCurrency((memberBalances.get(split.userId) ?? 0) - split.amount),
          );
        }
      }

      const suggestions = await computeSettlements(group.id);
      const userMap = new Map(
        group.members.map((member) => [
          member.userId,
          fallbackName(member.user.name, member.user.email, member.userId),
        ]),
      );

      const memberExplainability = group.members.map((member) => {
        const owes = group.expenses
          .flatMap((expense) =>
            expense.splits
              .filter(
                (split) =>
                  split.userId === member.userId && expense.payerId !== member.userId,
              )
              .map((split) => ({
                counterpartyId: expense.payerId,
                counterpartyName:
                  userMap.get(expense.payerId) ?? expense.payerId,
                description: expense.description,
                amount: roundCurrency(split.amount),
                date: expense.date.toISOString(),
              })),
          )
          .slice(0, 8);

        return {
          userId: member.userId,
          userName: userMap.get(member.userId) ?? member.userId,
          currentBalance: roundCurrency(memberBalances.get(member.userId) ?? 0),
          owes,
        };
      });

      const monthlyKeys = Array.from(monthlySpend.keys()).sort();
      const recentMonthlyKeys = monthlyKeys.slice(-6);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode ?? "PENDING",
        userRole: membership.role,
        members: group.members.map((member) => ({
          id: member.userId,
          name: fallbackName(member.user.name, member.user.email, member.userId),
          email: member.user.email ?? "No email",
          netBalance: roundCurrency(memberBalances.get(member.userId) ?? 0),
          totalPaid: roundCurrency(spendingByMember.get(member.userId) ?? 0),
        })),
        expenses: group.expenses.map((expense) => ({
          id: expense.id,
          description: expense.description,
          amount: roundCurrency(expense.amount),
          date: expense.date.toISOString(),
          payerId: expense.payerId,
          payerName: fallbackName(
            expense.payer.name,
            expense.payer.email,
            expense.payerId,
          ),
          category: expense.category,
          splitMethod: expense.splitMethod,
          splits: expense.splits.map(s => ({
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage,
          })),
        })),
        settlements: group.settlements.map((settlement) => ({
          id: settlement.id,
          fromId: settlement.fromId,
          fromName: fallbackName(
            settlement.fromUser.name,
            settlement.fromUser.email,
            settlement.fromId,
          ),
          toId: settlement.toId,
          toName: fallbackName(
            settlement.toUser.name,
            settlement.toUser.email,
            settlement.toId,
          ),
          amount: roundCurrency(settlement.amount),
          status: settlement.status,
          method: settlement.method,
          createdAt: settlement.createdAt.toISOString(),
        })),
        suggestions: suggestions.map((suggestion) => ({
          fromUserId: suggestion.fromUser,
          fromName: userMap.get(suggestion.fromUser) ?? suggestion.fromUser,
          toUserId: suggestion.toUser,
          toName: userMap.get(suggestion.toUser) ?? suggestion.toUser,
          amount: roundCurrency(suggestion.amount),
        })),
        activity: group.expenses.slice(0, 12).map((expense) => ({
          id: expense.id,
          type: "EXPENSE_ADDED",
          actorId: expense.payerId,
          actorName: fallbackName(
            expense.payer.name,
            expense.payer.email,
            expense.payerId,
          ),
          title: `${fallbackName(expense.payer.name, expense.payer.email, expense.payerId)} added ${expense.description}`,
          description: `${expense.description} was added under ${expense.category.toLowerCase()} for ${roundCurrency(expense.amount)}.`,
          createdAt: expense.date.toISOString(),
        })),
        analytics: {
          byCategory: Array.from(categorySpend.entries())
            .map(([category, amount]) => ({
              category,
              amount: roundCurrency(amount),
            }))
            .sort((left, right) => right.amount - left.amount),
          monthly: recentMonthlyKeys.map((key) => ({
            label: monthLabel(key),
            amount: roundCurrency(monthlySpend.get(key) ?? 0),
          })),
          topSpenders: group.members
            .map((member) => ({
              userId: member.userId,
              name: fallbackName(member.user.name, member.user.email, member.userId),
              amount: roundCurrency(spendingByMember.get(member.userId) ?? 0),
            }))
            .sort((left, right) => right.amount - left.amount),
        },
        moneyFlow: {
          transactions: suggestions.map((suggestion) => ({
            fromUserId: suggestion.fromUser,
            fromName: userMap.get(suggestion.fromUser) ?? suggestion.fromUser,
            toUserId: suggestion.toUser,
            toName: userMap.get(suggestion.toUser) ?? suggestion.toUser,
            amount: roundCurrency(suggestion.amount),
          })),
          explainability: memberExplainability,
        },
        totalExpenseAmount: roundCurrency(
          group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
        ),
      };
    }),
  );

  const initialGroupId = groups[0]?.id ?? null;

  return {
    userId: user.id,
    userName: fallbackName(user.name, user.email, user.id),
    walletBalance: roundCurrency(user.wallet?.balance ?? 0),
    hasStripe,
    initialGroupId,
    groups,
    walletTransactions:
      user.wallet?.transactions.map((transaction) => ({
        id: transaction.id,
        amount: roundCurrency(transaction.amount),
        type: transaction.type,
        description: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
      })) ?? [],
  };
}
