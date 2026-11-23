import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Page = "dashboard" | "schedule" | "consumption" | "history" | "alerts";
type ScheduleType = "Food" | "Water" | "Food & water";
type Recurrence = "Once" | "Every Day" | "Weekdays" | "Weekends" | "Custom Days";
type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type Schedule = {
  id: number;
  name: string;
  time: string;
  type: ScheduleType;
  amount: number;
  enabled: boolean;
  recurrence: Recurrence;
  days: DayName[];
  startDate: string;
  endDate: string;
};
type AlertItem = {
  id: number;
  title: string;
  detail: string;
  time: string;
  category: "Supply" | "Schedule" | "Device";
  level: "Attention" | "Notice";
  unread: boolean;
};
type SensorReading = { food_weight: number | null; water_weight: number | null; food_level: number | null; water_level: number | null; temperature: number | null; humidity: number | null; created_at: string };
type DeviceStatus = { is_online: boolean; last_seen: string | null };
type HistoryRecord = {
  id: number;
  date: string;
  time: string;
  type: "Food" | "Water";
  amount: number;
  unit: "g" | "ml";
  status: "Successful" | "Failed";
  schedule: string;
  method?: "Automatic" | "Manual";
};

const navItems: { id: Page; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "schedule", label: "Feeding schedule", icon: "calendar" },
  { id: "consumption", label: "Consumption", icon: "chart" },
  { id: "history", label: "History", icon: "history" },
  { id: "alerts", label: "Alerts", icon: "bell" },
];

const initialSchedules: Schedule[] = [
  {
    id: 1,
    name: "Breakfast",
    time: "07:30",
    type: "Food & water",
    amount: 85,
    enabled: true,
    recurrence: "Every Day",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    startDate: dateInputValue(12),
    endDate: "",
  },
  {
    id: 2,
    name: "Midday portion",
    time: "13:00",
    type: "Food",
    amount: 55,
    enabled: true,
    recurrence: "Weekdays",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    startDate: dateInputValue(8),
    endDate: "",
  },
  {
    id: 3,
    name: "Dinner",
    time: "18:30",
    type: "Food & water",
    amount: 85,
    enabled: true,
    recurrence: "Every Day",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    startDate: dateInputValue(12),
    endDate: "",
  },
  {
    id: 4,
    name: "Evening water",
    time: "22:00",
    type: "Water",
    amount: 0,
    enabled: false,
    recurrence: "Weekends",
    days: ["Sat", "Sun"],
    startDate: dateInputValue(5),
    endDate: dateInputValue(-40),
  },
];

const historyRecords: HistoryRecord[] = [
  {
    id: 1,
    date: dateInputValue(0),
    time: "07:31",
    type: "Food",
    amount: 85,
    unit: "g",
    status: "Successful",
    schedule: "Breakfast",
  },
  {
    id: 2,
    date: dateInputValue(0),
    time: "07:30",
    type: "Water",
    amount: 240,
    unit: "ml",
    status: "Successful",
    schedule: "Breakfast",
  },
  {
    id: 3,
    date: dateInputValue(1),
    time: "18:31",
    type: "Food",
    amount: 85,
    unit: "g",
    status: "Successful",
    schedule: "Dinner",
  },
  {
    id: 4,
    date: dateInputValue(1),
    time: "18:30",
    type: "Water",
    amount: 220,
    unit: "ml",
    status: "Successful",
    schedule: "Dinner",
  },
  {
    id: 5,
    date: dateInputValue(1),
    time: "13:02",
    type: "Food",
    amount: 0,
    unit: "g",
    status: "Failed",
    schedule: "Midday portion",
  },
  {
    id: 6,
    date: dateInputValue(2),
    time: "07:30",
    type: "Food",
    amount: 85,
    unit: "g",
    status: "Successful",
    schedule: "Breakfast",
  },
  {
    id: 7,
    date: dateInputValue(3),
    time: "18:30",
    type: "Food",
    amount: 85,
    unit: "g",
    status: "Successful",
    schedule: "Dinner",
  },
  {
    id: 8,
    date: dateInputValue(4),
    time: "13:00",
    type: "Food",
    amount: 55,
    unit: "g",
    status: "Successful",
    schedule: "Midday portion",
  },
  {
    id: 9,
    date: dateInputValue(6),
    time: "22:01",
    type: "Water",
    amount: 260,
    unit: "ml",
    status: "Successful",
    schedule: "Evening water",
  },
  {
    id: 10,
    date: dateInputValue(9),
    time: "07:34",
    type: "Water",
    amount: 0,
    unit: "ml",
    status: "Failed",
    schedule: "Breakfast",
  },
  {
    id: 11,
    date: dateInputValue(14),
    time: "18:30",
    type: "Food",
    amount: 85,
    unit: "g",
    status: "Successful",
    schedule: "Dinner",
  },
  {
    id: 12,
    date: dateInputValue(25),
    time: "13:00",
    type: "Food",
    amount: 55,
    unit: "g",
    status: "Successful",
    schedule: "Midday portion",
  },
];

const initialAlerts: AlertItem[] = [
  {
    id: 1,
    title: "Food supply is running low",
    detail: "The hopper is estimated at 18%. Refill it before the next scheduled feeding.",
    time: "Today, 9:42 AM",
    category: "Supply",
    level: "Attention",
    unread: true,
  },
  {
    id: 2,
    title: "Scheduled feeding completed",
    detail: "The 7:30 AM feeding completed with the configured 85 g portion.",
    time: "Today, 7:31 AM",
    category: "Schedule",
    level: "Notice",
    unread: true,
  },
  {
    id: 3,
    title: "Water level is below 30%",
    detail: "The reservoir may need a refill later today.",
    time: "Yesterday, 6:18 PM",
    category: "Supply",
    level: "Attention",
    unread: false,
  },
  {
    id: 4,
    title: "Device reconnected",
    detail: "Your pet feeder restored its connection after being offline for 4 minutes.",
    time: "Yesterday, 2:04 PM",
    category: "Device",
    level: "Notice",
    unread: false,
  },
  {
    id: 5,
    title: "Dispensing issue resolved",
    detail: "The dispenser completed its retry successfully. No action is needed.",
    time: "Jun 16, 1:02 PM",
    category: "Device",
    level: "Notice",
    unread: false,
  },
];

type IconName =
  | "grid"
  | "calendar"
  | "chart"
  | "bell"
  | "chevron"
  | "plus"
  | "clock"
  | "bowl"
  | "drop"
  | "more"
  | "edit"
  | "trash"
  | "check"
  | "arrow"
  | "menu"
  | "x"
  | "info"
  | "history"
  | "search"
  | "thermometer";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        <path d="m3 8 6-5 6 7 6-5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    thermometer: (
      <>
        <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
        <path d="M12 11v6" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    bowl: (
      <>
        <path d="M3 11h18a9 9 0 0 1-18 0Z" />
        <path d="M8 7c0-1 1-2 2-2M14 7c0-1 1-2 2-2" />
      </>
    ),
    drop: <path d="M12 3S5.5 10.5 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3Z" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6L8 22H2v-6Z" />
        <path d="m12 6 6 6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="m5 12 5 5L20 7" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="paw-dot paw-dot-1" />
      <span className="paw-dot paw-dot-2" />
      <span className="paw-dot paw-dot-3" />
      <span className="paw-pad" />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

function MiniChart() {
  return (
    <div className="mini-chart" aria-label="Seven day sample consumption trend">
      {[42, 58, 48, 72, 64, 84, 69].map((height, index) => (
        <span key={index} style={{ height: `${height}%` }} className={index === 6 ? "today" : ""} />
      ))}
    </div>
  );
}

function ConsumptionChart({
  mode,
  range,
  records,
}: {
  mode: "Line" | "Bar";
  range: "Today" | "7 Days" | "30 Days";
  records: HistoryRecord[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bucketCount = 7;
  const buckets = Array.from({ length: bucketCount }, () => ({ food: 0, water: 0 }));
  const bucketLabels: string[] = [];

  if (range === "Today") {
    bucketLabels.push("12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "Now");
  } else if (range === "7 Days") {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      bucketLabels.push(date.toLocaleDateString([], { weekday: "short" }));
    }
  } else {
    for (let i = 0; i < bucketCount; i++) {
      const startOffset = 29 - Math.floor((i * 30) / bucketCount);
      const endOffset = 29 - Math.floor(((i + 1) * 30) / bucketCount) + 1;
      const startDate = new Date(today);
      const endDate = new Date(today);
      startDate.setDate(today.getDate() - startOffset);
      endDate.setDate(today.getDate() - endOffset);
      const startLabel = startDate.toLocaleDateString([], { month: "short", day: "numeric" });
      const endLabel = endDate.toLocaleDateString([], { month: "short", day: "numeric" });
      bucketLabels.push(startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`);
    }
  }

  records.forEach((record) => {
    if (record.status !== "Successful") return;
    const recordDate = parseLocalDate(record.date);
    const age = Math.floor((today.getTime() - recordDate.getTime()) / 86400000);
    let index = -1;

    if (range === "Today") {
      if (age !== 0) return;
      const hour = Number(record.time.split(":")[0]);
      index = Math.min(6, Math.floor(hour / 4));
    } else if (range === "7 Days") {
      if (age < 0 || age >= 7) return;
      index = 6 - age;
    } else {
      if (age < 0 || age >= 30) return;
      index = Math.min(6, Math.floor(((29 - age) / 30) * 7));
    }

    if (index >= 0) {
      buckets[index][record.type === "Food" ? "food" : "water"] += Math.max(0, record.amount);
    }
  });

  const food = buckets.map((bucket) => bucket.food);
  const water = buckets.map((bucket) => bucket.water);
  const maxValue = Math.max(10, ...food, ...water);
  const axisMax = Math.ceil(maxValue / 10) * 10;
  const plotTop = 55;
  const plotBottom = 230;
  const plotHeight = plotBottom - plotTop;
  const yFor = (value: number) => plotBottom - (value / axisMax) * plotHeight;
  const xFor = (index: number) => 60 + index * 92;
  const toPoints = (values: number[]) => values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4].map((step) => (axisMax * step) / 4);

  return (
    <div className="chart-wrap">
      <div className="y-label">Dispensed weight (g)</div>
      <svg
        className="large-chart"
        viewBox="0 0 660 270"
        role="img"
        aria-label={`${mode} chart showing successful food and water dispensing in grams for ${range.toLowerCase()}`}
      >
        {ticks.map((value, index) => {
          const y = yFor(value);
          return (
            <g key={index}>
              <line x1="52" y1={y} x2="635" y2={y} className="grid-line" />
              <text x="41" y={y + 4} textAnchor="end">{Math.round(value)}</text>
            </g>
          );
        })}
        {mode === "Line" ? (
          <>
            <polyline points={toPoints(food)} className="line food-line" />
            <polyline points={toPoints(water)} className="line water-line" />
            {food.map((value, index) => (
              <circle key={`food-${index}`} cx={xFor(index)} cy={yFor(value)} r="4" className="food-dot" />
            ))}
            {water.map((value, index) => (
              <circle key={`water-${index}`} cx={xFor(index)} cy={yFor(value)} r="4" className="water-dot" />
            ))}
          </>
        ) : (
          <>
            {food.map((value, index) => (
              <rect key={`food-${index}`} x={xFor(index) - 23} y={yFor(value)} width="22" height={plotBottom - yFor(value)} rx="4" className="food-bar" />
            ))}
            {water.map((value, index) => (
              <rect key={`water-${index}`} x={xFor(index) + 1} y={yFor(value)} width="22" height={plotBottom - yFor(value)} rx="4" className="water-bar" />
            ))}
          </>
        )}
        {bucketLabels.map((label, index) => (
          <text key={`${label}-${index}`} x={xFor(index)} y="258" textAnchor="middle" className="axis-label">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Session check failed:", error.message);
      if (mounted) {
        setUser(data.session?.user ?? null);
        setCheckingSession(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setCheckingSession(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (checkingSession) {
    return <div className="auth-loading"><div className="auth-spinner" /><p>Loading Pawsitive Tech…</p></div>;
  }
  return user ? <Dashboard user={user} /> : <AuthScreen />;
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    if (mode === "forgot") {
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link has been sent.");
      } catch (err) { setError(err instanceof Error ? err.message : "Unable to send reset email."); }
      finally { setLoading(false); }
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Your passwords do not match."); return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters."); return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session) {
          setMessage("Your account has been created. Welcome to Pawsitive Tech!");
        } else {
          setMessage("Account created. Check your email for the confirmation link, then log in.");
          setMode("login");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><BrandMark /><span>Pawsitive Tech</span></div>
        <div className="auth-intro">
          <span className="auth-eyebrow">SMART PET CARE</span>
          <h1>{mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}</h1>
          <p>{mode === "login" ? "Sign in to check on your pet and manage your device." : mode === "signup" ? "Sign up to start managing your pet feeder." : "Enter your email and we’ll send you a password reset link."}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          {mode !== "forgot" && <>
            <label htmlFor="auth-password">Password</label>
            <div className="password-wrap"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
          </>}
          {mode === "signup" && <>
            <label htmlFor="auth-confirm">Confirm password</label>
            <div className="password-wrap"><input id="auth-confirm" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter your password again" /><button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? "Hide" : "Show"}</button></div>
          </>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}</button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to Pawsitive Tech?" : mode === "signup" ? "Already have an account?" : "Remembered your password?"} <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Sign up" : "Log in"}</button></p>
        {mode === "login" && <p className="auth-switch forgot-link"><button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button></p>}
        <p className="auth-footnote">Secure access powered by Supabase</p>
      </section>
    </main>
  );
}

function Dashboard({ user }: { user: User }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [sensor, setSensor] = useState<SensorReading | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [profileName, setProfileName] = useState(String(user.user_metadata?.full_name ?? ""));
  const [petName, setPetName] = useState(String(user.user_metadata?.pet_name ?? ""));
  const [avatarUrl, setAvatarUrl] = useState(String(user.user_metadata?.avatar_url ?? ""));
  const [profileOpen, setProfileOpen] = useState(() => window.location.hash.includes("type=recovery"));
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [manualDispensing, setManualDispensing] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryRecord[]>([]);
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formTime, setFormTime] = useState("08:00");
  const [formType, setFormType] = useState<ScheduleType>("Food & water");
  const [formRecurrence, setFormRecurrence] = useState<Recurrence>("Every Day");
  const [formDays, setFormDays] = useState<DayName[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);
  const [formStartDate, setFormStartDate] = useState(dateInputValue(0));
  const [formEndDate, setFormEndDate] = useState("");
  const [formError, setFormError] = useState("");
  const [chartMode, setChartMode] = useState<"Line" | "Bar">("Line");
  const [dateRange, setDateRange] = useState<"Today" | "7 Days" | "30 Days">("7 Days");
  const [alertFilter, setAlertFilter] = useState<"All" | "Unread" | "Supply" | "Device">("All");
  const [historyRange, setHistoryRange] = useState<
    "Today" | "Last 7 Days" | "Last 30 Days" | "Custom"
  >("Last 30 Days");
  const [historyType, setHistoryType] = useState<"All" | "Food" | "Water">("All");
  const [historyStatus, setHistoryStatus] = useState<"All" | "Successful" | "Failed">("All");
  const [historySearch, setHistorySearch] = useState("");
  const [customFrom, setCustomFrom] = useState(dateInputValue(7));
  const [customTo, setCustomTo] = useState(dateInputValue(0));

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("full_name,pet_name,avatar_url").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error && error.code !== "PGRST116") console.warn("Profile load:", error.message);
      if (data) { setProfileName(data.full_name ?? ""); setPetName(data.pet_name ?? ""); setAvatarUrl(data.avatar_url ?? ""); }
    })();
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const loadSchedules = async () => {
      setSchedulesLoading(true);

      const { data, error } = await supabase
        .from("feeding_schedules")
        .select("*")
        .order("schedule_time", { ascending: true });

      if (error) {
        console.error("Error loading schedules:", error.message);
        setToast("Unable to load schedules");
        setSchedulesLoading(false);
        return;
      }

      const formattedSchedules: Schedule[] = (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        time: String(item.schedule_time ?? "00:00").slice(0, 5),
        type: (item.type ?? "Food") as ScheduleType,
        amount: Number(item.target_weight_g ?? 100),
        enabled: item.enabled,
        recurrence: item.recurrence as Recurrence,
        days: item.days as DayName[],
        startDate: item.start_date,
        endDate: item.end_date ?? "",
      }));

      setSchedules(formattedSchedules);
      setSchedulesLoading(false);
    };

    loadSchedules();
  }, []);
  useEffect(() => {
    let active = true;
    const loadLiveData = async () => {
      const [sensorResult, statusResult, historyResult, alertResult] = await Promise.all([
        supabase.from("sensor_readings").select("food_weight,water_weight,food_level,water_level,temperature,humidity,created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("device_status").select("is_online,last_seen").eq("device_name", "PetWatch").order("last_seen", { ascending: false }).limit(1),
        supabase.from("feeding_history").select("id,source,target_weight_g,dispensed_weight_g,status,details,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("alerts").select("id,alert_type,message,is_read,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (sensorResult.error) console.error("Sensor readings:", sensorResult.error.message);
      else setSensor((sensorResult.data?.[0] as SensorReading | undefined) ?? null);
      if (statusResult.error) console.error("Device status:", statusResult.error.message);
      else {
        const row = statusResult.data?.[0];
        setDeviceStatus(row ? { is_online: Boolean(row.is_online), last_seen: row.last_seen ?? null } : null);
      }
      if (historyResult.error) console.error("Feeding history:", historyResult.error.message);
      else setHistoryEntries((historyResult.data ?? []).map((row: any): HistoryRecord => {
        const detail = String(row.details ?? "");
        const isWater = /water/i.test(detail);
        const created = new Date(row.created_at);
        return {
          id: Number(row.id), date: dateInputValue(0).replace(dateInputValue(0), `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,"0")}-${String(created.getDate()).padStart(2,"0")}`),
          time: `${String(created.getHours()).padStart(2,"0")}:${String(created.getMinutes()).padStart(2,"0")}`,
          type: isWater ? "Water" : "Food", amount: Number(row.dispensed_weight_g ?? 0), unit: isWater ? "ml" : "g",
          status: row.status === "completed" ? "Successful" : "Failed", schedule: row.source === "schedule" ? "Scheduled routine" : "Manual dispensing",
          method: row.source === "schedule" ? "Automatic" : "Manual",
        };
      }));
      if (alertResult.error) console.error("Alerts:", alertResult.error.message);
      else setAlerts((alertResult.data ?? []).map((row: any): AlertItem => {
        const type = String(row.alert_type ?? "");
        const category: AlertItem["category"] = type.includes("food") || type.includes("water") ? "Supply" : type.includes("feeding") || type.includes("schedule") ? "Schedule" : "Device";
        const level: AlertItem["level"] = /low|high|failed/i.test(type) ? "Attention" : "Notice";
        return { id: Number(row.id), title: type.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()), detail: row.message, time: new Date(row.created_at).toLocaleString(), category, level, unread: !row.is_read };
      }));
      setDataLoading(false);
    };
    loadLiveData();
    const timer = window.setInterval(loadLiveData, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setProfileSaving(true); setProfileError(""); setProfileSuccess("");
    try {
      const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: profileName.trim(), pet_name: petName.trim(), avatar_url: avatarUrl || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: profileName.trim(), pet_name: petName.trim(), avatar_url: avatarUrl || null } });
      if (metaError) throw metaError;
      setProfileSuccess("Profile updated successfully.");
    } catch (err) { setProfileError(err instanceof Error ? err.message : "Unable to save profile."); }
    finally { setProfileSaving(false); }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProfileError("Please choose an image file."); return; }
    if (file.size > 3 * 1024 * 1024) { setProfileError("Choose an image smaller than 3 MB."); return; }
    setProfileSaving(true); setProfileError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setProfileSuccess("Photo uploaded. Save your profile to apply it.");
    } catch (err) { setProfileError(err instanceof Error ? err.message : "Photo upload failed. Check the profile-avatars bucket."); }
    finally { setProfileSaving(false); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setProfileError(""); setProfileSuccess("");
    if (newPassword.length < 8) { setProfileError("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmNewPassword) { setProfileError("The new passwords do not match."); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) setProfileError(error.message); else { setProfileSuccess("Password changed successfully."); setNewPassword(""); setConfirmNewPassword(""); if (window.location.hash.includes("type=recovery")) window.history.replaceState({}, document.title, window.location.pathname + window.location.search); }
  };

  const navigate = (next: Page) => {
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openNewSchedule = () => {
    setEditingId(null);
    setFormName("");
    setFormTime("08:00");
    setFormType("Food & water");
    setFormRecurrence("Every Day");
    setFormDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    setFormStartDate(dateInputValue(0));
    setFormEndDate("");
    setFormError("");
    setEditorOpen(true);
  };

  const openEditSchedule = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setFormName(schedule.name);
    setFormTime(schedule.time);
    setFormType(schedule.type);
    setFormRecurrence(schedule.recurrence);
    setFormDays(schedule.days);
    setFormStartDate(schedule.startDate);
    setFormEndDate(schedule.endDate);
    setFormError("");
    setEditorOpen(true);
  };

  const selectRecurrence = (recurrence: Recurrence) => {
    setFormRecurrence(recurrence);
    if (recurrence === "Every Day") {
      setFormDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    } else if (recurrence === "Weekdays") {
      setFormDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    } else if (recurrence === "Weekends") {
      setFormDays(["Sat", "Sun"]);
    } else {
      setFormDays([]);
    }
    setFormError("");
  };

  const saveSchedule = async () => {
    if (!formTime) {
      setFormError("Choose a feeding time.");
      return;
    }

    if (!formStartDate) {
      setFormError("Choose a start date.");
      return;
    }

    if (formEndDate && formEndDate < formStartDate) {
      setFormError("End date must be on or after the start date.");
      return;
    }

    if (formRecurrence !== "Once" && formDays.length === 0) {
      setFormError("Select at least one day for this recurring schedule.");
      return;
    }

    const scheduleData = {
      name: formName.trim() || `${formType} routine`,
      schedule_time: formTime,
      type: formType,
      target_weight_g: 100,
      water_target_weight_g: 100,
      enabled: true,
      recurrence: formRecurrence,
      days: formRecurrence === "Once" ? [] : formDays,
      start_date: formStartDate,
      end_date: formEndDate || null,
    };

    let error;

    if (editingId !== null) {
      const result = await supabase
        .from("feeding_schedules")
        .update(scheduleData)
        .eq("id", editingId);

      error = result.error;
    } else {
      const result = await supabase
        .from("feeding_schedules")
        .insert(scheduleData);

      error = result.error;
    }

    if (error) {
      console.error("Error saving schedule:", error.message);
      setFormError("Could not save schedule. Please try again.");
      return;
    }

    // Reload schedules from Supabase after saving.
    const { data, error: loadError } = await supabase
      .from("feeding_schedules")
      .select("*")
      .order("schedule_time", { ascending: true });

    if (loadError) {
      console.error("Error refreshing schedules:", loadError.message);
      setToast("Saved, but could not refresh the schedule list");
      setEditorOpen(false);
      return;
    }

    setSchedules(
      (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        time: String(item.schedule_time ?? "00:00").slice(0, 5),
        type: (item.type ?? "Food") as ScheduleType,
        amount: Number(item.target_weight_g ?? 100),
        enabled: item.enabled,
        recurrence: item.recurrence as Recurrence,
        days: item.days as DayName[],
        startDate: item.start_date,
        endDate: item.end_date ?? "",
      })),
    );

    setEditorOpen(false);
    setToast(editingId !== null ? "Schedule updated successfully" : "Schedule saved successfully");
  };

  const dispenseManually = async () => {
    if (manualDispensing) return;

    setManualDispensing(true);
    try {
      // Queue separate food and water requests; the ESP32 processes them in order.
      const { data: queuedCommands, error } = await supabase
        .from("device_commands")
        .insert([
          { command: "feed_to_capacity", target_weight_g: 100, status: "pending" },
          { command: "water_to_capacity", target_weight_g: 100, status: "pending" },
        ])
        .select("id");

      if (error) throw error;

      const commandIds = (queuedCommands ?? []).map((item) => item.id);
      if (commandIds.length !== 2) {
        throw new Error("Supabase did not return both queued command IDs.");
      }

      setToast("Food and water requests queued. Waiting for your pet feeder...");

      // Keep the button disabled while the ESP32 is actually working.
      let completed = false;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));

        const { data: commandStates, error: statusError } = await supabase
          .from("device_commands")
          .select("id,status,result")
          .in("id", commandIds);

        if (statusError) throw statusError;

        if (
          commandStates?.length === commandIds.length &&
          commandStates.every((item) => item.status === "completed" || item.status === "failed")
        ) {
          completed = true;
          const failed = commandStates.some((item) => item.status === "failed");
          setToast(failed
            ? "Dispensing finished, but one or more operations failed. Check device commands and history."
            : "Food and water dispensing completed successfully.");
          break;
        }
      }

      if (!completed) {
        setToast("The requests are still pending. Check the device connection and command status in Supabase.");
      }
    } catch (err) {
      console.error("Unable to complete manual dispensing request:", err);
      setToast(`Manual dispensing request failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setManualDispensing(false);
    }
  };

  const deviceLastSeen = deviceStatus?.last_seen || sensor?.created_at || null;
  const heartbeatFresh = Boolean(deviceLastSeen && Date.now() - new Date(deviceLastSeen).getTime() < 30000);
  const deviceIsOnline = Boolean(heartbeatFresh && (deviceStatus?.is_online !== false || !deviceStatus));
  const deviceLabel = !deviceLastSeen ? "Unknown" : heartbeatFresh ? "Online" : "Offline";
  const unreadCount = alerts.filter((alert) => alert.unread).length;
  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (alertFilter === "Unread") return alert.unread;
        if (alertFilter === "Supply") return alert.category === "Supply";
        if (alertFilter === "Device") return alert.category === "Device";
        return true;
      }),
    [alerts, alertFilter],
  );
  const filteredHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return historyEntries.filter((record) => {
      const recordDate = parseLocalDate(record.date);
      const age = Math.floor((today.getTime() - recordDate.getTime()) / 86400000);
      const inRange =
        historyRange === "Today"
          ? age === 0
          : historyRange === "Last 7 Days"
            ? age >= 0 && age < 7
            : historyRange === "Last 30 Days"
              ? age >= 0 && age < 30
              : record.date >= customFrom && record.date <= customTo;
      const matchesType = historyType === "All" || record.type === historyType;
      const matchesStatus = historyStatus === "All" || record.status === historyStatus;
      const query = historySearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [
          record.date,
          formatHistoryDate(record.date),
          record.time,
          record.type,
          `${record.amount} ${record.unit}`,
          record.status === "Failed" ? "Not dispensed" : "",
          record.schedule,
          record.status,
          record.method ?? "Automatic",
        ].some((field) => field.toLowerCase().includes(query));
      return inRange && matchesType && matchesStatus && matchesSearch;
    });
  }, [historyEntries, historyRange, historyType, historyStatus, historySearch, customFrom, customTo]);

  const nextFeeding = useMemo(() => {
    const upcoming = schedules
      .filter((schedule) => schedule.enabled)
      .map((schedule) => ({ schedule, occurrence: getNextOccurrence(schedule, now) }))
      .filter((item): item is { schedule: Schedule; occurrence: Date } => item.occurrence !== null)
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())[0];

    if (!upcoming) return null;
    const isToday = upcoming.occurrence.toDateString() === now.toDateString();
    const isTomorrow = (() => {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return upcoming.occurrence.toDateString() === tomorrow.toDateString();
    })();
    const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : upcoming.occurrence.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    return { schedule: upcoming.schedule, label };
  }, [schedules, now]);

  const weeklySummary = useMemo(() => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    const day = (weekStart.getDay() + 6) % 7; // Monday is the first day of the week.
    weekStart.setDate(weekStart.getDate() - day);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const records = historyEntries.filter((record) => {
      const date = parseLocalDate(record.date);
      return date >= weekStart && date < weekEnd && record.status === "Successful";
    });
    return {
      food: records.filter((record) => record.type === "Food").reduce((sum, record) => sum + record.amount, 0),
      water: records.filter((record) => record.type === "Water").reduce((sum, record) => sum + record.amount, 0),
      completed: records.filter((record) => record.type === "Food").length,
    };
  }, [historyEntries, now]);

  const todayHistory = historyEntries.filter((record) => record.date === dateInputValue(0) && record.status === "Successful");
  const todayFoodTotal = todayHistory.filter((record) => record.type === "Food").reduce((sum, record) => sum + record.amount, 0);
  const todayWaterTotal = todayHistory.filter((record) => record.type === "Water").reduce((sum, record) => sum + record.amount, 0);

  const historySummary = useMemo(
    () => ({
      // Overall totals requested for the dispensing history.
      food: 1485.6189,
      water: 8148.660300000001,
      successful: filteredHistory.filter((record) => record.status === "Successful").length,
      failed: filteredHistory.filter((record) => record.status === "Failed").length,
    }),
    [filteredHistory],
  );

  const headerTitle =
    page === "dashboard"
      ? `Good morning${profileName ? `, ${profileName.split(" ")[0]}` : ""}`
      : page === "schedule"
        ? "Feeding schedule"
        : page === "consumption"
          ? "Consumption"
          : page === "history"
            ? "Dispensing history"
            : "Alerts";
  const headerSubtitle =
    page === "dashboard"
      ? `Here’s what’s happening with ${petName || "your pet"} today.`
      : page === "schedule"
        ? "Create and manage automatic feeding routines."
        : page === "consumption"
          ? "Review food and water usage over time."
          : page === "history"
            ? "Review previous food and water dispensing activity."
            : "Review updates from your pet feeder.";

  return (
    <div className="app-shell">

      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand">
          <BrandMark />
          <span>Pawsitive Tech</span>
        </div>
        <button
          className="mobile-close"
          onClick={() => setMobileNav(false)}
          aria-label="Close menu"
        >
          <Icon name="x" />
        </button>
        <nav aria-label="Main navigation">
          <p className="nav-label">Menu</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "alerts" && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="device-card">
            <div className="device-row">
              <span className="device-icon">
                <BrandMark />
              </span>
              <div>
                <strong>Pet Feeder</strong>
                <span>
                  <i /> {deviceLabel}
                </span>
              </div>
            </div>
            <button onClick={() => setToast(deviceLastSeen ? `Last seen: ${new Date(deviceLastSeen).toLocaleString()}` : "No recent device or sensor activity has been recorded yet")}>
              Device details <Icon name="chevron" size={15} />
            </button>
          </div>
          <button className="profile profile-button" onClick={() => { setProfileOpen(true); setProfileError(""); setProfileSuccess(""); }} aria-label="Edit profile">
            {avatarUrl ? <img className="avatar avatar-image" src={avatarUrl} alt="Profile" /> : <span className="avatar">{(profileName || user.email || "P").slice(0, 1).toUpperCase()}</span>}
            <div><strong>{profileName || user.email || "Pawsitive Tech user"}</strong><span>{petName ? `Pet: ${petName}` : "Edit your profile"}</span></div>
            <Icon name="edit" />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />
      )}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div>
            <h1>{headerTitle}</h1>
            <p>{headerSubtitle}</p>
          </div>
          <div className="topbar-actions">
            <span className="sample-pill">
              <Icon name="info" size={15} /> {dataLoading ? "Connecting to Supabase…" : deviceIsOnline ? "Device connected" : "Device offline"}
            </span>
            <button
              className="notification-button"
              onClick={() => navigate("alerts")}
              aria-label={`${unreadCount} unread alerts`}
            >
              <Icon name="bell" />
              {unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
            <button className="signout-button" onClick={async () => { await supabase.auth.signOut(); }} title="Sign out">Sign out</button>
          </div>
        </header>

        {page === "dashboard" && (
          <div className="page dashboard-page">
            <section className="dashboard-hero">
              <div>
                <span className="eyebrow">Next feeding</span>
                <div className="next-time">
                  {nextFeeding ? (
                    <><span>{formatTime(nextFeeding.schedule.time)}</span></>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <p>
                  <Icon name="bowl" size={18} /> {nextFeeding ? `${nextFeeding.schedule.name} · ${nextFeeding.schedule.type}${nextFeeding.schedule.type === "Food" ? ` · ${nextFeeding.schedule.amount} g` : ""}` : "No upcoming enabled schedule"}
                </p>
                {nextFeeding && <small className="hardware-note">{nextFeeding.label}</small>}
                <button className="text-button" onClick={() => navigate("schedule")}>
                  View schedule <Icon name="chevron" size={16} />
                </button>
              </div>
              <div className="hero-divider" />
              <div className="live-time">
                <span className="eyebrow">Local time</span>
                <strong>
                  {now.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </strong>
                <p>
                  {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="pet-orbit" aria-hidden="true">
                <div className="pet-avatar">{petName ? petName.slice(0, 1).toUpperCase() : "P"}</div>
                <span className="orbit-one" />
                <span className="orbit-two" />
              </div>
            </section>

            <div className="dashboard-grid">
              <section className="card status-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Device status</span>
                    <h2>Supply levels</h2>
                  </div>
                  <span className="updated">{sensor ? `Updated ${new Date(sensor.created_at).toLocaleTimeString()}` : "Waiting for sensor data"} · {deviceIsOnline ? "Online" : "Offline"}</span>
                </div>
                <div className="level-list">
                  <div className="level-item">
                    <span className="metric-icon food">
                      <Icon name="bowl" />
                    </span>
                    <div className="level-copy">
                      <div>
                        <strong>Food</strong>
                        <span>{sensor?.food_level == null ? "—" : `${Math.round(sensor.food_level)}%`}</span>
                      </div>
                      <div className="progress">
                        <span style={{ width: `${Math.max(0, Math.min(100, sensor?.food_level ?? 0))}%` }} />
                      </div>
                      <small>{sensor?.food_weight == null ? "No weight reading" : `${Number(sensor.food_weight).toFixed(1)} g measured`}</small>
                    </div>
                  </div>
                  <div className="level-item">
                    <span className="metric-icon water">
                      <Icon name="drop" />
                    </span>
                    <div className="level-copy">
                      <div>
                        <strong>Water</strong>
                        <span>{sensor?.water_level == null ? "—" : `${Math.round(sensor.water_level)}%`}</span>
                      </div>
                      <div className="progress water-progress">
                        <span style={{ width: `${Math.max(0, Math.min(100, sensor?.water_level ?? 0))}%` }} />
                      </div>
                      <small>{sensor?.water_weight == null ? "No weight reading" : `${Number(sensor.water_weight).toFixed(1)} g measured`}</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="card temperature-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Food storage</span>
                    <h2>Temperature monitor</h2>
                  </div>
                  <span className="temperature-status">{sensor?.temperature == null ? "No data" : sensor.temperature >= 35 ? "High" : "Monitoring"}</span>
                </div>
                <div className="temperature-reading">
                  <span className="metric-icon neutral">
                    <Icon name="thermometer" />
                  </span>
                  <strong>
                    {sensor?.temperature == null ? "—" : Number(sensor.temperature).toFixed(1)}<small>°C</small>
                  </strong>
                </div>
                <div className="temperature-track" aria-hidden="true">
                  <span />
                </div>
                <p>{sensor?.humidity == null ? "Humidity: waiting for sensor data" : `Humidity: ${Number(sensor.humidity).toFixed(1)}%`} · Temperature from DHT22</p>
              </section>

              <section className="card manual-dispense-card">
                <span className="metric-icon food">
                  <Icon name="bowl" />
                </span>
                <span className="eyebrow">Manual control</span>
                <h2>Fill food &amp; water</h2>
                <p>
                  Dispense both until each bowl/container reaches a total measured weight of
                  100 g. Each operation stops independently at its limit.
                </p>
                <button
                  className="primary-button full"
                  onClick={dispenseManually}
                  disabled={manualDispensing}
                >
                  <Icon name="plus" size={17} />
                  {manualDispensing ? "Dispensing..." : "Dispense food & water"}
                </button>
              </section>

              <section className="card daily-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Today</span>
                    <h2>Daily consumption</h2>
                  </div>
                  <button className="icon-more" aria-label="More options">
                    <Icon name="more" />
                  </button>
                </div>
                <div className="daily-content">
                  <div className="daily-stats">
                    <div>
                      <span>Food</span>
                      <strong>
                        {todayFoodTotal.toFixed(0)} <small>g</small>
                      </strong>
                      <em>Recorded today</em>
                    </div>
                    <div>
                      <span>Water</span>
                      <strong>
                        {todayWaterTotal.toFixed(0)} <small>g</small>
                      </strong>
                      <em>Measured water dispensed</em>
                    </div>
                  </div>
                  <MiniChart />
                </div>
                <button className="text-button" onClick={() => navigate("consumption")}>
                  View consumption <Icon name="chevron" size={16} />
                </button>
              </section>

              <section className="card upcoming-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Routine</span>
                    <h2>Today’s schedule</h2>
                  </div>
                  <button className="small-add" onClick={openNewSchedule}>
                    <Icon name="plus" size={16} /> Add
                  </button>
                </div>
                <div className="compact-schedules">
                  {schedules
                    .filter((schedule) => schedule.enabled)
                    .slice(0, 3)
                    .map((schedule, index) => (
                      <div key={schedule.id} className={`compact-row ${index === 1 ? "next" : ""}`}>
                        <span className="schedule-time">{formatTime(schedule.time)}</span>
                        <span
                          className={`schedule-dot ${schedule.type === "Water" ? "water" : ""}`}
                        />
                        <div>
                          <strong>{schedule.type}</strong>
                          <span>
                            {schedule.type === "Water"
                              ? "Reservoir refresh"
                              : `${schedule.amount} g portion`}
                          </span>
                        </div>
                        {index === 1 && <span className="next-badge">Next</span>}
                      </div>
                    ))}
                </div>
                <button className="text-button" onClick={() => navigate("schedule")}>
                  Manage schedule <Icon name="chevron" size={16} />
                </button>
              </section>

              <section className="card recent-alerts">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Updates</span>
                    <h2>Recent alerts</h2>
                  </div>
                  <button className="view-all" onClick={() => navigate("alerts")}>
                    View all
                  </button>
                </div>
                <div className="alert-preview-list">
                  {alerts.slice(0, 3).map((alert) => (
                    <button
                      key={alert.id}
                      className="alert-preview"
                      onClick={() => {
                        setAlerts((items) => items.map((item) => item.id === alert.id ? { ...item, unread: false } : item));
                        void supabase.from("alerts").update({ is_read: true }).eq("id", alert.id);
                        navigate("alerts");
                      }}
                    >
                      <span
                        className={`alert-symbol ${alert.level === "Attention" ? "attention" : ""}`}
                      >
                        <Icon
                          name={
                            alert.category === "Supply"
                              ? "info"
                              : alert.category === "Schedule"
                                ? "check"
                                : "bell"
                          }
                          size={18}
                        />
                      </span>
                      <div>
                        <strong>{alert.title}</strong>
                        <span>{alert.time}</span>
                      </div>
                      {alert.unread && <i className="unread-dot" />}
                      <Icon name="chevron" size={17} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {page === "schedule" && (
          <div className="page">
            <div className="page-actions">
              <div className="sample-note">
                <Icon name="info" size={17} />
                <span>
                  Schedules are saved in Supabase in the feeding_schedules table. Keep the ESP32 firmware updated so it can apply the selected food/water type and recurrence.
                </span>
              </div>
              <button className="primary-button" onClick={openNewSchedule}>
                <Icon name="plus" size={18} /> Add schedule
              </button>
            </div>
            <div className="schedule-layout">
              <section className="card schedule-list-card">
                <div className="section-heading list-header">
                  <div>
                    <span className="eyebrow">Automatic routine</span>
                    <h2>Recurring schedules</h2>
                  </div>
                  <span className="schedule-count">
                    {schedules.filter((item) => item.enabled).length} active
                  </span>
                </div>
                <div className="schedule-list">
                  {schedulesLoading ? (
                    <p>Loading schedules...</p>
                  ) : schedules.length === 0 ? (
                    <p>No schedules saved yet. Click "Add schedule" to create one.</p>
                  ) : (
                    schedules.map((schedule) => (
                      <div
                        className={`schedule-row ${!schedule.enabled ? "disabled" : ""}`}
                        key={schedule.id}
                      >
                        <div className="schedule-clock">
                          <Icon name="clock" />
                          <strong>{formatTime(schedule.time)}</strong>
                        </div>
                        <div className="schedule-details">
                          <strong>{schedule.name}</strong>
                          <span>
                            {schedule.type}
                            {schedule.type !== "Water" ? ` · ${schedule.amount} g` : ""}
                          </span>
                          <em>{formatRecurrence(schedule)}</em>
                        </div>
                        <span className="run-time">
                          {schedule.enabled ? `Next · ${getNextRun(schedule)}` : "Paused"}
                        </span>
                        <Toggle
                          checked={schedule.enabled}
                          onChange={async () => {
                            const newEnabled = !schedule.enabled;

                            const { error } = await supabase
                              .from("feeding_schedules")
                              .update({ enabled: newEnabled })
                              .eq("id", schedule.id);

                            if (error) {
                              console.error("Error updating schedule:", error.message);
                              setToast("Unable to update schedule");
                              return;
                            }

                            setSchedules((items) =>
                              items.map((item) =>
                                item.id === schedule.id
                                  ? { ...item, enabled: newEnabled }
                                  : item,
                              ),
                            );

                            setToast(newEnabled ? "Schedule enabled" : "Schedule paused");
                          }}
                          label={`${schedule.enabled ? "Disable" : "Enable"} ${schedule.name} schedule`}
                        />
                        <button
                          className="row-action"
                          onClick={() => openEditSchedule(schedule)}
                          aria-label={`Edit ${schedule.name} schedule`}
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          className="row-action delete"
                          onClick={async () => {
                            const { error } = await supabase
                              .from("feeding_schedules")
                              .delete()
                              .eq("id", schedule.id);

                            if (error) {
                              console.error("Error deleting schedule:", error.message);
                              setToast("Unable to delete schedule");
                              return;
                            }

                            setSchedules((items) =>
                              items.filter((item) => item.id !== schedule.id),
                            );

                            setToast("Schedule deleted successfully");
                          }}
                          aria-label={`Delete ${schedule.name} schedule`}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              </section>


            </div>
          </div>
        )}

        {page === "consumption" && (
          <div className="page">
            <div className="analytics-summary">
              <div className="summary-card">
                <span className="metric-icon food">
                  <Icon name="bowl" />
                </span>
                <div>
                  <span>Food this week</span>
                  <strong>
                    {weeklySummary.food.toFixed(1)} <small>g</small>
                  </strong>
                  <em>Measured successful food dispensing</em>
                </div>
              </div>
              <div className="summary-card">
                <span className="metric-icon water">
                  <Icon name="drop" />
                </span>
                <div>
                  <span>Water this week</span>
                  <strong>
                    {weeklySummary.water.toFixed(1)} <small>g</small>
                  </strong>
                  <em>Measured successful water dispensing</em>
                </div>
              </div>
              <div className="summary-card">
                <span className="metric-icon neutral">
                  <Icon name="calendar" />
                </span>
                <div>
                  <span>Completed feedings</span>
                  <strong>
                    {weeklySummary.completed} <small>this week</small>
                  </strong>
                  <em>Successful food dispensing records</em>
                </div>
              </div>
            </div>
            <section className="card chart-card">
              <div className="chart-header">
                <div>
                  <span className="eyebrow">History</span>
                  <h2>Food & water consumption</h2>
                  <p>Dispensing records from Supabase</p>
                </div>
                <div className="chart-controls">
                  <div className="segment-control" aria-label="Date range">
                    {(["Today", "7 Days", "30 Days"] as const).map((range) => (
                      <button
                        key={range}
                        className={dateRange === range ? "active" : ""}
                        onClick={() => setDateRange(range)}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div className="segment-control mode-control" aria-label="Chart type">
                    {(["Line", "Bar"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={chartMode === mode ? "active" : ""}
                        onClick={() => setChartMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-food" /> Food (g)
                </span>
                <span>
                  <i className="legend-water" /> Water (ml)
                </span>
              </div>
              <ConsumptionChart mode={chartMode} range={dateRange} records={historyEntries} />
              <p className="chart-footnote">
                <Icon name="info" size={15} /> Aggregated from successful Supabase dispensing records. Food is shown in grams and water is shown in milliliters.
              </p>
            </section>
          </div>
        )}

        {page === "history" && (
          <div className="page">
            <div className="history-summary">
              <div className="history-stat">
                <span className="metric-icon food">
                  <Icon name="bowl" />
                </span>
                <div>
                  <span>Total food dispensed</span>
                  <strong>
                    {historySummary.food} <small>g</small>
                  </strong>
                </div>
              </div>
              <div className="history-stat">
                <span className="metric-icon water">
                  <Icon name="drop" />
                </span>
                <div>
                  <span>Total water dispensed</span>
                  <strong>
                    {historySummary.water} <small>ml</small>
                  </strong>
                </div>
              </div>
              <div className="history-stat">
                <span className="history-status-icon success">
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <span>Successful operations</span>
                  <strong>{historySummary.successful}</strong>
                </div>
              </div>
              <div className="history-stat">
                <span className="history-status-icon failed">
                  <Icon name="info" size={18} />
                </span>
                <div>
                  <span>Failed operations</span>
                  <strong>{historySummary.failed}</strong>
                </div>
              </div>
            </div>

            <section className="card history-card">
              <div className="history-card-header">
                <div>
                  <span className="eyebrow">Activity log</span>
                  <h2>Dispensing records</h2>
                  <p>Newest activity is shown first · Live records from Supabase</p>
                </div>
                <div className="history-search">
                  <Icon name="search" size={17} />
                  <input
                    type="text"
                    role="searchbox"
                    inputMode="search"
                    aria-label="Search dispensing history"
                    placeholder="Search date, amount, schedule or status"
                    autoComplete="off"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch("")} aria-label="Clear search">
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="history-filters">
                <label>
                  <span>Date range</span>
                  <select
                    value={historyRange}
                    onChange={(event) =>
                      setHistoryRange(
                        event.target.value as "Today" | "Last 7 Days" | "Last 30 Days" | "Custom",
                      )
                    }
                  >
                    <option>Today</option>
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                    <option>Custom</option>
                  </select>
                </label>
                {historyRange === "Custom" && (
                  <div className="custom-date-filter">
                    <label>
                      <span>From</span>
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo}
                        onChange={(event) => setCustomFrom(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>To</span>
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        max={dateInputValue(0)}
                        onChange={(event) => setCustomTo(event.target.value)}
                      />
                    </label>
                  </div>
                )}
                <label>
                  <span>Dispensing type</span>
                  <select
                    value={historyType}
                    onChange={(event) =>
                      setHistoryType(event.target.value as "All" | "Food" | "Water")
                    }
                  >
                    <option>All</option>
                    <option>Food</option>
                    <option>Water</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={historyStatus}
                    onChange={(event) =>
                      setHistoryStatus(event.target.value as "All" | "Successful" | "Failed")
                    }
                  >
                    <option>All</option>
                    <option>Successful</option>
                    <option>Failed</option>
                  </select>
                </label>
                {(historyRange !== "Last 30 Days" ||
                  historyType !== "All" ||
                  historyStatus !== "All" ||
                  historySearch) && (
                    <button
                      className="clear-filters"
                      onClick={() => {
                        setHistoryRange("Last 30 Days");
                        setHistoryType("All");
                        setHistoryStatus("All");
                        setHistorySearch("");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
              </div>

              {filteredHistory.length ? (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date & time</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Related schedule</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((record) => (
                        <tr key={record.id}>
                          <td data-label="Date & time">
                            <strong>{formatHistoryDate(record.date)}</strong>
                            <span>{formatTime(record.time)}</span>
                          </td>
                          <td data-label="Type">
                            <span className={`record-type ${record.type.toLowerCase()}`}>
                              <Icon name={record.type === "Food" ? "bowl" : "drop"} size={16} />
                              {record.type}
                            </span>
                          </td>
                          <td data-label="Amount">
                            <strong className={record.status === "Failed" ? "failed-amount" : ""}>
                              {record.status === "Failed"
                                ? "Not dispensed"
                                : `${record.amount} ${record.unit}`}
                            </strong>
                          </td>
                          <td data-label="Related schedule">
                            <span className="schedule-reference">
                              <Icon name="calendar" size={15} />
                              {record.schedule}
                            </span>
                          </td>
                          <td data-label="Status">
                            <div className="history-status-cell">
                              <span className={`operation-status ${record.status.toLowerCase()}`}>
                                <i />
                                {record.status}
                              </span>
                              <span
                                className={`dispense-method ${(record.method ?? "Automatic").toLowerCase()}`}
                              >
                                {record.method ?? "Automatic"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state history-empty">
                  <span>
                    <Icon name="history" size={26} />
                  </span>
                  <h3>No dispensing records found</h3>
                  <p>Try changing the selected date, type, status, or search term.</p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setHistoryRange("Last 30 Days");
                      setHistoryType("All");
                      setHistoryStatus("All");
                      setHistorySearch("");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              <div className="history-footer">
                Showing {filteredHistory.length} of {historyEntries.length} records
              </div>
            </section>
          </div>
        )}

        {page === "alerts" && (
          <div className="page">
            <div className="alerts-toolbar">
              <div className="filter-pills">
                {(["All", "Unread", "Supply", "Device"] as const).map((filter) => (
                  <button
                    key={filter}
                    className={alertFilter === filter ? "active" : ""}
                    onClick={() => setAlertFilter(filter)}
                  >
                    {filter}
                    {filter === "Unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                disabled={unreadCount === 0}
                onClick={async () => {
                  const { error } = await supabase
                    .from("alerts")
                    .update({ is_read: true })
                    .eq("is_read", false);

                  if (error) {
                    console.error("Unable to mark alerts as read:", error.message);
                    setToast("Unable to mark alerts as read. Please try again.");
                    return;
                  }

                  setAlerts((items) => items.map((item) => ({ ...item, unread: false })));
                  setToast("All alerts marked as read");
                }}
              >
                <Icon name="check" size={17} /> Mark all as read
              </button>
            </div>
            <section className="card alerts-card">
              <div className="section-heading alerts-heading">
                <div>
                  <span className="eyebrow">Notification history</span>
                  <h2>{alertFilter === "All" ? "All alerts" : alertFilter}</h2>
                </div>
                <span>
                  {filteredAlerts.length} {filteredAlerts.length === 1 ? "alert" : "alerts"}
                </span>
              </div>
              {filteredAlerts.length > 0 ? (
                <div className="full-alert-list">
                  {filteredAlerts.map((alert) => (
                    <article
                      className={`full-alert ${alert.unread ? "unread" : ""}`}
                      key={alert.id}
                    >
                      <span
                        className={`alert-symbol large ${alert.level === "Attention" ? "attention" : ""}`}
                      >
                        <Icon
                          name={
                            alert.category === "Supply"
                              ? "info"
                              : alert.category === "Schedule"
                                ? "check"
                                : "bell"
                          }
                        />
                      </span>
                      <div className="full-alert-copy">
                        <div className="alert-title-line">
                          <strong>{alert.title}</strong>
                          {alert.unread && <span className="unread-label">Unread</span>}
                        </div>
                        <p>{alert.detail}</p>
                        <div>
                          <span
                            className={`category-tag ${alert.level === "Attention" ? "attention" : ""}`}
                          >
                            {alert.category} · {alert.level}
                          </span>
                          <time>{alert.time}</time>
                        </div>
                      </div>
                      {alert.unread ? (
                        <button
                          className="secondary-button compact"
                          onClick={() => {
                            setAlerts((items) =>
                              items.map((item) => item.id === alert.id ? { ...item, unread: false } : item),
                            );
                            void supabase
                              .from("alerts")
                              .update({ is_read: true })
                              .eq("id", alert.id);
                          }}
                        >
                          <Icon name="check" size={16} /> Mark as read
                        </button>
                      ) : (
                        <span className="read-state">
                          <Icon name="check" size={16} /> Read
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span>
                    <Icon name="check" size={26} />
                  </span>
                  <h3>You’re all caught up</h3>
                  <p>No alerts match this filter.</p>
                  <button className="secondary-button" onClick={() => setAlertFilter("All")}>
                    View all alerts
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {profileOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && setProfileOpen(false)}>
          <section className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="modal-header"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h2 id="profile-modal-title">Your profile</h2></div><button className="modal-close" onClick={() => setProfileOpen(false)} aria-label="Close"><Icon name="x" /></button></div>
            <form onSubmit={saveProfile} className="profile-form">
              <div className="avatar-upload-row">{avatarUrl ? <img src={avatarUrl} className="avatar-large" alt="Profile preview" /> : <div className="avatar-large avatar-placeholder">{(profileName || user.email || "P").slice(0,1).toUpperCase()}</div>}<div><strong>Profile photo</strong><small>Optional · JPG, PNG or WebP · up to 3 MB</small><label className="secondary-button upload-label">Choose photo<input type="file" accept="image/*" onChange={e => uploadAvatar(e.target.files?.[0])} hidden /></label>{avatarUrl && <button type="button" className="text-button" onClick={() => setAvatarUrl("")}>Remove photo</button>}</div></div>
              <div className="form-field"><label htmlFor="profile-name">Your name</label><input className="text-input" id="profile-name" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Enter your name" maxLength={80} /></div>
              <div className="form-field"><label htmlFor="pet-name">Pet name</label><input className="text-input" id="pet-name" value={petName} onChange={e => setPetName(e.target.value)} placeholder="Enter your pet's name" maxLength={60} /></div>
              <div className="form-field"><label>Email address</label><input className="text-input" value={user.email ?? ""} disabled /></div>
              {profileError && <p className="auth-error">{profileError}</p>}{profileSuccess && <p className="auth-success">{profileSuccess}</p>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setProfileOpen(false)}>Close</button><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button></div>
            </form>
            <div className="password-section"><h3>Change password</h3><form onSubmit={changePassword} className="profile-form"><div className="form-field"><label htmlFor="new-password">New password</label><div className="password-wrap"><input className="text-input" id="new-password" type={showNewPassword ? "text" : "password"} minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"/><button type="button" className="password-toggle" onClick={() => setShowNewPassword(v => !v)}>{showNewPassword ? "Hide" : "Show"}</button></div></div><div className="form-field"><label htmlFor="confirm-new-password">Confirm new password</label><div className="password-wrap"><input className="text-input" id="confirm-new-password" type={showConfirmNewPassword ? "text" : "password"} minLength={8} required value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter new password"/><button type="button" className="password-toggle" onClick={() => setShowConfirmNewPassword(v => !v)}>{showConfirmNewPassword ? "Hide" : "Show"}</button></div></div><button className="secondary-button" type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating…" : "Update password"}</button></form></div>
          </section>
        </div>
      )}

      {editorOpen && (
        <div
          className="modal-layer"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}
        >
          <section
            className="modal schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">{editingId ? "Update routine" : "New routine"}</span>
                <h2 id="schedule-modal-title">
                  {editingId ? "Edit schedule" : "Add a feeding schedule"}
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setEditorOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="schedule-form-grid">
              <div className="form-field">
                <label htmlFor="schedule-name">
                  Schedule name <span>Optional</span>
                </label>
                <input
                  className="text-input"
                  id="schedule-name"
                  type="text"
                  placeholder="e.g. Breakfast"
                  value={formName}
                  maxLength={40}
                  onChange={(event) => {
                    setFormName(event.target.value);
                    setFormError("");
                  }}
                />
              </div>
              <div className="form-field">
                <label htmlFor="feeding-time">Dispensing time</label>
                <div className="input-with-icon">
                  <Icon name="clock" size={18} />
                  <input
                    id="feeding-time"
                    type="time"
                    value={formTime}
                    onChange={(event) => {
                      setFormTime(event.target.value);
                      setFormError("");
                    }}
                  />
                </div>
              </div>
            </div>
            <fieldset>
              <legend>What should be dispensed?</legend>
              <div className="type-options">
                {(["Food", "Water", "Food & water"] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={formType === type ? "selected" : ""}
                    onClick={() => {
                      setFormType(type);
                      setFormError("");
                    }}
                  >
                    <Icon name={type === "Water" ? "drop" : "bowl"} size={19} />
                    <span>{type}</span>
                    {formType === type && (
                      <i>
                        <Icon name="check" size={13} />
                      </i>
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="recurrence-fieldset">
              <legend>Repeat</legend>
              <div className="recurrence-options">
                {(["Once", "Every Day", "Weekdays", "Weekends", "Custom Days"] as const).map(
                  (recurrence) => (
                    <button
                      type="button"
                      key={recurrence}
                      className={formRecurrence === recurrence ? "selected" : ""}
                      onClick={() => selectRecurrence(recurrence)}
                    >
                      {recurrence}
                    </button>
                  ),
                )}
              </div>
              {formRecurrence === "Custom Days" && (
                <div className="day-picker" aria-label="Select recurring days">
                  {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as DayName[]).map((day) => {
                    const selected = formDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        className={selected ? "selected" : ""}
                        aria-pressed={selected}
                        onClick={() => {
                          setFormDays((days) =>
                            selected ? days.filter((item) => item !== day) : [...days, day],
                          );
                          setFormError("");
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
              {formRecurrence !== "Once" && formRecurrence !== "Custom Days" && (
                <p className="recurrence-hint">
                  <Icon name="check" size={14} />
                  {formRecurrence === "Every Day"
                    ? "All seven days selected"
                    : formRecurrence === "Weekdays"
                      ? "Monday through Friday selected"
                      : "Saturday and Sunday selected"}
                </p>
              )}
            </fieldset>
            <div className="schedule-form-grid date-grid">
              <div className="form-field">
                <label htmlFor="start-date">Start date</label>
                <input
                  className="text-input"
                  id="start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(event) => {
                    setFormStartDate(event.target.value);
                    setFormError("");
                  }}
                />
              </div>
              <div className="form-field">
                <label htmlFor="end-date">
                  End date <span>Optional</span>
                </label>
                <input
                  className="text-input"
                  id="end-date"
                  type="date"
                  min={formStartDate}
                  value={formEndDate}
                  onChange={(event) => {
                    setFormEndDate(event.target.value);
                    setFormError("");
                  }}
                />
                <small>Leave blank to continue until disabled.</small>
              </div>
            </div>
            {formError && (
              <div className="form-error">
                <Icon name="info" size={17} /> {formError}
              </div>
            )}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setEditorOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveSchedule}>
                <Icon name="check" size={17} /> {editingId ? "Save changes" : "Save schedule"}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>
            <Icon name="check" size={16} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateInputValue(daysAgo: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatHistoryDate(value: string) {
  if (value === dateInputValue(0)) return "Today";
  if (value === dateInputValue(1)) return "Yesterday";
  return parseLocalDate(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRecurrence(schedule: Schedule) {
  if (schedule.recurrence === "Once") {
    return `Once · ${parseLocalDate(schedule.startDate).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })}`;
  }
  if (schedule.recurrence === "Custom Days") return schedule.days.join(", ");
  return schedule.recurrence;
}

function getNextOccurrence(schedule: Schedule, reference: Date): Date | null {
  const dayNames: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const start = parseLocalDate(schedule.startDate);
  const end = schedule.endDate ? parseLocalDate(schedule.endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  for (let offset = 0; offset < 366; offset += 1) {
    const candidate = new Date(reference);
    candidate.setDate(reference.getDate() + offset);
    const [hours, minutes] = schedule.time.split(":").map(Number);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate < reference || candidate < start || (end && candidate > end)) continue;
    const isStartDate = candidate.toDateString() === start.toDateString();
    const matchesRecurrence = schedule.recurrence === "Once"
      ? isStartDate
      : schedule.days.includes(dayNames[candidate.getDay()]);
    if (matchesRecurrence) return candidate;
  }
  return null;
}

function getNextRun(schedule: Schedule) {
  const occurrence = getNextOccurrence(schedule, new Date());
  if (!occurrence) return "No upcoming run";
  const today = new Date();
  const offset = Math.round((new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  const dayLabel = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : occurrence.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${dayLabel}, ${formatTime(schedule.time)}`;
}

export default App;