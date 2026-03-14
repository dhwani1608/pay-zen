"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExpenseCategory, SplitMethod } from "@/generated/prisma/enums";
import { addExpense } from "@/app/actions/expenses";
import { addMemberToGroup } from "@/app/actions/groups";
import { createGroup, joinGroup } from "@/app/actions/group-workspace";
import { executeWalletSettlement } from "@/app/actions/settle";
import { scanBill } from "@/app/actions/scan-bill";
import { parseVoiceExpense } from "@/app/actions/parse-voice";
import { createInviteLink } from "@/app/actions/invite";
import { addNote, getNotes, deleteNote } from "@/app/actions/notes";
import { chatWithAdvisor } from "@/app/actions/chat";
import { setMonthlyLimit } from "@/app/actions/budget";

type SectionKey =
  | "dashboard"
  | "groups"
  | "settlements"
  | "activity"
  | "analytics"
  | "whiteboard";

type WalletTransaction = {
  id: string;
  amount: number;
  type: string;
  description?: string | null;
  createdAt: string;
};

type GroupMember = {
  id: string;
  name: string;
  email: string;
  netBalance: number;
  totalPaid: number;
};

type ExpenseItem = {
  id: string;
  description: string;
  amount: number;
  date: string;
  payerId: string;
  payerName: string;
  category: ExpenseCategory;
};

type SettlementItem = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  status: string;
  createdAt: string;
};

type Suggestion = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

type ActivityItem = {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  title: string;
  description: string;
  createdAt: string;
};

type AnalyticsItem = {
  category: string;
  amount: number;
};

type AnalyticsPoint = {
  label: string;
  amount: number;
};

type TopSpender = {
  userId: string;
  name: string;
  amount: number;
};

type ExplainabilityItem = {
  userId: string;
  userName: string;
  currentBalance: number;
  owes: {
    counterpartyId: string;
    counterpartyName: string;
    description: string;
    amount: number;
    date: string;
  }[];
};

type GroupView = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  userRole: string;
  members: GroupMember[];
  expenses: ExpenseItem[];
  settlements: SettlementItem[];
  suggestions: Suggestion[];
  activity: ActivityItem[];
  analytics: {
    byCategory: AnalyticsItem[];
    monthly: AnalyticsPoint[];
    topSpenders: TopSpender[];
  };
  moneyFlow: {
    transactions: Suggestion[];
    explainability: ExplainabilityItem[];
  };
  totalExpenseAmount: number;
};

type DashboardData = {
  userId: string;
  userName: string;
  walletBalance: number;
  hasStripe: boolean;
  initialGroupId: string | null;
  groups: GroupView[];
  walletTransactions: WalletTransaction[];
};

/* Stripe uses a hosted checkout page — no window SDK needed */

/* ─── Nav icons (inline SVG) ─── */
function IconDashboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGroups() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettlements() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconWhiteboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const sectionIcons: Record<SectionKey, () => React.JSX.Element> = {
  dashboard: IconDashboard,
  groups: IconGroups,
  settlements: IconSettlements,
  activity: IconActivity,
  analytics: IconAnalytics,
  whiteboard: IconWhiteboard,
};

const sections: { key: SectionKey; label: string; subtitle: string }[] = [
  { key: "dashboard", label: "Dashboard", subtitle: "Command center" },
  { key: "groups", label: "Groups", subtitle: "Squads & ledgers" },
  { key: "settlements", label: "Settlements", subtitle: "Clear your debts" },
  { key: "activity", label: "Activity", subtitle: "The paper trail" },
  { key: "analytics", label: "Analytics", subtitle: "Follow the money" },
  { key: "whiteboard", label: "Whiteboard", subtitle: "Group notes" },
];

const splitMethodOptions: { key: SplitMethod; label: string }[] = [
  { key: "EQUAL", label: "Equal" },
  { key: "PERCENT", label: "Percentage" },
  { key: "CUSTOM", label: "Exact" },
];

const categoryOptions = Object.values(ExpenseCategory);
const chartColors = [
  "#00d4aa",
  "#f5a623",
  "#0096ff",
  "#ff5a6e",
  "#a78bfa",
  "#f472b6",
  "#00d4aa",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/* Stripe uses server-side Checkout — no client SDK script needed */

function groupInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/* ─── Charts ─── */
function PieChart({ items }: { items: AnalyticsItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const segments = items.reduce<
    { path: string; color: string; item: AnalyticsItem; angle: number }[]
  >((accumulator, item, index) => {
    const startDegrees = accumulator.reduce(
      (sum, segment) => sum + segment.angle,
      -90,
    );
    const angle = total ? (item.amount / total) * 360 : 0;
    const startAngle = (startDegrees * Math.PI) / 180;
    const endAngle = ((startDegrees + angle) * Math.PI) / 180;
    const x1 = 60 + 52 * Math.cos(startAngle);
    const y1 = 60 + 52 * Math.sin(startAngle);
    const x2 = 60 + 52 * Math.cos(endAngle);
    const y2 = 60 + 52 * Math.sin(endAngle);
    const largeArc = angle > 180 ? 1 : 0;

    accumulator.push({
      path: `M 60 60 L ${x1} ${y1} A 52 52 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: chartColors[index % chartColors.length],
      item,
      angle,
    });

    return accumulator;
  }, []);

  return (
    <div className="analytics-chart analytics-chart--split">
      <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0">
        {segments.map((segment) => (
          <path
            key={segment.item.category}
            d={segment.path}
            fill={segment.color}
            stroke="var(--bg-secondary)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div className="legend-row" key={item.category}>
            <span
              className="legend-dot"
              style={{ background: chartColors[index % chartColors.length] }}
            />
            <div className="flex-1">
              <strong className="text-[var(--text-strong)] text-sm">
                {item.category.replaceAll("_", " ")}
              </strong>
              <p>{formatCurrency(item.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ points }: { points: AnalyticsPoint[] }) {
  const width = 420;
  const height = 220;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const polyline = points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - (point.amount / max) * (height - 30) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  // Area fill path
  const areaPath = points.length > 0
    ? `M 0,${height} ` +
      points
        .map((point, index) => {
          const x = index * stepX;
          const y = height - (point.amount / max) * (height - 30) - 10;
          return `L ${x},${y}`;
        })
        .join(" ") +
      ` L ${(points.length - 1) * stepX},${height} Z`
    : "";

  return (
    <div className="analytics-chart">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-56 w-full">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height - ratio * (height - 30)}
            y2={height - ratio * (height - 30)}
            stroke="var(--glass-border)"
            strokeDasharray="4 6"
          />
        ))}
        {areaPath && (
          <path d={areaPath} fill="url(#areaGrad)" />
        )}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          points={polyline}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const x = index * stepX;
          const y = height - (point.amount / max) * (height - 30) - 10;
          return (
            <g key={point.label}>
              <circle cx={x} cy={y} r="6" fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth="2.5" />
              <circle cx={x} cy={y} r="3" fill="var(--accent)" />
              <text
                x={x}
                y={height + 18}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="11"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarChart({ items }: { items: TopSpender[] }) {
  const max = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className="analytics-bar-grid">
      {items.map((item) => (
        <div className="analytics-bar" key={item.userId}>
          <div
            className="analytics-bar__fill"
            style={{ height: `${(item.amount / max) * 100}%` }}
          />
          <p>{item.name}</p>
          <strong>{formatCurrency(item.amount)}</strong>
        </div>
      ))}
    </div>
  );
}

function MoneyFlowDiagram({
  suggestions,
  focusedUserId,
}: {
  suggestions: Suggestion[];
  focusedUserId: string;
}) {
  const related = suggestions.filter(
    (suggestion) =>
      suggestion.fromUserId === focusedUserId || suggestion.toUserId === focusedUserId,
  );

  if (!related.length) {
    return (
      <div className="empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        No settlement flow for this member right now.
      </div>
    );
  }

  return (
    <div className="money-flow">
      {related.map((transaction, index) => (
        <div className="money-flow__row" key={`${transaction.fromUserId}-${transaction.toUserId}-${index}`}>
          <div className="money-node">
            <span>{groupInitials(transaction.fromName)}</span>
            <strong className="text-[var(--text-strong)]">{transaction.fromName}</strong>
          </div>
          <div className="money-arrow">
            <span>{formatCurrency(transaction.amount)}</span>
          </div>
          <div className="money-node money-node--accent">
            <span>{groupInitials(transaction.toName)}</span>
            <strong className="text-[var(--text-strong)]">{transaction.toName}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>("dashboard");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    data.initialGroupId,
  );
  const [focusedFlowUserId, setFocusedFlowUserId] = useState<string>(data.userId);
  const [topUpAmount, setTopUpAmount] = useState("2500");
  const [memberEmail, setMemberEmail] = useState("");
  const [groupState, setGroupState] = useState({
    name: "",
    description: "",
    inviteCode: "",
  });
  const [expenseState, setExpenseState] = useState({
    description: "",
    amount: "",
    payerId: data.userId,
    category: ExpenseCategory.OTHER as ExpenseCategory,
  });
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("EQUAL");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [settleState, setSettleState] = useState({ toUserId: "", amount: "" });
  // ── New feature state ──
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<{ id: string; content: string; authorId: string; createdAt: string }[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; type: "info" | "error" | "success" }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((text: string, type: "info" | "error" | "success" = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const [pending, startTransition] = useTransition();

  const activeGroup =
    data.groups.find((group) => group.id === selectedGroupId) ?? data.groups[0] ?? null;

  const members = activeGroup?.members ?? [];
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.id)),
  );

  // Reset selected members when group changes
  const prevGroupIdRef = useRef(activeGroup?.id);
  if (activeGroup && activeGroup.id !== prevGroupIdRef.current) {
    prevGroupIdRef.current = activeGroup.id;
    setSelectedMembers(new Set(activeGroup.members.map((m) => m.id)));
  }

  function toggleMember(memberId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        if (next.size > 1) next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  // ── New feature effects ──
  useEffect(() => {
    if (section === "whiteboard" && activeGroup && !notesLoaded) {
      getNotes(activeGroup.id).then((result) => {
        if (result.notes) { setNotes(result.notes); setNotesLoaded(true); }
      });
    }
  }, [section, activeGroup, notesLoaded]);

  useEffect(() => { setNotesLoaded(false); setNotes([]); setInviteLink(""); }, [selectedGroupId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  async function handleAddNote() {
    if (!activeGroup || !noteText.trim()) return;
    startTransition(async () => {
      const result = await addNote(activeGroup.id, noteText);
      if (result.error) { showToast(result.error, "error"); return; }
      if (result.note) { setNotes((prev) => [result.note!, ...prev]); setNoteText(""); }
    });
  }

  async function handleDeleteNote(noteId: string) {
    startTransition(async () => {
      const result = await deleteNote(noteId);
      if (result.error) { showToast(result.error, "error"); return; }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    });
  }

  async function handleChat(msg?: string) {
    const text = msg || chatInput.trim();
    if (!text || !activeGroup) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatPending(true);
    const result = await chatWithAdvisor(text, {
      walletBalance: data.walletBalance,
      totalSpend: activeGroup.totalExpenseAmount,
      monthlyLimit: null,
      recentExpenses: activeGroup.expenses.slice(0, 15).map((e) => ({
        description: e.description, amount: e.amount, category: e.category, date: e.date,
      })),
      groupName: activeGroup.name,
    });
    setChatPending(false);
    setChatMessages((prev) => [...prev, { role: "ai", text: result.reply ?? result.error ?? "No response." }]);
  }

  async function handleGenerateInvite() {
    if (!activeGroup) return;
    startTransition(async () => {
      const result = await createInviteLink(activeGroup.id);
      if (result.error) { showToast(result.error, "error"); return; }
      if (result.token) {
        const url = `${window.location.origin}/invite/${result.token}`;
        setInviteLink(url);
        navigator.clipboard.writeText(url).then(() => showToast("Invite link copied!", "success")).catch(() => {});
      }
    });
  }

  async function handleSetBudget() {
    if (!activeGroup) return;
    const limit = Number(budgetInput);
    if (!Number.isFinite(limit) || limit < 0) { showToast("Enter a valid limit.", "error"); return; }
    startTransition(async () => {
      const result = await setMonthlyLimit(activeGroup.id, limit);
      if (result.error) { showToast(result.error, "error"); return; }
      showToast(result.success ?? "Budget updated.", "success");
      router.refresh();
    });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  const focusedExplainability =
    activeGroup?.moneyFlow.explainability.find(
      (member) => member.userId === focusedFlowUserId,
    ) ?? activeGroup?.moneyFlow.explainability[0];

  async function handleTopUp() {
    ;
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      showToast("Enter a valid amount.", "error");
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error ?? "Unable to start checkout.", "error");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      showToast("Failed to connect to payment gateway.", "error");
    }
  }

  // handleDummyFunds removed — Stripe-only top-up now

  function submitExpense() {
    if (!activeGroup) return;

    startTransition(async () => {
      const selectedMembersList = members.filter((m) => selectedMembers.has(m.id));
      const participants = selectedMembersList.map((member) => ({
        userId: member.id,
        value: splitMethod === "EQUAL" ? undefined : Number(splitValues[member.id] || 0),
      }));

      const result = await addExpense({
        groupId: activeGroup.id,
        description: expenseState.description,
        amount: Number(expenseState.amount),
        payerId: expenseState.payerId,
        category: expenseState.category,
        splitMethod,
        participants,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      setExpenseState({
        description: "",
        amount: "",
        payerId: data.userId,
        category: ExpenseCategory.OTHER,
      });
      setSplitMethod("EQUAL");
      setSplitValues({});
      showToast("Expense locked in.", "success");
      router.refresh();
    });
  }

  async function processReceiptFile(file: File) {
    setScanning(true);
    ;
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await scanBill(base64);

      if (result.error) {
        showToast(result.error, "error");
      } else {
        setExpenseState((current) => ({
          ...current,
          description: result.description || current.description,
          amount: result.amount ? String(result.amount) : current.amount,
        }));
        showToast("Receipt scanned — fields auto-filled.", "success");
      }
    } catch {
      showToast("Failed to process receipt.", "error");
    } finally {
      setScanning(false);
    }
  }

  function startVoiceRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition not supported. Use Chrome or Edge.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    setRecording(true);
    setVoiceTranscript("");
    ;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      setVoiceTranscript(transcript);

      if (result.isFinal) {
        setRecording(false);
        processVoiceResult(transcript);
      }
    };

    recognition.onerror = () => {
      setRecording(false);
      setVoiceTranscript("");
      showToast("Voice recognition failed. Try again.", "error");
    };

    recognition.onend = () => {
      // only reset if still in recording state (not already processed)
      setRecording(false);
    };

    recognition.start();
  }

  async function processVoiceResult(transcript: string) {
    showToast("AI is parsing your expense...", "info");
    try {
      const memberNames = members.map((m) => m.name);
      const result = await parseVoiceExpense(transcript, memberNames);

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      // Auto-fill description and amount
      setExpenseState((current) => ({
        ...current,
        description: result.description || current.description,
        amount: result.amount ? String(result.amount) : current.amount,
        payerId: members.find((m) => m.name.toLowerCase() === result.payerName.toLowerCase())?.id ?? current.payerId,
        category: (Object.values(ExpenseCategory).includes(result.category as ExpenseCategory) ? result.category : current.category) as ExpenseCategory,
      }));

      // Auto-fill split method and values
      if (result.splitMethod && result.splitMethod !== "EQUAL") {
        setSplitMethod(result.splitMethod as SplitMethod);
        const newSplitValues: Record<string, string> = {};
        const newSelected = new Set<string>();
        for (const split of result.splits) {
          const member = members.find((m) => m.name.toLowerCase() === split.name.toLowerCase());
          if (member) {
            newSplitValues[member.id] = String(split.value);
            newSelected.add(member.id);
          }
        }
        setSplitValues(newSplitValues);
        if (newSelected.size > 0) setSelectedMembers(newSelected);
      } else {
        setSplitMethod("EQUAL");
        setSplitValues({});
        
        // If splits array has names for an equal split, select just those members
        if (result.splits && result.splits.length > 0) {
          const newSelected = new Set<string>();
          for (const split of result.splits) {
            const member = members.find((m) => m.name.toLowerCase() === split.name.toLowerCase());
            if (member) newSelected.add(member.id);
          }
          if (newSelected.size > 0) setSelectedMembers(newSelected);
        }
      }

      showToast(`Voice parsed: "${transcript}" — fields auto-filled.`, "success");
    } catch {
      showToast("Failed to parse voice input.", "error");
    }
  }

  function settleDirectly() {
    if (!activeGroup) return;
    const amount = Number(settleState.amount);
    if (!settleState.toUserId || !Number.isFinite(amount) || amount <= 0) {
      showToast("Pick a member and enter a valid amount.", "error");
      return;
    }

    startTransition(async () => {
      ;
      const result = await executeWalletSettlement({
        groupId: activeGroup.id,
        toUserId: settleState.toUserId,
        amount,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      setSettleState({ toUserId: "", amount: "" });
      showToast("Settled. Funds transferred.", "success");
      router.refresh();
    });
  }

  function settleSuggestion(suggestion: Suggestion) {
    if (!activeGroup) return;

    startTransition(async () => {
      ;
      const result = await executeWalletSettlement({
        groupId: activeGroup.id,
        toUserId: suggestion.toUserId,
        amount: suggestion.amount,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      showToast(`Settlement sent to ${suggestion.toName}.`, "info");
      router.refresh();
    });
  }

  function addMember() {
    if (!activeGroup) return;

    startTransition(async () => {
      ;
      const result = await addMemberToGroup({
        groupId: activeGroup.id,
        email: memberEmail,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      setMemberEmail("");
      showToast(result.success ?? "Member added.", "success");
      router.refresh();
    });
  }

  function createNewGroup() {
    startTransition(async () => {
      ;
      const result = await createGroup({
        name: groupState.name,
        description: groupState.description,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      setGroupState({ name: "", description: "", inviteCode: "" });
      showToast(result.success ?? "Group created.", "success");
      router.refresh();
    });
  }

  function joinExistingGroup() {
    startTransition(async () => {
      ;
      const result = await joinGroup({
        inviteCode: groupState.inviteCode,
      });

      if (result.error) {
        showToast(result.error, "error");
        return;
      }

      setGroupState((current) => ({ ...current, inviteCode: "" }));
      showToast(result.success ?? "Group joined.", "success");
      router.refresh();
    });
  }

  const overviewCards = [
    { label: "Wallet balance", value: formatCurrency(data.walletBalance), accent: true },
    {
      label: "Active group spend",
      value: formatCurrency(activeGroup?.totalExpenseAmount ?? 0),
      accent: false,
    },
    { label: "Groups joined", value: String(data.groups.length), accent: false },
    {
      label: "Min. transactions",
      value: String(activeGroup?.suggestions.length ?? 0),
      accent: false,
    },
  ];
  const currentSection = sections.find((item) => item.key === section) ?? sections[0];

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand__mark">PZ</div>
          <div>
            <p className="sidebar-eyebrow">Workspace</p>
            <h2 className="sidebar-title">PayZen</h2>
            <p className="sidebar-subtitle">
              Split expenses. Settle debts. No drama.
            </p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map((item) => {
            const Icon = sectionIcons[item.key];
            return (
              <button
                key={item.key}
                className={`sidebar-link ${section === item.key ? "sidebar-link--active" : ""}`}
                onClick={() => setSection(item.key)}
                type="button"
              >
                <Icon />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.subtitle}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-groups">
          <p className="sidebar-eyebrow">Your groups</p>
          <div className="sidebar-group-list">
            {data.groups.map((group) => (
              <button
                key={group.id}
                className={`group-chip ${selectedGroupId === group.id ? "group-chip--active" : ""}`}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setFocusedFlowUserId(data.userId);
                }}
                type="button"
              >
                <span>{groupInitials(group.name)}</span>
                <div>
                  <strong>{group.name}</strong>
                  <p>{group.members.length} members</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.type}`}>
              {toast.text}
            </div>
          ))}
        </div>

        {/* ── Onboarding CTA: shown when user has zero groups ── */}
        {data.groups.length === 0 ? (
          <div className="section-animate" style={{ marginTop: "0.5rem" }}>
            <div className="onboarding-cta">
              <div className="onboarding-cta__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h2 className="onboarding-cta__title">Launch your first squad</h2>
              <p className="onboarding-cta__text">
                Groups are how PayZen operates. Create one to start splitting bills,
                settling debts from your wallet, and watching the numbers — or jump into an existing group with an invite code.
              </p>
            </div>
            <div className="onboarding-forms">
              <div className="onboarding-form-card">
                <h3>New squad</h3>
                <p>Spin up a fresh ledger for your crew, trip, or flat</p>
                <div className="space-y-3">
                  <div className="field">
                    <label htmlFor="ob-name">Group name</label>
                    <input
                      id="ob-name"
                      value={groupState.name}
                      onChange={(e) => setGroupState((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Bangalore flat"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ob-desc">Description</label>
                    <input
                      id="ob-desc"
                      value={groupState.description}
                      onChange={(e) => setGroupState((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Rent, groceries, utilities"
                    />
                  </div>
                  <button className="primary-button w-full justify-center" onClick={createNewGroup} disabled={pending} type="button">
                    {pending ? <><span className="spinner" /> Creating…</> : "Create group"}
                  </button>
                </div>
              </div>
              <div className="onboarding-form-card">
                <h3>Got a code?</h3>
                <p>Paste an invite code to drop into an existing group</p>
                <div className="space-y-3">
                  <div className="field">
                    <label htmlFor="ob-code">Invite code</label>
                    <input
                      id="ob-code"
                      value={groupState.inviteCode}
                      onChange={(e) => setGroupState((s) => ({ ...s, inviteCode: e.target.value }))}
                      placeholder="AB12CD34"
                    />
                  </div>
                  <button className="secondary-button w-full justify-center" onClick={joinExistingGroup} disabled={pending} type="button">
                    {pending ? <><span className="spinner" /> Joining…</> : "Join group"}
                  </button>
                </div>
              </div>
            </div>

            <article className="panel panel--dark-accent" style={{ marginTop: "1.5rem" }}>
              <div className="mb-5">
                <p className="eyebrow">Wallet funding</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">Fund your wallet</h2>
              </div>
              <div className="space-y-4">
                <div className="field">
                  <label htmlFor="topup-ob">Amount (₹)</label>
                  <input id="topup-ob" inputMode="decimal" min="1" step="1" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="500" />
                </div>
                <button className="primary-button w-full justify-center" onClick={handleTopUp} disabled={pending} type="button">
                  {pending ? <><span className="spinner" /> Processing…</> : "Top up via Stripe"}
                </button>
              </div>
            </article>
          </div>
        ) : (
          <>
            {/* ── Hero + Metrics: shown when groups exist ── */}
            <section className="workspace-hero">
              <div className="workspace-hero__copy">
                <p className="workspace-hero__eyebrow">{currentSection.label}</p>
                <h2 className="workspace-hero__title">
                  {currentSection.label === "Dashboard"
                    ? `Run ${activeGroup?.name ?? "your finances"} like a machine.`
                    : `${currentSection.label} — no loose ends.`}
                </h2>
                <p className="workspace-hero__text">
                  {currentSection.subtitle}. {activeGroup
                    ? `${activeGroup.members.length} members, ${formatCurrency(
                        activeGroup.totalExpenseAmount,
                      )} tracked, invite code ${activeGroup.inviteCode}.`
                    : "Select a group from the sidebar."}
                </p>
              </div>
              <div className="workspace-hero__stats">
                <div className="workspace-hero__stat">
                  <span>Active group</span>
                  <strong>{activeGroup?.name ?? "—"}</strong>
                </div>
                <div className="workspace-hero__stat">
                  <span>Members</span>
                  <strong>{members.length}</strong>
                </div>
                <div className="workspace-hero__stat workspace-hero__stat--accent">
                  <span>Due to settle</span>
                  <strong>{activeGroup?.suggestions.length ?? 0} txns</strong>
                </div>
              </div>
            </section>

            <div className="grid gap-3 xl:grid-cols-4">
              {overviewCards.map((card) => (
                <article className="panel metric-card" key={card.label}>
                  <p>{card.label}</p>
                  <h3 style={card.accent ? { color: "var(--accent)" } : undefined}>
                    {card.value}
                  </h3>
                </article>
              ))}
            </div>
          </>
        )}

        {data.groups.length > 0 && section === "dashboard" ? (
          <div className="section-animate grid gap-6 xl:grid-cols-[1fr_1fr]">
            <article className="panel panel--soft space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Current group</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                    {activeGroup?.name ?? "No group selected"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {activeGroup?.description ?? "Create or join a group to begin."}
                  </p>
                </div>
                {activeGroup ? (
                  <div className="invite-pill">Invite: {activeGroup.inviteCode}</div>
                ) : null}
              </div>

              <div className="member-grid" style={{ maxHeight: "280px", overflowY: "auto" }}>
                {members.map((member) => (
                  <div className="member-card" key={member.id}>
                    <div className="member-card__top">
                      <span className="member-card__avatar">{groupInitials(member.name)}</span>
                      <div>
                        <strong className="text-[var(--text-strong)]">{member.name}</strong>
                        <p className="text-xs text-[var(--muted)]">{member.email}</p>
                      </div>
                    </div>
                    <div className="member-card__metrics">
                      <div>
                        <span>Net</span>
                        <strong
                          className={
                            member.netBalance >= 0
                              ? "text-[var(--success)]"
                              : "text-[var(--danger)]"
                          }
                        >
                          {member.netBalance >= 0 ? "+" : ""}
                          {formatCurrency(member.netBalance)}
                        </strong>
                      </div>
                      <div>
                        <span>Paid</span>
                        <strong className="text-[var(--text-strong)]">{formatCurrency(member.totalPaid)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="space-y-6">
              <article className="panel panel--dark-accent">
                <div className="mb-5">
                  <p className="eyebrow">Wallet funding</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">
                    Fund your wallet
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor="topup">Amount (₹)</label>
                    <input
                      id="topup"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      placeholder="500"
                      value={topUpAmount}
                      onChange={(event) => setTopUpAmount(event.target.value)}
                    />
                  </div>
                  <button
                    className="primary-button w-full justify-center"
                    disabled={pending}
                    onClick={handleTopUp}
                    type="button"
                  >
                    {pending ? <><span className="spinner" /> Processing…</> : "Top up via Stripe"}
                  </button>
                </div>
              </article>

              <article className="panel panel--soft">
                <div className="mb-5">
                  <p className="eyebrow">Log an expense</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                    Drop a bill on the group
                  </h2>
                </div>

                {/* Scan + Voice input */}
                <div className="mb-4 grid grid-cols-[1fr_auto] gap-3">
                  <div
                    className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-strong)] p-3 text-center transition-colors hover:border-[var(--accent)] cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '';
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        processReceiptFile(file);
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processReceiptFile(file);
                        e.target.value = '';
                      }}
                    />
                    {scanning ? (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <span className="spinner" />
                        <span className="text-xs text-[var(--accent)] font-semibold">Reading receipt…</span>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto mb-1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="3" x2="9" y2="21" />
                        </svg>
                        <p className="text-xs font-semibold text-[var(--text)]">Scan receipt</p>
                      </>
                    )}
                  </div>

                  {/* Voice input button */}
                  <button
                    type="button"
                    className={`flex flex-col items-center justify-center rounded-[var(--radius-md)] border-2 px-4 transition-all cursor-pointer ${
                      recording
                        ? 'border-red-500 bg-red-500/10 animate-pulse'
                        : 'border-dashed border-[var(--border-strong)] hover:border-[var(--accent)]'
                    }`}
                    onClick={startVoiceRecording}
                    disabled={recording}
                  >
                    {recording ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-red-500 animate-pulse" />
                        <p className="text-xs font-semibold text-red-400 mt-1">Listening…</p>
                      </>
                    ) : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                        <p className="text-xs font-semibold text-[var(--text)] mt-1">Voice</p>
                      </>
                    )}
                  </button>
                </div>

                {/* Voice transcript preview */}
                {voiceTranscript && (
                  <div className="mb-3 rounded-[var(--radius-sm)] bg-[var(--card-bg)] border border-[var(--border)] px-3 py-2">
                    <p className="text-xs text-[var(--muted)] mb-1">Heard:</p>
                    <p className="text-sm text-[var(--text-strong)] italic">“{voiceTranscript}”</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor="description">What was it for?</label>
                    <input
                      id="description"
                      value={expenseState.description}
                      onChange={(event) =>
                        setExpenseState((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Uber to airport"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field">
                      <label htmlFor="amount">How much? (₹)</label>
                      <input
                        id="amount"
                        inputMode="decimal"
                        value={expenseState.amount}
                        onChange={(event) =>
                          setExpenseState((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="4800"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="category">Category</label>
                      <select
                        id="category"
                        value={expenseState.category}
                        onChange={(event) =>
                          setExpenseState((current) => ({
                            ...current,
                            category: event.target.value as ExpenseCategory,
                          }))
                        }
                      >
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {category.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="payer">Who paid?</label>
                    <select
                      id="payer"
                      value={expenseState.payerId}
                      onChange={(event) =>
                        setExpenseState((current) => ({
                          ...current,
                          payerId: event.target.value,
                        }))
                      }
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Member selection toggle */}
                  <div className="field">
                    <label>Who is involved?</label>
                    <div className="flex flex-wrap gap-2">
                      {members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMember(member.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                            selectedMembers.has(member.id)
                              ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]"
                              : "bg-[var(--card-bg)] border-[var(--border-strong)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                          }`}
                        >
                          {member.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Split method toggle */}
                  <div className="field">
                    <label>Split method</label>
                    <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] p-1">
                      {splitMethodOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-all ${
                            splitMethod === opt.key
                              ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]"
                          }`}
                          onClick={() => {
                            setSplitMethod(opt.key);
                            if (opt.key === "EQUAL") setSplitValues({});
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Per-member split inputs */}
                  {splitMethod !== "EQUAL" && selectedMembers.size > 0 ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        {splitMethod === "PERCENT" ? "% per person" : "₹ per person"}
                      </label>
                      {members.filter(m => selectedMembers.has(m.id)).map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <span className="min-w-[100px] text-sm text-[var(--text)]">{member.name}</span>
                          <input
                            className="flex-1"
                            inputMode="decimal"
                            placeholder={splitMethod === "PERCENT" ? `${Math.round(100 / selectedMembers.size)}` : "0"}
                            value={splitValues[member.id] ?? ""}
                            onChange={(e) =>
                              setSplitValues((curr) => ({ ...curr, [member.id]: e.target.value }))
                            }
                          />
                          <span className="text-xs text-[var(--muted)]">
                            {splitMethod === "PERCENT" ? "%" : "₹"}
                          </span>
                        </div>
                      ))}
                      <p className="text-xs text-[var(--muted)]">
                        {splitMethod === "PERCENT"
                          ? `Total: ${members.filter(m => selectedMembers.has(m.id)).reduce((s, m) => s + (Number(splitValues[m.id]) || 0), 0)}% of 100%`
                          : `Total: ₹${members.filter(m => selectedMembers.has(m.id)).reduce((s, m) => s + (Number(splitValues[m.id]) || 0), 0).toFixed(2)} of ₹${expenseState.amount || "0"}`}
                      </p>
                    </div>
                  ) : null}

                  <button
                    className="secondary-button w-full justify-center"
                    disabled={pending || !activeGroup || selectedMembers.size === 0}
                    onClick={submitExpense}
                    type="button"
                  >
                    {pending ? (
                      <>
                        <span className="spinner" />
                        Logging…
                      </>
                    ) : (
                      splitMethod === "EQUAL" ? "Split equally" : splitMethod === "PERCENT" ? "Split by percentage" : "Split by exact amounts"
                    )}
                  </button>
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {data.groups.length > 0 && section === "groups" ? (
          <div className="section-animate grid gap-6 xl:grid-cols-[1fr_1fr]">
            <article className="panel panel--soft space-y-5">
              <div>
                <p className="eyebrow">Spin up a group</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  Start a fresh ledger
                </h2>
              </div>
              <div className="field">
                <label htmlFor="group-name">Group name</label>
                <input
                  id="group-name"
                  value={groupState.name}
                  onChange={(event) =>
                    setGroupState((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Bangalore flat"
                />
              </div>
              <div className="field">
                <label htmlFor="group-description">Description</label>
                <input
                  id="group-description"
                  value={groupState.description}
                  onChange={(event) =>
                    setGroupState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Rent, groceries, utilities"
                />
              </div>
              <button className="primary-button" onClick={createNewGroup} type="button">
                {pending ? (
                  <>
                    <span className="spinner" />
                    Creating…
                  </>
                ) : (
                  "Create group"
                )}
              </button>
            </article>

            <article className="panel panel--soft space-y-5">
              <div>
                <p className="eyebrow">Got an invite?</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  Jump in with a code
                </h2>
              </div>
              <div className="field">
                <label htmlFor="invite-code">Invite code</label>
                <input
                  id="invite-code"
                  value={groupState.inviteCode}
                  onChange={(event) =>
                    setGroupState((current) => ({
                      ...current,
                      inviteCode: event.target.value,
                    }))
                  }
                  placeholder="AB12CD34"
                />
              </div>
              <button className="secondary-button" onClick={joinExistingGroup} type="button">
                {pending ? (
                  <>
                    <span className="spinner" />
                    Joining…
                  </>
                ) : (
                  "Join group"
                )}
              </button>
              {activeGroup ? (
                <>
                  <div className="divider" />
                  <div>
                    <p className="eyebrow">Add member to {activeGroup.name}</p>
                    <div className="field mt-3">
                      <label htmlFor="member-email">Member email</label>
                      <input
                        id="member-email"
                        type="email"
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="friend@example.com"
                      />
                    </div>
                    <button className="secondary-button mt-4" onClick={addMember} type="button">
                      {pending ? (
                        <>
                          <span className="spinner" />
                          Adding…
                        </>
                      ) : (
                        "Add member"
                      )}
                    </button>
                  </div>
                </>
              ) : null}
            </article>

            <article className="panel panel--soft xl:col-span-2">
              <div className="mb-5">
                <p className="eyebrow">Your squads</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  All your groups in one place
                </h2>
              </div>
              <div className="table-list">
                {data.groups.map((group) => (
                  <div className="table-row" key={group.id}>
                    <div>
                      <strong>{group.name}</strong>
                      <p>{group.description || "No description"}</p>
                    </div>
                    <div className="text-right">
                      <strong>{group.members.length} members</strong>
                      <p>Code: {group.inviteCode}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {data.groups.length > 0 && section === "settlements" ? (
          <div className="section-animate grid gap-6 xl:grid-cols-[1fr_0.92fr]">
            <div className="space-y-6">
              <article className="panel panel--soft">
                <div className="mb-5">
                  <p className="eyebrow">Optimized settlements</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                    Who owes who — cut the noise
                  </h2>
                </div>
                <div className="table-list">
                  {activeGroup?.suggestions.length ? (
                    activeGroup.suggestions.map((suggestion, index) => (
                      <div className="table-row" key={`${suggestion.fromUserId}-${suggestion.toUserId}-${index}`}>
                        <div>
                          <strong>
                            {suggestion.fromName} → {suggestion.toName}
                          </strong>
                          <p>Minimum-path settlement.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <strong className="text-[var(--accent)]">{formatCurrency(suggestion.amount)}</strong>
                          {suggestion.fromUserId === data.userId ? (
                            <button
                              className="primary-button"
                              disabled={pending}
                              onClick={() => settleSuggestion(suggestion)}
                              type="button"
                            >
                              {pending ? (
                                <span className="spinner" />
                              ) : (
                                "Pay now"
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      All square. No debts.
                    </div>
                  )}
                </div>
              </article>

              {/* Pre-settlement card */}
              <article className="panel panel--dark-accent">
                <div className="mb-5">
                  <p className="eyebrow">Pre-settle</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">
                    Pay ahead, owe less later
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Send money now — it gets deducted from future debts.
                    Wallet: <strong className="text-[var(--accent)]">{formatCurrency(data.walletBalance)}</strong>
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor="settle-to">Send to</label>
                    <select
                      id="settle-to"
                      value={settleState.toUserId}
                      onChange={(e) => setSettleState((s) => ({ ...s, toUserId: e.target.value }))}
                    >
                      <option value="">Pick a member</option>
                      {members.filter((m) => m.id !== data.userId).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="settle-amount">Amount (₹)</label>
                    <input
                      id="settle-amount"
                      inputMode="decimal"
                      placeholder="500"
                      value={settleState.amount}
                      onChange={(e) => setSettleState((s) => ({ ...s, amount: e.target.value }))}
                    />
                  </div>
                  <button
                    className="primary-button w-full justify-center"
                    disabled={pending || !settleState.toUserId}
                    onClick={settleDirectly}
                    type="button"
                  >
                    {pending ? <><span className="spinner" /> Sending…</> : "Pre-settle from wallet"}
                  </button>
                </div>
              </article>
            </div>

            <article className="panel panel--soft space-y-5">
              <div>
                <p className="eyebrow">Money flow</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  Trace the cash
                </h2>
              </div>
              <div className="member-toggle">
                {(activeGroup?.moneyFlow.explainability ?? []).map((member) => (
                  <button
                    key={member.userId}
                    className={`member-pill ${focusedFlowUserId === member.userId ? "member-pill--active" : ""}`}
                    onClick={() => setFocusedFlowUserId(member.userId)}
                    type="button"
                  >
                    {member.userName}
                  </button>
                ))}
              </div>
              <MoneyFlowDiagram
                focusedUserId={focusedExplainability?.userId ?? data.userId}
                suggestions={activeGroup?.moneyFlow.transactions ?? []}
              />
              <div className="space-y-3">
                {(focusedExplainability?.owes ?? []).length ? (
                  focusedExplainability?.owes.map((item, index) => (
                    <div className="explain-card" key={`${item.counterpartyId}-${index}`}>
                      <strong className="text-[var(--text-strong)]">
                        Owes {item.counterpartyName} for {item.description}
                      </strong>
                      <p>
                        {formatCurrency(item.amount)} on{" "}
                        {new Date(item.date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                  No owing records for this member. Clean slate.
                  </div>
                )}
              </div>
            </article>
          </div>
        ) : null}

        {data.groups.length > 0 && section === "activity" ? (
          <article className="section-animate panel panel--soft">
            <div className="mb-5">
              <p className="eyebrow">The feed</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                Latest moves in {activeGroup?.name ?? "your groups"}
              </h2>
            </div>
            <div className="activity-list">
              {activeGroup?.activity.length ? (
                activeGroup.activity.map((item) => (
                  <div className="activity-row" key={item.id}>
                    <div className="activity-badge">{groupInitials(item.actorName)}</div>
                    <div className="flex-1">
                      <strong className="text-[var(--text-strong)]">{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <time>{new Date(item.createdAt).toLocaleDateString("en-IN")}</time>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Nothing yet. Add some expenses to get the trail started.
                </div>
              )}
            </div>
          </article>
        ) : null}

        {data.groups.length > 0 && section === "analytics" ? (
          <div className="section-animate analytics-layout">
            <article className="panel analytics-panel analytics-panel--dark">
              <div className="mb-5">
                <p className="eyebrow">Spending by category</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  Where the money bleeds
                </h2>
              </div>
              <PieChart items={activeGroup?.analytics.byCategory ?? []} />
            </article>

            <article className="panel analytics-panel analytics-panel--dark">
              <div className="mb-5">
                <p className="eyebrow">Monthly expenses</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  Burn rate over time
                </h2>
              </div>
              <LineChart
                points={
                  activeGroup?.analytics.monthly.length
                    ? activeGroup.analytics.monthly
                    : [{ label: "Now", amount: 0 }]
                }
              />
            </article>

            <article className="panel analytics-panel analytics-panel--dark analytics-panel--wide">
              <div className="mb-5">
                <p className="eyebrow">Top spenders</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                  The big spenders
                </h2>
              </div>
              <BarChart items={activeGroup?.analytics.topSpenders ?? []} />
            </article>
          </div>
        ) : null}

        {data.groups.length > 0 ? (
        <article className="panel panel--soft">
          <div className="mb-5">
            <p className="eyebrow">Wallet log</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">
              Your money trail
            </h2>
          </div>
          <div className="table-list">
            {data.walletTransactions.length ? (
              data.walletTransactions.map((transaction) => (
                <div className="table-row" key={transaction.id}>
                  <div>
                    <strong>{transaction.description || transaction.type.replaceAll("_", " ")}</strong>
                    <p className="text-xs text-[var(--muted)]">{new Date(transaction.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <strong className={transaction.amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>{transaction.amount >= 0 ? "+" : ""}{formatCurrency(transaction.amount)}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Wallet is empty. Add some funds to get rolling.
              </div>
            )}
          </div>
        </article>
        ) : null}

        {/* ── Whiteboard Section ── */}
        {data.groups.length > 0 && section === "whiteboard" ? (
          <article className="section-animate panel panel--soft space-y-5">
            <div className="mb-3">
              <p className="eyebrow">Whiteboard</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">Group Notes</h2>
            </div>

            {/* Invite link sharing */}
            <div className="space-y-3">
              <p className="eyebrow">Share invite</p>
              <div className="invite-share-row">
                <input readOnly value={inviteLink} placeholder="Generate an invite link..." />
                <button className="primary-button" onClick={handleGenerateInvite} disabled={pending} type="button">
                  {inviteLink ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>

            <div className="divider" />

            {/* Budget settings */}
            <div className="space-y-3">
              <p className="eyebrow">Monthly budget</p>
              <div className="invite-share-row">
                <input inputMode="decimal" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 10000" />
                <button className="primary-button" onClick={handleSetBudget} disabled={pending} type="button">
                  Set limit
                </button>
              </div>
            </div>

            <div className="divider" />

            {/* Add note */}
            <div className="note-input-row">
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write a note for your group..." />
              <button className="primary-button" onClick={handleAddNote} disabled={pending || !noteText.trim()} type="button">
                Post
              </button>
            </div>

            {/* Notes list */}
            <div className="notes-grid">
              {notes.length === 0 ? (
                <div className="empty-state">No notes yet. Be the first to post!</div>
              ) : (
                notes.map((note) => (
                  <div className="note-card" key={note.id}>
                    <div className="note-card__header">
                      <span className="note-card__author">
                        {members.find((m) => m.id === note.authorId)?.name ?? "Unknown"}
                      </span>
                      <span className="note-card__time">{formatDate(note.createdAt)}</span>
                    </div>
                    <div className="note-card__content">{note.content}</div>
                    {note.authorId === data.userId && (
                      <button className="note-card__delete" onClick={() => handleDeleteNote(note.id)} type="button">
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </article>
        ) : null}

        {/* ── AI Chatbot FAB + Drawer ── */}
        {data.groups.length > 0 && (
          <>
            <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)} type="button" aria-label="AI Chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {chatOpen && (
              <div className="chat-drawer">
                <div className="chat-drawer__header">
                  <h3>PayZen AI</h3>
                  <button className="chat-drawer__close" onClick={() => setChatOpen(false)} type="button">&times;</button>
                </div>
                <div className="chat-quick-prompts">
                  <button onClick={() => handleChat("Analyze my spending")} type="button">Analyze spending</button>
                  <button onClick={() => handleChat("How can I save money?")} type="button">How to save?</button>
                  <button onClick={() => handleChat("What is my biggest expense?")} type="button">Biggest expense?</button>
                </div>
                <div className="chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="chat-msg chat-msg--ai">Hi! I&apos;m your PayZen financial advisor. Ask me about your spending patterns, savings strategies, or budget insights.</div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-msg chat-msg--${msg.role === "user" ? "user" : "ai"}`}>
                      {msg.text}
                    </div>
                  ))}
                  {chatPending && <div className="chat-msg chat-msg--ai"><span className="spinner" /> Thinking...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-row">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    placeholder="Ask about your finances..."
                  />
                  <button onClick={() => handleChat()} disabled={chatPending || !chatInput.trim()} type="button">Send</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav">
        {sections.slice(0, 5).map((item) => {
          const Icon = sectionIcons[item.key];
          return (
            <button
              key={item.key}
              className={`mobile-nav__btn ${section === item.key ? "mobile-nav__btn--active" : ""}`}
              onClick={() => setSection(item.key)}
              type="button"
            >
              <Icon />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
