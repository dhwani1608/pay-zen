"use client";

import Image from "next/image";
import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { StaggerContainer, SlideUp } from "@/components/motion-wrapper";
import { ExpenseCategory, SplitMethod } from "@/generated/prisma/enums";
import { addExpense, editExpense, deleteExpense } from "@/app/actions/expenses";
import { addMemberToGroup } from "@/app/actions/groups";
import { createGroup, joinGroup, exitGroup } from "@/app/actions/group-workspace";
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
  | "whiteboard"
  | "templates";

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
  splitMethod: SplitMethod;
  splits: { userId: string; amount: number; percentage: number | null }[];
};

type SettlementItem = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  method: "APP" | "EXTERNAL";
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
  stripeAccountSetupComplete: boolean;
  initialGroupId: string | null;
  groups: GroupView[];
  walletTransactions: WalletTransaction[];
};

/* Stripe uses a hosted checkout page — no window SDK needed */

/* ─── Nav icons (inline SVG) ─── */
function IconDashboard() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGroups() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettlements() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconWhiteboard() {
  return (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  templates: () => (
    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="17.5" x2="21" y2="17.5" />
      <line x1="17.5" y1="14" x2="17.5" y2="21" />
    </svg>
  ),
};

const allSectionDefs = [
  { key: "dashboard" as const, label: "Studio", subtitle: "Daily board" },
  { key: "groups" as const, label: "Groups", subtitle: "People & invites" },
  { key: "settlements" as const, label: "Settle", subtitle: "Clear balances" },
  { key: "activity" as const, label: "Ledger", subtitle: "Edit trail" },
  { key: "analytics" as const, label: "Insights", subtitle: "Spending map" },
  { key: "whiteboard" as const, label: "Notes", subtitle: "Board + budget" },
  { key: "templates" as const, label: "Templates", subtitle: "Saved fills" },
];
const sections: { key: SectionKey; label: string; subtitle: string }[] = allSectionDefs;

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

function formatCurrency(amount: number, currencyCode = "INR", rate = 1) {
  const converted = amount * rate;
  return new Intl.NumberFormat(currencyCode === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(converted);
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
function PieChart({ items, currencyCode = "INR", rate = 1 }: { items: AnalyticsItem[], currencyCode?: string, rate?: number }) {
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
    <div className="flex flex-col md:flex-row gap-6 items-center justifies-center">
      <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0">
        {segments.map((segment) => (
          <path
            key={segment.item.category}
            d={segment.path}
            fill={segment.color}
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div className="flex items-center gap-3 py-1" key={item.category}>
            <span
              className="w-4 h-4 rounded-full border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              style={{ background: chartColors[index % chartColors.length] }}
            />
            <div className="flex-1">
              <strong className="text-black text-sm">
                {item.category.replaceAll("_", " ")}
              </strong>
              <p>{formatCurrency(item.amount, currencyCode, rate)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ points, currencyCode = "INR", rate = 1 }: { points: AnalyticsPoint[], currencyCode?: string, rate?: number }) {
  const width = 420;
  const height = 220;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const latestAmount = points.at(-1)?.amount ?? 0;
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
    <div className="w-full mt-6 ml-[-1rem]">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-56 w-full">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4F670" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#D4F670" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height - ratio * (height - 30)}
            y2={height - ratio * (height - 30)}
            stroke="black"
            strokeDasharray="4 6"
          />
        ))}
        {areaPath && (
          <path d={areaPath} fill="url(#areaGrad)" />
        )}
        <polyline
          fill="none"
          stroke="#D4F670"
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
              <circle cx={x} cy={y} r="6" fill="white" stroke="#D4F670" strokeWidth="2.5" />
              <circle cx={x} cy={y} r="3" fill="#D4F670" />
              <text
                x={x}
                y={height + 18}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="11"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-3 text-right text-xs text-gray-500">
        Latest: {formatCurrency(latestAmount, currencyCode, rate)}
      </p>
    </div>
  );
}

function BarChart({ items, currencyCode = "INR", rate = 1 }: { items: TopSpender[], currencyCode?: string, rate?: number }) {
  const max = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className="w-full mt-6 flex items-end justify-between gap-2 h-48 border-b-2 border-black pb-2">
      {items.map((item) => (
        <div className="flex flex-col items-center justify-end flex-1 h-full gap-2 text-xs text-center" key={item.userId}>
          <div
            className="w-full bg-[#fdfdf9] border-2 border-black rounded-t-md shadow-[2px_0px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors"
            style={{ height: `${(item.amount / max) * 100}%` }}
          />
          <p>{item.name}</p>
          <strong>{formatCurrency(item.amount, currencyCode, rate)}</strong>
        </div>
      ))}
    </div>
  );
}

function MoneyFlowDiagram({
  suggestions,
  focusedUserId,
  currencyCode = "INR",
  rate = 1,
}: {
  suggestions: Suggestion[];
  focusedUserId: string;
  currencyCode?: string;
  rate?: number;
}) {
  const related = suggestions.filter(
    (suggestion) =>
      suggestion.fromUserId === focusedUserId || suggestion.toUserId === focusedUserId,
  );

  if (!related.length) {
    return (
      <div className="empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        No settlement flow for this member right now.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {related.map((transaction, index) => (
        <div className="flex items-center p-4 bg-white border-2 border-black rounded-[2rem] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full gap-3 overflow-hidden" key={`${transaction.fromUserId}-${transaction.toUserId}-${index}`}>

          {/* Sender */}
          <div className="flex items-center gap-3 shrink-1 min-w-0 max-w-[35%]">
            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black relative z-10">
              {groupInitials(transaction.fromName)}
            </div>
            <strong className="text-black text-xs sm:text-sm truncate relative z-10 bg-white px-1">{transaction.fromName}</strong>
          </div>

          {/* Dotted Line Background Connector + Amount */}
          <div className="flex-1 relative flex items-center justify-center shrink-0 min-w-[80px]">
            {/* The dotted line spanning the remaining space */}
            <div className="absolute left-0 right-0 top-1/2 h-[2px] border-t-2 border-dashed border-gray-300 z-0 pointer-events-none" />
            {/* The Amount Badge (centered over line) */}
            <div className="relative z-20 bg-[#D4F670] border-2 border-black rounded-full px-3 py-1 font-black text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black flex items-center gap-1 group">
              <span>{formatCurrency(transaction.amount, currencyCode, rate)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 ml-1"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </div>
          </div>

          {/* Receiver */}
          <div className="flex items-center justify-end gap-3 shrink-1 min-w-0 max-w-[35%] text-right">
            <strong className="text-black text-xs sm:text-sm truncate relative z-10 bg-white px-1">{transaction.toName}</strong>
            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm bg-[#D4F670] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black relative z-10">
              {groupInitials(transaction.toName)}
            </div>
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
  const [confirmExitGroupId, setConfirmExitGroupId] = useState<string | null>(null);
  const [focusedFlowUserId, setFocusedFlowUserId] = useState<string>(data.userId);
  const [topUpAmount, setTopUpAmount] = useState("2500");
  const [withdrawAmount, setWithdrawAmount] = useState("");
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
  // ── Custom templates state ──
  const DEFAULT_TEMPLATES = [
    { id: "rent", label: "🏠 Rent", description: "Monthly Rent", amount: "10000", category: ExpenseCategory.UTILITIES },
    { id: "netflix", label: "🎬 Netflix", description: "Netflix Subscription", amount: "649", category: ExpenseCategory.FOOD },
    { id: "lunch", label: "🍱 Lunch", description: "Office Lunch", amount: "200", category: ExpenseCategory.FOOD },
  ];
  const [customTemplates, setCustomTemplates] = useState<{ id: string; label: string; description: string; amount: string; category: ExpenseCategory }[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateAmount, setNewTemplateAmount] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<ExpenseCategory>(ExpenseCategory.OTHER);
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
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
  const expenseComposerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; type: "info" | "error" | "success" }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((text: string, type: "info" | "error" | "success" = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const [pending, startTransition] = useTransition();
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ── Currency state ──
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [exchangeRate, setExchangeRate] = useState(1);

  // ── AI Itemized Split state ──
  type ScannedItem = { id: string; name: string; amount: number; assignedToUserId: string | 'SHARED' | null };
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);

  useEffect(() => {
    if (currencyCode === "INR") {
      setExchangeRate(1);
      return;
    }
    fetch(`https://api.exchangerate-api.com/v4/latest/INR`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData && resData.rates && resData.rates[currencyCode]) {
          setExchangeRate(resData.rates[currencyCode]);
        }
      })
      .catch((err) => console.error("Currency fetch error:", err));
  }, [currencyCode]);

  const displayCurrency = useCallback((amount: number) => {
    return formatCurrency(amount, currencyCode, exchangeRate);
  }, [currencyCode, exchangeRate]);

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

  // Recalculate CUSTOM split values whenever scannedItems assignments change
  useEffect(() => {
    if (scannedItems.length === 0 || splitMethod !== "CUSTOM") return;
    
    const newSplitValues: Record<string, string> = {};
    let totalAssigned = 0;
    let sharedPool = 0;

    scannedItems.forEach(item => {
      if (item.assignedToUserId === "SHARED") {
        sharedPool += item.amount;
        totalAssigned += item.amount;
      } else if (item.assignedToUserId) {
        const currentAmount = Number(newSplitValues[item.assignedToUserId] || 0);
        newSplitValues[item.assignedToUserId] = (currentAmount + item.amount).toString();
        totalAssigned += item.amount;
      }
    });

    if (sharedPool > 0 && selectedMembers.size > 0) {
      const splitShare = sharedPool / selectedMembers.size;
      selectedMembers.forEach(memberId => {
        const currentAmount = Number(newSplitValues[memberId] || 0);
        newSplitValues[memberId] = (currentAmount + splitShare).toString();
      });
    }

    setSplitValues(newSplitValues);
  }, [scannedItems, splitMethod, expenseState.amount, selectedMembers]);

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

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    startTransition(async () => {
      const res = await deleteExpense({ expenseId });
      if (res.error) showToast(res.error, "error");
      else {
        showToast(res.success ?? "Transaction deleted.", "success");
        router.refresh();
      }
    });
  };

  const isExitingRef = useRef(false);
  const handleExitGroupInit = (groupId: string) => {
    setConfirmExitGroupId(groupId);
  };

  const handleExitGroupConfirm = async (groupId: string) => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    startTransition(async () => {
      try {
        const res = await exitGroup({ groupId });
        if (res.error) {
          showToast(res.error, "error");
        } else {
          showToast(res.success ?? "Left the group.", "success");
          if (data.groups.length > 1) {
            const mainGroup = data.groups.find(g => g.id !== groupId) ?? data.groups[0];
            setSelectedGroupId(mainGroup.id);
          } else {
            setSelectedGroupId(null);
          }
        }
      } catch (e) {
        showToast("Could not exit group. You may have unsettled debts.", "error");
        console.error(e);
      } finally {
        isExitingRef.current = false;
      }
    });
  };

  const handleEditExpenseClicked = (expenseId: string) => {
    const expenseToEdit = activeGroup?.expenses.find(e => e.id === expenseId);
    if (!expenseToEdit) return;

    setEditingExpenseId(expenseToEdit.id);
    setExpenseState({
      description: expenseToEdit.description,
      amount: expenseToEdit.amount.toString(),
      payerId: expenseToEdit.payerId,
      category: expenseToEdit.category,
    });
    setSplitMethod(expenseToEdit.splitMethod as SplitMethod);

    const newSplitValues: Record<string, string> = {};
    expenseToEdit.splits.forEach(s => {
      if (expenseToEdit.splitMethod === "PERCENT" && s.percentage !== null) {
        newSplitValues[s.userId] = s.percentage.toString();
      } else if (expenseToEdit.splitMethod === "CUSTOM") {
        newSplitValues[s.userId] = s.amount.toString();
      }
    });
    setSplitValues(newSplitValues);
    setSection("dashboard");

    const involvedUsers = new Set(expenseToEdit.splits.map(s => s.userId));
    setSelectedMembers(involvedUsers);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        navigator.clipboard.writeText(url).then(() => showToast("Invite link copied!", "success")).catch(() => { });
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

  function scrollToExpenseComposer() {
    expenseComposerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

  async function handleStripeConnect() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/stripe/connect", { method: "POST" });
        const resData = await response.json();
        if (!response.ok) {
          showToast(resData.error ?? "Failed to connect to Stripe.", "error");
          return;
        }
        if (resData.url) window.location.href = resData.url;
      } catch {
        showToast("Network error.", "error");
      }
    });
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid withdrawal amount.", "error");
      return;
    }
    if (amount > data.walletBalance) {
      showToast("Insufficient wallet balance.", "error");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/stripe/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });
        const resData = await response.json();

        if (!response.ok) {
          showToast(resData.error ?? "Withdrawal failed.", "error");
          return;
        }

        showToast("Withdrawal successful!", "success");
        setWithdrawAmount("");
        router.refresh();
      } catch {
        showToast("Network error during withdrawal.", "error");
      }
    });
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

      const payload = {
        groupId: activeGroup.id,
        description: expenseState.description,
        amount: Number(expenseState.amount),
        payerId: expenseState.payerId,
        category: expenseState.category,
        splitMethod,
        participants,
      };

      const result = editingExpenseId
        ? await editExpense(editingExpenseId, payload)
        : await addExpense(payload);

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
      setScannedItems([]);
      setEditingExpenseId(null);
      showToast(editingExpenseId ? "Expense updated." : "Expense locked in.", "success");
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
        
        if (result.items && result.items.length > 0) {
          setScannedItems(result.items.map((item: any, i: number) => ({
            id: `item-${i}-${Date.now()}`,
            name: item.name,
            amount: Number(item.amount) || 0,
            assignedToUserId: null
          })));
          setSplitMethod("EQUAL"); // default to EQUAL as requested
          showToast("Receipt scanned! Switch to 'Exact' split to assign items.", "success");
        } else {
          showToast("Receipt scanned — fields auto-filled.", "success");
        }
      }
    } catch {
      showToast("Failed to process receipt.", "error");
    } finally {
      setScanning(false);
    }
  }

  function startVoiceRecording() {
    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      return;
    }

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
    recognition.continuous = true;
    recognitionRef.current = recognition;

    setRecording(true);
    setVoiceTranscript("");

    let finalTranscript = "";

    const resetSilenceTimeout = () => {
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }, 5000); // Wait 5 seconds of total silence before auto-stopping
    };

    // start the initial timeout
    resetSilenceTimeout();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      resetSilenceTimeout();
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setVoiceTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = () => {
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      setRecording(false);
      setVoiceTranscript("");
      showToast("Voice recognition failed. Try again.", "error");
    };

    recognition.onend = () => {
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      setRecording(false);
      if (finalTranscript.trim()) {
        processVoiceResult(finalTranscript.trim());
      }
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

  const currentSection = sections.find((item) => item.key === section) ?? sections[0];
  const quickAccessSections = sections.filter((item) => item.key !== section);
  const nextSuggestion = activeGroup?.suggestions[0] ?? null;
  const totalSuggestedAmount = activeGroup?.suggestions.reduce(
    (sum, suggestion) => sum + suggestion.amount,
    0,
  ) ?? 0;
  const latestExpense = activeGroup?.expenses[0] ?? null;
  const topSpender = activeGroup?.analytics.topSpenders[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Top Horizontal Navigation ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white px-5 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10">

        {/* Group Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold uppercase tracking-wider text-xs whitespace-nowrap">Active Group:</span>
          <div className="relative flex items-center bg-[#fdfdf9] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors focus-within:ring-2 focus-within:ring-[#D4F670]">
            <select
              className="appearance-none outline-none bg-transparent pl-3 pr-8 py-2 text-sm font-bold cursor-pointer w-full h-full"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              value={selectedGroupId ?? ""}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setFocusedFlowUserId(data.userId);
              }}
            >
              {data.groups.length === 0 && (
                <option value="" disabled>No groups yet</option>
              )}
              {data.groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="hidden lg:flex bg-[#f6f6f6] p-1.5 rounded-lg border-2 border-black overflow-x-auto hide-scrollbars">
          <AnimatePresence>
            {sections.map((item) => {
              const Icon = sectionIcons[item.key];
              const isActive = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`relative flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors whitespace-nowrap ${isActive ? "text-black" : "text-gray-500 hover:text-black"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#D4F670] rounded-md border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon />
                    <span className="inline-block">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Currency Selector & Actions */}
        <div className="flex items-center shrink-0 gap-3">
          <div className="relative flex items-center bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors focus-within:ring-2 focus-within:ring-[#D4F670]">
            <select
              value={currencyCode}
              onChange={e => setCurrencyCode(e.target.value)}
              className="appearance-none outline-none bg-transparent pl-3 pr-8 py-2 text-sm font-bold cursor-pointer w-full h-full"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
            >
              <option value="INR">INR ₹</option>
              <option value="USD">USD $</option>
              <option value="EUR">EUR €</option>
              <option value="GBP">GBP £</option>
              <option value="JPY">JPY ¥</option>
              <option value="AED">AED د.إ</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
          
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 text-sm font-bold bg-[#fdfdf9] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffcccb] transition-colors text-black whitespace-nowrap"
            title="Log out"
          >
            Leave desk
          </button>
        </div>
      </div>

      <section className="w-full">
        {/* Custom Confirm Modal */}
        <AnimatePresence>
          {confirmExitGroupId && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white p-6 rounded-2xl border border-black shadow-2xl max-w-sm w-full"
              >
                <div className="flex items-center gap-3 mb-4 text-red-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <h3 className="text-lg font-bold text-black">Leave Group?</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  Are you sure you want to exit this group? You will lose access to its ledger and history.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#f6f6f6] hover:bg-[var(--border)] transition-colors"
                    onClick={() => setConfirmExitGroupId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--danger)] text-white hover:opacity-90 transition-opacity shadow-lg shadow-red-500/20"
                    onClick={() => {
                      const id = confirmExitGroupId;
                      setConfirmExitGroupId(null);
                      if (id) handleExitGroupConfirm(id);
                    }}
                  >
                    Yes, Exit Group
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
          <div className="section-animate mt-8">
            <div className="bg-[#fdfdf9] border-2 border-black rounded-xl p-8 mb-8 text-center flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-16 h-16 bg-[#D4F670] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-black tracking-tight mb-2">Your Groups</h2>
              <p className="text-gray-600 max-w-sm mx-auto font-medium">
                Create a new group or join one with an invite code to start tracking expenses.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 transition-transform">
                <h3 className="text-xl font-black text-black mb-2">Create New</h3>
                <p className="text-gray-600 text-sm font-medium mb-6">Start a new shared ledger.</p>
                <div className="space-y-4 flex-grow flex flex-col justify-end">
                  <div className="field">
                    <label htmlFor="ob-name" className="text-sm font-bold text-black uppercase tracking-wider">Group name</label>
                    <input
                      id="ob-name"
                      value={groupState.name}
                      onChange={(e) => setGroupState((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Bangalore flat"
                      className="w-full px-3 py-2 bg-[#fdfdf9] border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-[#D4F670]/50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ob-desc" className="text-sm font-bold text-black uppercase tracking-wider">Description</label>
                    <input
                      id="ob-desc"
                      value={groupState.description}
                      onChange={(e) => setGroupState((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Rent, groceries, utilities"
                      className="w-full px-3 py-2 bg-[#fdfdf9] border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-[#D4F670]/50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                    />
                  </div>
                  <button className="flex bg-black text-white font-black text-lg py-3 rounded-xl border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] justify-center items-center mt-2 group relative overflow-hidden" onClick={createNewGroup} disabled={pending} type="button">
                    <span className="relative z-10 flex items-center gap-2">
                       {pending ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin group-hover:border-black group-hover:border-t-transparent" /> Creating…</> : "Create group"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="bg-white border-2 border-black rounded-xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:-translate-y-1 transition-transform">
                <h3 className="text-xl font-black text-black mb-2">Join Group</h3>
                <p className="text-gray-600 text-sm font-medium mb-6">Enter an invite code.</p>
                <div className="space-y-4 flex-grow flex flex-col justify-end">
                  <div className="field flex-grow">
                    <label htmlFor="ob-code" className="text-sm font-bold text-black uppercase tracking-wider">Invite code</label>
                    <input
                      id="ob-code"
                      value={groupState.inviteCode}
                      onChange={(e) => setGroupState((s) => ({ ...s, inviteCode: e.target.value }))}
                      placeholder="AB12CD34"
                      className="w-full px-3 py-2 bg-[#fdfdf9] border-2 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-[#D4F670]/50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow uppercase font-mono tracking-widest"
                    />
                  </div>
                  <button className="flex bg-white text-black font-black text-lg py-3 rounded-xl border-2 border-black hover:bg-[#f6f6f6] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] justify-center items-center mt-2 group relative overflow-hidden" onClick={joinExistingGroup} disabled={pending} type="button">
                    <span className="relative z-10 flex items-center gap-2">
                      {pending ? <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Joining…</> : "Join group"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <article className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Wallet funding</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">Add funds</h2>
                </div>
                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor="topup-ob">Amount (₹)</label>
                    <input id="topup-ob" inputMode="decimal" min="1" step="1" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="500" />
                  </div>
                  <button className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 w-full justify-center" onClick={handleTopUp} disabled={pending} type="button">
                    {pending ? <><span className="spinner" /> Processing…</> : "Top up via Stripe"}
                  </button>
                </div>
              </article>

              <article className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Wallet withdrawal</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">Transfer to Bank</h2>
                </div>
                {!data.stripeAccountSetupComplete ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">You need to connect your bank account to withdraw funds.</p>
                    <button className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 w-full justify-center" onClick={handleStripeConnect} disabled={pending} type="button">
                      {pending ? <><span className="spinner" /> Loading…</> : "Setup Bank Details"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="field">
                      <label htmlFor="withdraw-ob">Amount (₹)</label>
                      <input id="withdraw-ob" inputMode="decimal" min="1" step="1" max={data.walletBalance} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="500" />
                    </div>
                    <button className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 w-full justify-center" onClick={handleWithdraw} disabled={pending || data.walletBalance <= 0} type="button">
                      {pending ? <><span className="spinner" /> Processing…</> : "Withdraw to Bank"}
                    </button>
                  </div>
                )}
              </article>
            </div>
          </div>
        ) : (
          <>
            {/* ── Hero + Metrics: shown when groups exist ── */}
            <section className="bg-white border-2 border-black rounded-xl px-6 py-7 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-8 relative overflow-hidden">
              {/* Decorative Circle */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#D4F670]/20 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="flex-1 z-10">
                <p className="text-xs font-bold uppercase tracking-widest text-[#65a30d]">{currentSection.label}</p>
                <h2 className="text-3xl md:text-4xl font-black text-black tracking-tight mt-1">
                  {section === "dashboard"
                    ? activeGroup?.name ?? "No group selected"
                    : currentSection.label}
                </h2>
                <p className="text-gray-600 mt-2 max-w-lg">
                  {activeGroup
                    ? `${activeGroup.members.length} members · ${displayCurrency(activeGroup.totalExpenseAmount)} total`
                    : "Select a group to view details."}
                </p>
                {section === "dashboard" ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={scrollToExpenseComposer}
                      className="px-4 py-3 bg-black text-white font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] hover:text-black transition-colors"
                    >
                      Add expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("settlements")}
                      className="px-4 py-3 bg-white text-black font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors"
                    >
                      Review settlements
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:max-w-3xl">
                <div className="bg-white border-2 border-black rounded-lg p-3 hover:bg-[#f6f6f6] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span>Active group</span>
                  <strong className="block mt-1 text-lg text-black">{activeGroup?.name ?? "—"}</strong>
                </div>
                <div className="bg-white border-2 border-black rounded-lg p-3 hover:bg-[#f6f6f6] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span>Members</span>
                  <strong className="block mt-1 text-lg text-black">{members.length}</strong>
                </div>
                <div className="bg-[#D4F670]/20 border-2 border-[#D4F670] rounded-lg p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span>Due to settle</span>
                  <strong className="block mt-1 text-lg text-[#65a30d]">{activeGroup?.suggestions.length ?? 0} txns</strong>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr] my-10">
              <article className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Next action</p>
                    <h3 className="mt-2 text-2xl font-black text-black tracking-tight">
                      {nextSuggestion ? "Clear the next settlement" : "You're caught up"}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full border-2 border-black text-xs font-bold uppercase tracking-wider bg-white">
                    {activeGroup?.suggestions.length ?? 0} pending
                  </span>
                </div>

                {nextSuggestion ? (
                  <>
                    <div className="rounded-xl border-2 border-black bg-white p-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-sm text-gray-600">Recommended transfer</p>
                      <strong className="mt-1 block text-xl text-black">
                        {nextSuggestion.fromName} pays {nextSuggestion.toName}
                      </strong>
                      <p className="mt-2 text-3xl font-black text-[#65a30d]">
                        {displayCurrency(nextSuggestion.amount)}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => setSection("settlements")}
                        className="px-4 py-3 bg-black text-white font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] hover:text-black transition-colors"
                      >
                        Open settlements
                      </button>
                      <p className="text-sm text-gray-600 self-center">
                        {activeGroup?.suggestions.length ?? 0} transfers add up to {displayCurrency(totalSuggestedAmount)}.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-black bg-white p-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[#65a30d] font-bold text-center flex flex-col items-center justify-center min-h-[140px]">
                    No suggested transfers right now. Your balances look clean, so you can move on to expenses, notes, or invites.
                  </div>
                )}
              </article>

              <article className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Latest activity</p>
                  <h3 className="mt-2 text-xl font-black text-black tracking-tight">
                    {latestExpense ? latestExpense.description : "No expense yet"}
                  </h3>
                </div>

                {latestExpense ? (
                  <>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>
                        Paid by <strong className="text-black">{latestExpense.payerName}</strong>
                      </p>
                      <p>{formatDate(latestExpense.date)}</p>
                      <p className="uppercase tracking-wider">
                        {latestExpense.category.replaceAll("_", " ")}
                      </p>
                    </div>
                    <p className="text-3xl font-black text-black">
                      {displayCurrency(latestExpense.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSection("activity")}
                      className="mt-auto px-4 py-3 bg-[#f6f6f6] text-black font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors"
                    >
                      View ledger
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-black bg-[#fdfdf9] p-4 text-sm text-gray-600">
                    Add the first expense for this group to start building the ledger.
                  </div>
                )}
              </article>

              <article className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Quick jump</p>
                  <h3 className="mt-2 text-xl font-black text-black tracking-tight">Go where work is waiting</h3>
                </div>

                <div className="grid gap-4">
                  {quickAccessSections
                    .filter((item) => ["settlements", "activity", "whiteboard"].includes(item.key))
                    .map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSection(item.key)}
                        className="text-left rounded-xl border-2 border-black bg-[#fdfdf9] px-4 py-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors"
                      >
                        <strong className="block text-black">{item.label}</strong>
                        <span className="block text-sm text-gray-600">{item.subtitle}</span>
                      </button>
                    ))}
                </div>

                <div className="mt-auto rounded-xl border-2 border-black bg-[#fdfdf9] p-4">
                  <p className="text-sm text-gray-600">Top spender this cycle</p>
                  <strong className="mt-1 block text-lg text-black">
                    {topSpender ? topSpender.name : "No spending yet"}
                  </strong>
                  <p className="mt-1 text-2xl font-black text-[#65a30d]">
                    {topSpender ? displayCurrency(topSpender.amount) : displayCurrency(0)}
                  </p>
                </div>
              </article>
            </div>
          </>
        )}

        <AnimatePresence mode="popLayout">
          {data.groups.length > 0 && section === "dashboard" ? (
            <StaggerContainer key="dashboard" className="flex flex-col-reverse xl:grid items-start gap-8 xl:grid-cols-[0.92fr_1.08fr] w-full">
              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-black flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#65a30d]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      {activeGroup?.name ?? "No group selected"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {activeGroup?.description ?? "Create or join a group."}
                    </p>
                  </div>
                  {activeGroup ? (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <div className="invite-pill">Invite: {activeGroup.inviteCode}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleExitGroupInit(activeGroup.id);
                        }}
                        className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-600 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-50 transition-colors"
                      >
                        Exit group
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {members.map((member) => (
                    <div className="flex items-center gap-4 p-4 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fdfdf9] transition-colors" key={member.id}>
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#D4F670] border-2 border-black flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {groupInitials(member.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <strong className="text-black block truncate">{member.name}</strong>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-sm font-medium flex-shrink-0">
                        <span className="text-xs uppercase tracking-widest text-[#93c713]">Net</span>
                        <strong className={member.netBalance >= 0 ? "text-green-600" : "text-red-600"}>
                          {member.netBalance >= 0 ? "+" : ""}
                          {displayCurrency(member.netBalance)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Members</p>
                    <strong className="mt-2 block text-2xl text-black">{members.length}</strong>
                  </div>
                  <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Total spend</p>
                    <strong className="mt-2 block text-2xl text-black">{displayCurrency(activeGroup?.totalExpenseAmount ?? 0)}</strong>
                  </div>
                  <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Pending</p>
                    <strong className="mt-2 block text-2xl text-black">{activeGroup?.suggestions.length ?? 0}</strong>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-5">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#65a30d]"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
                      Wallet tools
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Top up or send wallet funds to your bank through Stripe.</p>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-xl border-2 border-black bg-[#fdfdf9] p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Top up</p>
                          <p className="text-sm text-gray-500">Add funds with Stripe checkout.</p>
                        </div>
                        <strong className="text-sm text-black">{displayCurrency(data.walletBalance)}</strong>
                      </div>
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
                        className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-5 py-3 w-full justify-center"
                        disabled={pending}
                        onClick={handleTopUp}
                        type="button"
                      >
                        {pending ? <><span className="spinner" /> Processing…</> : "Top up via Stripe"}
                      </button>
                    </div>

                    <div className="rounded-xl border-2 border-black bg-[#fdfdf9] p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#93c713]">Withdraw</p>
                          <p className="text-sm text-gray-500">Send wallet funds to your bank with Stripe.</p>
                        </div>
                        <strong className="text-sm text-black">Available: {displayCurrency(data.walletBalance)}</strong>
                      </div>
                      {!data.stripeAccountSetupComplete ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">Connect your bank account once to enable Stripe payouts.</p>
                          <button
                            className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-3 w-full justify-center"
                            onClick={handleStripeConnect}
                            disabled={pending}
                            type="button"
                          >
                            {pending ? <><span className="spinner" /> Loading…</> : "Set up bank with Stripe"}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="field">
                            <label htmlFor="withdraw">Amount (₹)</label>
                            <input
                              id="withdraw"
                              inputMode="decimal"
                              min="1"
                              step="1"
                              max={data.walletBalance}
                              value={withdrawAmount}
                              onChange={(event) => setWithdrawAmount(event.target.value)}
                              placeholder="500"
                            />
                          </div>
                          <button
                            className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-3 w-full justify-center"
                            onClick={handleWithdraw}
                            disabled={pending || data.walletBalance <= 0}
                            type="button"
                          >
                            {pending ? <><span className="spinner" /> Processing…</> : "Withdraw to bank via Stripe"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </SlideUp>

              <StaggerContainer staggerChildren={0.1} delayChildren={0.1} className="space-y-6">
                <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                  <div ref={expenseComposerRef} className="mb-4 border-b border-black pb-3 scroll-mt-28">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-lg font-bold tracking-tight text-black flex items-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#65a30d]"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          New Expense
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">This stays front and center so adding a shared cost takes one quick step.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseState({
                            description: "",
                            amount: "",
                            payerId: data.userId,
                            category: ExpenseCategory.OTHER,
                          });
                          setSplitMethod("EQUAL");
                          setSplitValues({});
                          setEditingExpenseId(null);
                          setSelectedMembers(new Set(members.map((member) => member.id)));
                          scrollToExpenseComposer();
                        }}
                        className="px-4 py-2 bg-white text-black font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors"
                      >
                        Fresh form
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => setExpenseState(s => ({ ...s, description: "Monthly Rent", category: ExpenseCategory.STAY }))} className="pl-3 pr-5 py-1.5 text-xs font-semibold rounded-full bg-[#f6f6f6] border border-black text-[#65a30d] hover:bg-[#D4F670] hover:text-black transition-all hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      🏠 Rent
                    </button>
                    <button type="button" onClick={() => setExpenseState(s => ({ ...s, description: "Netflix", category: ExpenseCategory.ENTERTAINMENT }))} className="pl-3 pr-5 py-1.5 text-xs font-semibold rounded-full bg-[#f6f6f6] border border-black text-[#e50914] hover:bg-[#e50914] hover:text-white transition-all hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      🍿 Netflix
                    </button>
                    <button type="button" onClick={() => setExpenseState(s => ({ ...s, description: "Office Lunch", category: ExpenseCategory.FOOD }))} className="pl-3 pr-5 py-1.5 text-xs font-semibold rounded-full bg-[#f6f6f6] border border-black text-[#f5a623] hover:bg-[#f5a623] hover:text-black transition-all hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      🍜 Lunch
                    </button>
                  </div>

                  {/* Scan + Voice input */}
                  <div className="mb-4 grid grid-cols-[1fr_auto] gap-3">
                    <div
                      className="rounded-[12px] border-2 border-dashed border-black p-3 text-center transition-colors hover:border-[#D4F670] cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#D4F670'; }}
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
                          <span className="text-xs text-[#65a30d] font-semibold">Reading receipt…</span>
                        </div>
                      ) : (
                        <>
                          <svg className="mx-auto mb-1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                          </svg>
                          <p className="text-xs font-semibold text-black">Scan receipt</p>
                        </>
                      )}
                    </div>

                    {/* Voice input button */}
                    <button
                      type="button"
                      className={`flex flex-col items-center justify-center rounded-[12px] border-2 px-4 transition-all cursor-pointer ${recording
                        ? 'border-red-500 bg-red-500/10 animate-pulse'
                        : 'border-dashed border-black hover:border-[#D4F670]'
                        }`}
                      onClick={startVoiceRecording}
                    >
                      {recording ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-red-500 animate-pulse" />
                          <p className="text-xs font-semibold text-red-500 mt-1">Listening…</p>
                        </>
                      ) : (
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                          <p className="text-xs font-semibold text-black mt-1">Voice</p>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Voice transcript preview */}
                  {voiceTranscript && (
                    <div className="mb-3 rounded-[8px] bg-white border border-black px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">Heard:</p>
                      <p className="text-sm text-black italic">“{voiceTranscript}”</p>
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
                            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 ${selectedMembers.has(member.id)
                              ? "bg-[#D4F670] text-black"
                              : "bg-white text-gray-500 hover:text-black hover:bg-gray-50"
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
                      <div className="flex gap-1 rounded-[12px] border border-black p-1">
                        {splitMethodOptions.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={`flex-1 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-all ${splitMethod === opt.key
                                ? "bg-[#D4F670] text-black"
                                : "text-gray-500 hover:text-black"
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

                    {/* AI Itemized Split UI */}
                    {scannedItems.length > 0 && splitMethod === "CUSTOM" && (
                      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl p-5 space-y-4 mb-4">
                        <div className="flex justify-between items-center border-b-2 border-black pb-3">
                           <span className="font-black tracking-tight text-lg uppercase">Receipt Items</span>
                           <span className="bg-[#D4F670] border-2 border-black px-2 py-1 text-xs font-bold rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">AI Extracted</span>
                        </div>
                        <div className="flex flex-col gap-3">
                          {scannedItems.map((item) => (
                            <div key={item.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-[#fdfdf9] border-2 border-black p-3 rounded-lg hover:bg-[#f6f6f6] transition-colors">
                              <div className="flex justify-between sm:justify-start w-full sm:w-1/2 gap-4 items-center">
                                <span className="font-bold text-sm truncate uppercase" title={item.name}>{item.name}</span>
                                <span className="font-black text-lg whitespace-nowrap">₹{item.amount.toFixed(2)}</span>
                              </div>
                              <select
                                className="w-full sm:w-1/2 appearance-none bg-white border-2 border-black rounded-lg px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-[#D4F670] cursor-pointer"
                                value={item.assignedToUserId || ""}
                                onChange={(e) => {
                                  const userId = e.target.value;
                                  setScannedItems(items => items.map(i => i.id === item.id ? { ...i, assignedToUserId: userId } : i));
                                }}
                              >
                                <option value="" disabled>Assign to...</option>
                                <option value="SHARED">Everyone (Shared)</option>
                                {members.filter(m => selectedMembers.has(m.id)).map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs font-bold text-gray-500 mt-2">
                          Items assigned above will automatically tally in the Custom Split panel below. "Everyone" divides equally.
                        </p>
                      </div>
                    )}

                    {/* Per-member split inputs */}
                    {splitMethod !== "EQUAL" && selectedMembers.size > 0 ? (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {splitMethod === "PERCENT" ? "% per person" : "₹ per person"}
                        </label>
                        {members.filter(m => selectedMembers.has(m.id)).map((member) => (
                          <div key={member.id} className="flex items-center gap-3">
                            <span className="min-w-[100px] text-sm text-black">{member.name}</span>
                            <input
                              className="flex-1"
                              inputMode="decimal"
                              placeholder={splitMethod === "PERCENT" ? `${Math.round(100 / selectedMembers.size)}` : "0"}
                              value={splitValues[member.id] ?? ""}
                              onChange={(e) =>
                                setSplitValues((curr) => ({ ...curr, [member.id]: e.target.value }))
                              }
                            />
                            <span className="text-xs text-gray-500">
                              {splitMethod === "PERCENT" ? "%" : "₹"}
                            </span>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500">
                          {splitMethod === "PERCENT"
                            ? `Total: ${members.filter(m => selectedMembers.has(m.id)).reduce((s, m) => s + (Number(splitValues[m.id]) || 0), 0)}% of 100%`
                            : `Total: ₹${members.filter(m => selectedMembers.has(m.id)).reduce((s, m) => s + (Number(splitValues[m.id]) || 0), 0).toFixed(2)} of ₹${expenseState.amount || "0"}`}
                        </p>
                      </div>
                    ) : null}

                    <button
                      className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 w-full justify-center relative overflow-hidden group"
                      disabled={pending || !activeGroup || selectedMembers.size === 0}
                      onClick={submitExpense}
                      type="button"
                    >
                      {pending ? (
                        <>
                          <span className="spinner" />
                          Processing…
                        </>
                      ) : (
                        editingExpenseId ? "Update Expense" : (splitMethod === "EQUAL" ? "Split equally" : splitMethod === "PERCENT" ? "Split by percentage" : "Split by exact amounts")
                      )}
                    </button>
                    {editingExpenseId && (
                      <button
                        className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-red-500 text-center w-full block outline-none transition-colors"
                        onClick={() => {
                          setEditingExpenseId(null);
                          setExpenseState({ description: "", amount: "", payerId: data.userId, category: ExpenseCategory.OTHER });
                          setSplitMethod("EQUAL");
                          setSplitValues({});
                          setSelectedMembers(new Set(members.map(m => m.id)));
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </SlideUp>
              </StaggerContainer>
            </StaggerContainer>
          ) : null}

          {data.groups.length > 0 && section === "groups" ? (
            <StaggerContainer key="groups" className="grid gap-6 xl:grid-cols-[1fr_1fr] w-full">
              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Spin up a group</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
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
                <button className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2" onClick={createNewGroup} type="button">
                  {pending ? (
                    <>
                      <span className="spinner" />
                      Creating…
                    </>
                  ) : (
                    "Create group"
                  )}
                </button>
              </SlideUp>

              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Got an invite?</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
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
                <button className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2" onClick={joinExistingGroup} type="button">
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
                      <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Add member to {activeGroup.name}</p>
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
                      <button className="flex bg-white text-black font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 mt-4" onClick={addMember} type="button">
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
              </SlideUp>

              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 xl:col-span-2">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Your squads</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    All your groups in one place
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {data.groups.map((group) => (
                    <div className="flex items-center justify-between p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors" key={group.id}>
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
              </SlideUp>
            </StaggerContainer>
          ) : null}

          {data.groups.length > 0 && section === "settlements" ? (
            <StaggerContainer key="settlements" className="grid gap-6 xl:grid-cols-[1fr_0.92fr] w-full">
              <StaggerContainer staggerChildren={0.1} className="space-y-6">
                <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Optimized settlements</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                      Who owes who — cut the noise
                    </h2>
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeGroup?.suggestions.length ? (
                      activeGroup.suggestions.map((suggestion, index) => (
                        <div className="flex items-center justify-between p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors" key={`${suggestion.fromUserId}-${suggestion.toUserId}-${index}`}>
                          <div>
                            <strong>
                              {suggestion.fromName} → {suggestion.toName}
                            </strong>
                            <p>Minimum-path settlement.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <strong className="text-[#65a30d]">{displayCurrency(suggestion.amount)}</strong>
                            {suggestion.fromUserId === data.userId ? (
                              <button
                                className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2"
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
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4F670" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        All square. No debts.
                      </div>
                    )}
                  </div>
                </SlideUp>

                {/* Pre-settlement card */}
                <SlideUp className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Pre-settle</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em]">
                      Pay ahead, owe less later
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Send money now — it gets deducted from future debts.
                      Wallet: <strong className="text-[#65a30d]">{displayCurrency(data.walletBalance)}</strong>
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
                      className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2 w-full justify-center"
                      disabled={pending || !settleState.toUserId}
                      onClick={settleDirectly}
                      type="button"
                    >
                      {pending ? <><span className="spinner" /> Sending…</> : "Pre-settle from wallet"}
                    </button>
                  </div>
                </SlideUp>
              </StaggerContainer>

              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Money flow</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    Trace the cash
                  </h2>
                </div>
                <div className="member-toggle">
                  {(activeGroup?.moneyFlow.explainability ?? []).map((member) => (
                    <button
                      key={member.userId}
                      className={`px-4 py-2 font-bold text-sm border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors hover:-translate-y-0.5 ${focusedFlowUserId === member.userId ? "bg-[#D4F670] text-black" : "bg-white text-gray-600 hover:bg-[#f6f6f6]"}`}
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
                  currencyCode={currencyCode}
                  rate={exchangeRate}
                />
                <div className="space-y-3">
                  {(focusedExplainability?.owes ?? []).length ? (
                    focusedExplainability?.owes.map((item, index) => (
                      <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" key={`${item.counterpartyId}-${index}`}>
                        <strong className="text-black">
                          Owes {item.counterpartyName} for {item.description}
                        </strong>
                        <p>
                          {displayCurrency(item.amount)} on{" "}
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
              </SlideUp>
            </StaggerContainer>
          ) : null}

          {data.groups.length > 0 && section === "activity" ? (
            <StaggerContainer key="activity" className="w-full">
              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">The feed</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    Latest moves in {activeGroup?.name ?? "your groups"}
                  </h2>
                </div>
                <div className="activity-list">
                  {activeGroup?.activity.length ? (
                    activeGroup.activity.map((item) => (
                      <div className="flex gap-4 p-4 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" key={item.id}>
                        <div className="w-8 h-8 rounded-full bg-[#D4F670] border-2 border-black flex items-center justify-center font-bold text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0">{groupInitials(item.actorName)}</div>
                        <div className="flex-1">
                          <strong className="text-black">{item.title}</strong>
                          <p>{item.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <time className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString("en-IN")}</time>
                          <div className="flex gap-2">
                            <button onClick={() => handleEditExpenseClicked(item.id)} className="text-xs text-[#65a30d] hover:underline">Edit</button>
                            <button onClick={() => handleDeleteExpense(item.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      Nothing yet. Add some expenses to get the trail started.
                    </div>
                  )}
                </div>
              </SlideUp>
            </StaggerContainer>
          ) : null}

          {data.groups.length > 0 && section === "analytics" ? (
            <StaggerContainer key="analytics" className="grid gap-8 grid-cols-1 md:grid-cols-2 w-full">
              <SlideUp className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 min-h-[20rem]">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Spending by category</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    Where the money bleeds
                  </h2>
                </div>
                <PieChart items={activeGroup?.analytics.byCategory ?? []} currencyCode={currencyCode} rate={exchangeRate} />
              </SlideUp>

              <SlideUp className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 min-h-[20rem]" delay={0.1}>
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Monthly expenses</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    Burn rate over time
                  </h2>
                </div>
                <LineChart
                  points={
                    activeGroup?.analytics.monthly.length
                      ? activeGroup.analytics.monthly
                      : [{ label: "Now", amount: 0 }]
                  }
                  currencyCode={currencyCode}
                  rate={exchangeRate}
                />
              </SlideUp>

              <SlideUp className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 min-h-[20rem] col-span-2" delay={0.2}>
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Top spenders</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                    The big spenders
                  </h2>
                </div>
                <BarChart items={activeGroup?.analytics.topSpenders ?? []} currencyCode={currencyCode} rate={exchangeRate} />
              </SlideUp>
            </StaggerContainer>
          ) : null}

          {data.groups.length > 0 && (section === "dashboard" || section === "whiteboard") ? (
            <article className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 mt-10">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Wallet log</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">
                  Your money trail
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {data.walletTransactions.length ? (
                  data.walletTransactions.map((transaction) => (
                    <div className="flex items-center justify-between p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f6f6f6] transition-colors" key={transaction.id}>
                      <div>
                        <strong>{transaction.description || transaction.type.replaceAll("_", " ")}</strong>
                        <p className="text-xs text-gray-500">{new Date(transaction.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <strong className={transaction.amount >= 0 ? "text-green-500" : "text-red-500"}>{transaction.amount >= 0 ? "+" : ""}{displayCurrency(transaction.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.5rem" }}>
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    Wallet is empty. Add some funds to get rolling.
                  </div>
                )}
              </div>
            </article>
          ) : null}

          {/* ── Templates Section ── */}
          {section === "templates" ? (
            <StaggerContainer key="templates" className="w-full">
              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Quick-add templates</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">Expense Templates</h2>
                  <p className="text-sm text-gray-500 mt-1">Apply a template to instantly fill the expense form.</p>
                </div>

                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 mb-6">
                  {allTemplates.map(t => (
                    <div
                      key={t.id}
                      className="relative group flex flex-col gap-2 p-4 rounded-xl border-2 border-black bg-white hover:bg-[#D4F670] hover:-translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                      onClick={() => {
                        setExpenseState(s => ({ ...s, description: t.description, amount: t.amount, category: t.category }));
                        setSection("dashboard");
                        showToast(`Template applied.`, "success");
                      }}
                    >
                      <span className="text-2xl leading-none">{t.label.split(" ")[0]}</span>
                      <div>
                        <strong className="text-sm text-black block">{t.label.replace(/^\S+\s/, "")}</strong>
                        <p className="text-xs text-gray-500">{formatCurrency(Number(t.amount), currencyCode, exchangeRate)}</p>
                      </div>
                      {t.id.startsWith("custom-") && (
                        <button
                          type="button"
                          className="absolute top-1 right-2 text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomTemplates(prev => prev.filter(c => c.id !== t.id));
                            showToast("Template deleted.", "info");
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <div className="space-y-3 mt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Create custom template</p>
                  <div className="field">
                    <label className="label">Template name</label>
                    <input
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Team Pizza"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label">Amount</label>
                      <input
                        inputMode="decimal"
                        value={newTemplateAmount}
                        onChange={e => setNewTemplateAmount(e.target.value)}
                        placeholder="500"
                        className="input"
                      />
                    </div>
                    <div className="field">
                      <label className="label">Category</label>
                      <select
                        value={newTemplateCategory}
                        onChange={e => setNewTemplateCategory(e.target.value as ExpenseCategory)}
                        className="input select"
                      >
                        {categoryOptions.map(c => (
                          <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex justify-center items-center gap-2 w-full py-3 px-4 bg-black text-white font-bold text-lg rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] hover:text-black hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                    disabled={!newTemplateName.trim() || !newTemplateAmount}
                    onClick={() => {
                      if (!newTemplateName.trim() || !newTemplateAmount) return;
                      setCustomTemplates(prev => [...prev, {
                        id: `custom-${Date.now()}`,
                        label: newTemplateName.trim(),
                        description: newTemplateName.replace(/^\S+\s/, "").trim() || newTemplateName.trim(),
                        amount: newTemplateAmount,
                        category: newTemplateCategory,
                      }]);
                      setNewTemplateName("");
                      setNewTemplateAmount("");
                      setNewTemplateCategory(ExpenseCategory.OTHER);
                      showToast("Custom template saved!", "success");
                    }}
                  >
                    Save Template
                  </button>
                </div>
              </SlideUp>
            </StaggerContainer>
          ) : null}

          {/* ── Whiteboard Section ── */}
          {data.groups.length > 0 && section === "whiteboard" ? (
            <StaggerContainer key="whiteboard" className="w-full">
              <SlideUp className="bg-[#fdfdf9] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-5">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Whiteboard</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-black">Group Notes</h2>
                </div>

                {/* Invite link sharing */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Share invite</p>
                  <div className="invite-share-row">
                    <input readOnly value={inviteLink} placeholder="Generate an invite link..." />
                    <button className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2" onClick={handleGenerateInvite} disabled={pending} type="button">
                      {inviteLink ? "Regenerate" : "Generate"}
                    </button>
                  </div>
                  {inviteLink && (
                    <div className="mt-3 flex items-center gap-4">
                      <div
                        className="bg-white p-2 rounded-lg shadow border border-black cursor-pointer hover:shadow-md transition-shadow shrink-0"
                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                        title="Click to copy link"
                      >
                        <Image
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(inviteLink)}`}
                          alt="Invite QR Code"
                          className="block h-[90px] w-[90px]"
                          height={90}
                          unoptimized
                          width={90}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 break-all leading-relaxed">{inviteLink}</p>
                        <button type="button" className="mt-2 text-xs text-[#65a30d] hover:underline" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="divider" />

                {/* Budget settings */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#93c713] mb-3 relative inline-block">Monthly budget</p>
                  <div className="invite-share-row">
                    <input inputMode="decimal" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 10000" />
                    <button className="flex bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center gap-2 px-4 py-2" onClick={handleSetBudget} disabled={pending} type="button">
                      Set limit
                    </button>
                  </div>
                </div>

                <div className="divider" />

                {/* Add note */}
                <div className="flex gap-3 items-start">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write a note for your group..."
                    className="w-full min-h-[48px] max-h-32 bg-white border-2 border-black rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F670] resize-y shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <button className="flex shrink-0 bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] items-center px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddNote} disabled={pending || !noteText.trim()} type="button">
                    Post
                  </button>
                </div>

                {/* Notes list */}
                <div className="grid gap-4 mt-6">
                  {notes.length === 0 ? (
                    <div className="text-gray-400 italic py-8 text-center border-2 border-dashed border-gray-300 rounded-xl w-full">No notes yet. Be the first to post!</div>
                  ) : (
                    notes.map((note) => (
                      <div className="bg-[#fdfdf9] border-2 border-black rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 relative group transition-transform hover:-translate-y-1" key={note.id}>
                        <div className="flex justify-between items-start w-full pr-12">
                          <span className="font-bold text-black flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#D4F670] border-2 border-black flex items-center justify-center text-[10px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-black">
                              {groupInitials(members.find((m) => m.id === note.authorId)?.name ?? "Unknown")}
                            </span>
                            {members.find((m) => m.id === note.authorId)?.name ?? "Unknown"}
                          </span>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{formatDate(note.createdAt)}</span>
                        </div>
                        <div className="text-black text-sm leading-relaxed mt-1">{note.content}</div>
                        {note.authorId === data.userId && (
                          <button className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700 hover:underline opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteNote(note.id)} type="button">
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SlideUp>
            </StaggerContainer>
          ) : null}
        </AnimatePresence>

        {/* ── AI Chatbot FAB + Drawer ── */}
        {data.groups.length > 0 && (
          <>
            <motion.button
              className="fixed bottom-[90px] lg:bottom-6 right-6 w-14 h-14 bg-[#D4F670] border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black z-50 hover:bg-[#b5d54a] transition-colors"
              onClick={() => setChatOpen(!chatOpen)}
              type="button"
              aria-label="AI Chat"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.5 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </motion.button>

            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  className="fixed bottom-[160px] lg:bottom-24 right-6 w-[340px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[60vh] lg:max-h-[70vh] bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col z-50 overflow-hidden"
                  initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 20, scale: 0.96, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                >
                  <div className="p-4 bg-[#D4F670] border-b-2 border-black flex justify-between items-center">
                    <h3 className="font-black text-lg text-black">Pay Zen AI</h3>
                    <button className="text-2xl font-black text-black hover:opacity-70 leading-none" onClick={() => setChatOpen(false)} type="button">&times;</button>
                  </div>
                  <div className="flex gap-2 p-3 border-b-2 border-black bg-[#fdfdf9] overflow-x-auto hide-scrollbars whitespace-nowrap scroll-smooth">
                    <button onClick={() => handleChat("Analyze my spending")} type="button" className="px-3 py-1.5 text-xs font-bold bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors">Analyze spending</button>
                    <button onClick={() => handleChat("How can I save money?")} type="button" className="px-3 py-1.5 text-xs font-bold bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#D4F670] transition-colors">How to save?</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#fdfdf9]">
                    {chatMessages.length === 0 && (
                      <div className="p-3 text-sm rounded-xl border-2 border-black max-w-[85%] bg-white rounded-tl-none self-start shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black leading-relaxed">Hi! I&apos;m your Pay Zen financial advisor. Ask me about your spending patterns, savings strategies, or budget insights.</div>
                    )}
                    <AnimatePresence initial={false}>
                      {chatMessages.map((msg, i) => (
                        <motion.div
                          key={i}
                          className={`p-3 text-sm rounded-xl border-2 border-black max-w-[85%] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] leading-relaxed ${msg.role === "user" ? "bg-[#D4F670] rounded-tr-none self-end text-black font-medium" : "bg-white rounded-tl-none self-start text-black"}`}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        >
                          {msg.text}
                        </motion.div>
                      ))}
                      {chatPending && (
                        <motion.div
                          className="p-3 text-sm rounded-xl border-2 border-black max-w-[85%] bg-white rounded-tl-none self-start shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black flex items-center gap-2"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <span className="spinner" /> Thinking...
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 border-t-2 border-black bg-white flex gap-2 w-full">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleChat()}
                      placeholder="Ask about your finances..."
                      className="flex-1 bg-white border-2 border-black rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F670] text-black placeholder:text-gray-500 w-full min-w-0"
                    />
                    <button onClick={() => handleChat()} disabled={chatPending || !chatInput.trim()} type="button" className="px-4 py-2 bg-black text-white font-bold rounded-lg border-2 border-black hover:bg-[#D4F670] hover:text-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Send</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </section>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black z-50 flex items-center justify-around h-[70px] pb-safe px-2 overflow-x-auto hide-scrollbars">
        <AnimatePresence>
          {sections.map((item) => {
            const Icon = sectionIcons[item.key];
            const isActive = section === item.key;
            return (
              <button
                key={item.key}
                className={`relative flex-1 h-full flex flex-col items-center justify-center transition-colors ${isActive ? "text-black" : "text-gray-500 hover:text-black"}`}
                onClick={() => setSection(item.key)}
                type="button"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-x-2 top-2 bottom-2 -z-10 bg-[#D4F670] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Icon />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                </div>
              </button>
            );
          })}
        </AnimatePresence>
      </nav>
    </div>
  );
}
