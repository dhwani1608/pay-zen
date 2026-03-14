"use server";

import { auth } from "@/auth";

/** Chat with the AI financial advisor. */
export async function chatWithAdvisor(
  message: string,
  context: {
    walletBalance: number;
    totalSpend: number;
    monthlyLimit?: number | null;
    recentExpenses: { description: string; amount: number; category: string; date: string }[];
    groupName: string;
  },
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "AI not configured." };

  const expensesSummary = context.recentExpenses
    .slice(0, 15)
    .map((e) => `- ${e.description}: ₹${e.amount} (${e.category}, ${e.date})`)
    .join("\n");

  const prompt = `You are PayZen AI, a sharp financial advisor for shared expenses. Be direct, use data.

User context:
- Wallet balance: ₹${context.walletBalance.toFixed(2)}
- Total group spend: ₹${context.totalSpend.toFixed(2)}
- Group: ${context.groupName}
${context.monthlyLimit ? `- Monthly budget limit: ₹${context.monthlyLimit}` : "- No monthly budget set"}

Recent expenses:
${expensesSummary || "No recent expenses."}

User asks: "${message}"

Respond concisely (max 200 words). Give actionable insights. Use ₹ for currency. If they ask about spending patterns, analyze the expenses above. If they ask how to save, give specific strategies based on their data.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        }),
      },
    );

    if (!res.ok) return { error: "AI request failed." };

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from AI.";

    return { reply };
  } catch (error) {
    console.error("Chat AI failed:", error);
    return { error: "Failed to get AI response." };
  }
}
