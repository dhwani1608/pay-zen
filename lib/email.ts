import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Send budget alert email to all group members. */
export async function sendBudgetAlertEmail(
  recipients: string[],
  groupName: string,
  spent: number,
  limit: number,
) {
  const pct = Math.round((spent / limit) * 100);

  try {
    await resend.emails.send({
      from: "PayZen <onboarding@resend.dev>",
      to: recipients,
      subject: `⚠️ ${groupName} — ${pct}% of monthly budget used`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #003249; color: #ccdbdc; padding: 32px; border-radius: 12px;">
          <h2 style="margin: 0 0 8px; color: #80ced7;">PayZen Budget Alert</h2>
          <p style="margin: 0 0 20px; font-size: 14px; color: #9ad1d4;">
            Your group <strong style="color: #fff;">${groupName}</strong> has reached
            <strong style="color: #ff5a6e;">${pct}%</strong> of its monthly limit.
          </p>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ad1d4;">Spent this month</p>
            <p style="margin: 0; font-size: 24px; font-weight: 800; color: #ff5a6e;">₹${spent.toLocaleString("en-IN")}</p>
            <p style="margin: 8px 0 0; font-size: 12px; color: #9ad1d4;">of ₹${limit.toLocaleString("en-IN")} limit</p>
          </div>
          <p style="font-size: 13px; color: #9ad1d4; margin: 0;">
            Log in to review your expenses and stay on track.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}
