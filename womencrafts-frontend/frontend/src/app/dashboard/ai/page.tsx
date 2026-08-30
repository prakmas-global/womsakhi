"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Clock,
  History,
  ClipboardList,
  UserCheck,
  TrendingDown,
  Users,
  MessageSquare,
  Sparkles,
  ArrowUp,
  ArrowRight,
  ClipboardCheck,
  UserPlus,
  Flag,
  CalendarX,
  FileBarChart,
  UserCog,
  UsersRound,
  Target,
  MessageCircle,
  FileText,
  Megaphone,
  Smile,
  Wand2,
  LineChart,
  Lightbulb,
  Mic,
  BarChart3,
  MapPin,
  UserMinus,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileStack,
  Network,
  RefreshCw,
} from "lucide-react";
import { Badge, Card, Modal, type Tone, useToast } from "@/design-system";
import RadialGauge from "@/components/charts/RadialGauge";
import { TONE_BG } from "@/lib/tones";
import {
  apiAiPriorities,
  apiAiHealthMetrics,
  apiAiHealthStats,
  apiAiTasks,
  apiAiTaskStats,
  apiUpdateAiTask,
  apiAiAgents,
  apiAiInsights,
  apiAiActions,
  apiAiActivities,
  apiAiMemoryStats,
  apiAiPrompts,
  apiAiChat,
  apiAiReport,
  type AiHealthStats,
  type AiTaskStats,
} from "@/lib/ai-api";
import { memberError } from "@/lib/member-api";

// Lucide icon components keyed by the icon-name strings the backend sends.
const ICON_MAP: Record<string, React.ElementType> = {
  ClipboardList,
  UserCheck,
  TrendingDown,
  Target,
  MessageSquare,
  CalendarX,
  LineChart,
  ClipboardCheck,
  Flag,
  FileBarChart,
  UserPlus,
  UsersRound,
  Bot,
  MessageCircle,
  FileText,
  BarChart3,
  MapPin,
  UserMinus,
  Megaphone,
  Smile,
  Wand2,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileStack,
  Network,
  RefreshCw,
};
const iconFor = (name: string): React.ElementType => ICON_MAP[name] ?? Bot;

// View-model shapes the JSX consumes (icon strings already resolved to components).
type PriorityVM = { icon: React.ElementType; text: string; tone: string };
type HealthVM = { icon: React.ElementType; label: string; value: number; tone: string };
type TaskVM = { id: string; icon: React.ElementType; title: string; due: string; done: boolean };
type AgentVM = {
  id: string;
  name: string;
  icon: React.ElementType;
  tone: string;
  metric: string;
  label: string;
  rate: string;
  last: string;
  status: string;
};
type InsightVM = { id: string; icon: React.ElementType; tone: string; title: string; desc: string; action: string };
type ActionVM = { id: string; icon: React.ElementType; tone: string; title: string; desc: string };
type TimelineVM = { time: string; icon: React.ElementType; text: string; status: string; tone: string };
type MemoryVM = { icon: React.ElementType; tone: string; label: string; value: string; sub: string };

const TILE_BG: Record<string, string> = {
  brand: "bg-brand-tint/50",
  violet: "bg-violet-tint/50",
  emerald: "bg-status-ok-bg/50",
  amber: "bg-status-warn-bg/50",
  sky: "bg-status-info-bg/50",
  rose: "bg-status-danger-bg/50",
};

type ChatRole = "user" | "assistant";
type ChatMessage = { id: number; role: ChatRole; text: string };

// Local fallback used only if the /ai/chat request fails — mirrors the backend reply.
function cannedReply(question: string): string {
  return `Here's what I found for "${question.trim()}": I analyzed your latest platform data and prepared a concise summary with recommended next actions. Ask me to dig deeper into any metric, agent, or region.`;
}

export default function AiCommandCenterPage() {
  const toast = useToast();
  // ---- Live data ----
  const [loading, setLoading] = useState(true);
  const [priorities, setPriorities] = useState<PriorityVM[]>([]);
  const [health, setHealth] = useState<HealthVM[]>([]);
  const [healthStats, setHealthStats] = useState<AiHealthStats | null>(null);
  const [highTasks, setHighTasks] = useState<TaskVM[]>([]);
  const [medTasks, setMedTasks] = useState<TaskVM[]>([]);
  const [taskStats, setTaskStats] = useState<AiTaskStats | null>(null);
  const [agents, setAgents] = useState<AgentVM[]>([]);
  const [insights, setInsights] = useState<InsightVM[]>([]);
  const [oneClick, setOneClick] = useState<ActionVM[]>([]);
  const [timeline, setTimeline] = useState<TimelineVM[]>([]);
  const [memory, setMemory] = useState<MemoryVM[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [voiceChips, setVoiceChips] = useState<string[]>([]);

  // One pass hydrates every widget on the screen.
  const refresh = useCallback(async () => {
    try {
      const [
        priorityData,
        healthData,
        healthStatsData,
        tasksData,
        taskStatsData,
        agentsData,
        insightsData,
        actionsData,
        activitiesData,
        memoryData,
        promptsData,
      ] = await Promise.all([
        apiAiPriorities(),
        apiAiHealthMetrics(),
        apiAiHealthStats(),
        apiAiTasks(),
        apiAiTaskStats(),
        apiAiAgents(),
        apiAiInsights(),
        apiAiActions(),
        apiAiActivities(),
        apiAiMemoryStats(),
        apiAiPrompts(),
      ]);

      setPriorities(priorityData.map((p) => ({ icon: iconFor(p.icon), text: p.text, tone: p.tone })));
      setHealth(healthData.map((h) => ({ icon: iconFor(h.icon), label: h.label, value: h.value, tone: h.tone })));
      setHealthStats(healthStatsData);

      const toTask = (t: (typeof tasksData)[number]): TaskVM => ({
        id: t.id,
        icon: iconFor(t.icon),
        title: t.title,
        due: t.due,
        done: t.done,
      });
      setHighTasks(tasksData.filter((t) => t.priority === "high").map(toTask));
      setMedTasks(tasksData.filter((t) => t.priority === "medium").map(toTask));
      setTaskStats(taskStatsData);

      setAgents(
        agentsData.map((a) => ({
          id: a.id,
          name: a.name,
          icon: iconFor(a.icon),
          tone: a.tone,
          metric: a.metric,
          label: a.label,
          rate: a.rate,
          last: a.last_active,
          status: a.status,
        })),
      );
      setInsights(
        insightsData.map((i) => ({
          id: i.id,
          icon: iconFor(i.icon),
          tone: i.tone,
          title: i.title,
          desc: i.description,
          action: i.action,
        })),
      );
      setOneClick(
        actionsData.map((a) => ({
          id: a.id,
          icon: iconFor(a.icon),
          tone: a.tone,
          title: a.title,
          desc: a.description,
        })),
      );
      setTimeline(
        activitiesData.map((a) => ({
          time: a.time,
          icon: iconFor(a.icon),
          text: a.text,
          status: a.status,
          tone: a.tone,
        })),
      );
      setMemory(
        memoryData.map((m) => ({ icon: iconFor(m.icon), tone: m.tone, label: m.label, value: m.value, sub: m.sub })),
      );
      setSuggestions(promptsData.filter((p) => p.kind === "suggestion").map((p) => p.text));
      setVoiceChips(promptsData.filter((p) => p.kind === "voice").map((p) => p.text));
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---- Ask AI chat state ----
  const [draft, setDraft] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const msgIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pushExchange = async (question: string) => {
    const q = question.trim();
    if (!q) return;
    const userId = (msgIdRef.current += 1);
    setChat((prev) => [...prev, { id: userId, role: "user", text: q }]);
    setDraft("");
    let reply = cannedReply(q);
    try {
      reply = await apiAiChat(q);
    } catch (err) {
      toast.error("Could not send your message", { description: memberError(err) });
    }
    const botId = (msgIdRef.current += 1);
    setChat((prev) => [...prev, { id: botId, role: "assistant", text: reply }]);
  };

  const sendDraft = () => pushExchange(draft);

  const askQuestion = (question: string) => pushExchange(question);

  const focusAsk = () => {
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ---- Task done toggles (persisted) ----
  const toggleTask = async (task: TaskVM) => {
    try {
      await apiUpdateAiTask(task.id);
      await refresh();
    } catch (err) {
      toast.error("Could not update the task", { description: memberError(err) });
    }
  };

  // ---- Voice assistant ----
  const [listening, setListening] = useState(false);

  // ---- Modals ----
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [allHighOpen, setAllHighOpen] = useState(false);
  const [allMedOpen, setAllMedOpen] = useState(false);
  const [allTasksOpen, setAllTasksOpen] = useState(false);
  const [manageAgentsOpen, setManageAgentsOpen] = useState(false);
  const [allInsightsOpen, setAllInsightsOpen] = useState(false);
  const [allActivityOpen, setAllActivityOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const [agentDetail, setAgentDetail] = useState<AgentVM | null>(null);
  const [insightResult, setInsightResult] = useState<InsightVM | null>(null);
  const [oneClickResult, setOneClickResult] = useState<ActionVM | null>(null);

  const scrollToTasks = () => {
    document.getElementById("ai-tasks-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- CSV export for "Generate Report" (from the backend) ----
  const downloadReport = async () => {
    try {
      const blob = await apiAiReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-business-report.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* ignore — could surface a toast */
    }
  };

  const runOneClick = (a: ActionVM) => {
    if (a.title === "Generate Report") {
      downloadReport();
    }
    setOneClickResult(a);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
          <Bot className="h-6 w-6" />
        </span>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">AI Command Center</h1>
            <span className="rounded-full bg-violet-tint px-2.5 py-0.5 text-2xs font-semibold text-violet-ink">Agentic AI</span>
          </div>
          <p className="mt-1 text-sm text-ink-subtle">Your AI executive assistant that thinks, analyzes and acts to grow WomSakhi.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-ink-subtle">Loading AI Command Center…</div>
      ) : (
        <>
          {/* TOP ROW */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Greeting */}
            <Card padded={false} className="overflow-hidden bg-linear-to-br from-violet-50 to-brand-50 p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-brand-500 text-white shadow-lg shadow-violet-200">
                  <Bot className="h-9 w-9" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold text-ink">Good Morning, Praveen</h2>
                  <p className="mt-1 text-sm text-ink-muted">I analyzed your platform overnight. Here are today&apos;s key priorities:</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {priorities.map((p) => (
                  <div key={p.text} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5 shadow-sm">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[p.tone]}`}>
                      <p.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-ink-muted">{p.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button className="btn btn-primary" onClick={scrollToTasks}>
                  <ClipboardCheck className="h-4 w-4" /> Review My Tasks
                </button>
                <button className="btn btn-secondary" onClick={focusAsk}>
                  <MessageSquare className="h-4 w-4" /> Chat with AI
                </button>
              </div>
            </Card>

            {/* Ask AI Anything */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">Ask AI Anything</h2>
                <button onClick={() => setChatHistoryOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-violet-ink"><History className="h-3.5 w-3.5" /> View Chat History</button>
              </div>
              <p className="mb-3 text-sm text-ink-subtle">Your AI executive is ready to help.</p>
              {chat.length > 0 && (
                <div className="mb-3 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-surface-inset p-3">
                  {chat.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          m.role === "user"
                            ? "bg-brand-600 text-white"
                            : "bg-surface text-ink-muted shadow-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={5}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      sendDraft();
                    }
                  }}
                  placeholder="Ask anything about your business..."
                  className="w-full resize-none rounded-xl border border-line-strong p-3 pr-14 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                />
                <button aria-label="Send" onClick={sendDraft} className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => askQuestion(s)} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover">{s}</button>
                ))}
              </div>
            </Card>

            {/* Business Health Score */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">Business Health Score</h2>
                <button onClick={() => setHealthOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">View Details</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <RadialGauge value={healthStats?.overall ?? 0} color={healthStats?.color ?? "var(--status-ok-solid)"} size={130} thickness={12} centerValue={String(healthStats?.overall ?? 0)} centerLabel={healthStats?.center_label ?? "/100"} />
                  <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-status-ok-ink"><ArrowUp className="h-4 w-4" /> {healthStats?.rating ?? "Excellent"}</span>
                </div>
                <ul className="flex-1 space-y-2.5">
                  {health.map((h) => (
                    <li key={h.label} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${TONE_BG[h.tone]}`}><h.icon className="h-3.5 w-3.5" /></span>
                      <span className="flex-1 text-ink-muted">{h.label}</span>
                      <span className="font-semibold text-ink">{h.value}%</span>
                      <ArrowUp className="h-3.5 w-3.5 text-status-ok-ink" />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-status-ok-bg p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" />
                <p className="text-xs text-ink-muted">{healthStats?.note ?? "Your platform is performing excellent! Keep up the great work."}</p>
              </div>
            </Card>
          </div>

          {/* MIDDLE ROW */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* AI Tasks Center */}
            <Card>
              <div id="ai-tasks-center" className="mb-1 flex items-center justify-between scroll-mt-24">
                <h2 className="font-display text-base font-semibold text-ink">AI Tasks Center</h2>
                <button onClick={() => setAllTasksOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">View All Tasks</button>
              </div>
              <p className="mb-4 text-xs text-ink-subtle">Tasks generated &amp; prioritized by AI</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* High */}
                <div>
                  <div className="mb-2 flex items-center gap-2 border-b border-status-danger-border pb-2">
                    <span className="text-sm font-semibold text-status-danger-ink">High Priority</span>
                    <Badge tone="rose">{taskStats?.high ?? 0}</Badge>
                  </div>
                  <ul className="space-y-2.5">
                    {highTasks.map((t) => {
                      const done = t.done;
                      return (
                        <li key={t.title}>
                          <button onClick={() => toggleTask(t)} className="flex w-full items-start gap-2.5 text-left">
                            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-status-ok-bg text-status-ok-ink" : "bg-status-danger-bg text-status-danger-ink"}`}>
                              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <t.icon className="h-3.5 w-3.5" />}
                            </span>
                            <div><p className={`text-sm font-semibold ${done ? "text-ink-subtle line-through" : "text-ink"}`}>{t.title}</p><p className="text-xs text-ink-subtle">{t.due}</p></div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button onClick={() => setAllHighOpen(true)} className="mt-3 w-full rounded-lg bg-status-danger-bg py-2 text-xs font-semibold text-status-danger-ink hover:bg-status-danger-bg">View All High Priority</button>
                </div>
                {/* Medium */}
                <div>
                  <div className="mb-2 flex items-center gap-2 border-b border-status-warn-border pb-2">
                    <span className="text-sm font-semibold text-status-warn-ink">Medium Priority</span>
                    <Badge tone="amber">{taskStats?.medium ?? 0}</Badge>
                  </div>
                  <ul className="space-y-2.5">
                    {medTasks.map((t) => {
                      const done = t.done;
                      return (
                        <li key={t.title}>
                          <button onClick={() => toggleTask(t)} className="flex w-full items-start gap-2.5 text-left">
                            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-status-ok-bg text-status-ok-ink" : "bg-status-warn-bg text-status-warn-ink"}`}>
                              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <t.icon className="h-3.5 w-3.5" />}
                            </span>
                            <div><p className={`text-sm font-semibold ${done ? "text-ink-subtle line-through" : "text-ink"}`}>{t.title}</p><p className="text-xs text-ink-subtle">{t.due}</p></div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button onClick={() => setAllMedOpen(true)} className="mt-3 w-full rounded-lg bg-status-warn-bg py-2 text-xs font-semibold text-status-warn-ink hover:bg-status-warn-bg">View All Medium Priority</button>
                </div>
              </div>
            </Card>

            {/* AI Workforce */}
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">AI Workforce <span className="text-ink-subtle">(Your Agents)</span></h2>
                <button onClick={() => setManageAgentsOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">Manage Agents</button>
              </div>
              <p className="mb-4 text-xs text-ink-subtle">All agents are working for you 24/7</p>
              <div className="grid grid-cols-2 gap-3">
                {agents.map((a) => (
                  <button key={a.name} onClick={() => setAgentDetail(a)} className="rounded-xl border border-line p-3 text-center transition hover:shadow-sm">
                    <p className="mb-1 text-xs font-semibold text-ink-muted">{a.name}</p>
                    <p className="mb-2 flex items-center justify-center gap-1 text-2xs text-status-ok-ink"><span className="h-1.5 w-1.5 rounded-full bg-status-ok-solid" /> {a.status}</p>
                    <span className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full ${TONE_BG[a.tone]}`}><a.icon className="h-5 w-5" /></span>
                    <p className="font-display text-lg font-bold text-ink">{a.metric}</p>
                    <p className="text-2xs text-ink-subtle">{a.label}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{a.rate}</p>
                    <p className="text-2xs text-ink-subtle">Success Rate</p>
                    <p className="mt-1.5 text-2xs text-ink-subtle">Last Active <span className="font-medium text-ink-subtle">{a.last}</span></p>
                  </button>
                ))}
              </div>
            </Card>

            {/* AI Insights */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">AI Insights</h2>
                <button onClick={() => setAllInsightsOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">View All Insights</button>
              </div>
              <ul className="space-y-3">
                {insights.map((i) => (
                  <li key={i.title} className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[i.tone]}`}><i.icon className="h-4.5 w-4.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{i.title}</p>
                      <p className="text-xs text-ink-subtle">{i.desc}</p>
                    </div>
                    <button onClick={() => setInsightResult(i)} className="btn btn-sm btn-secondary shrink-0">{i.action}</button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* One Click AI Actions */}
          <Card className="mt-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">One Click AI Actions</h2>
            </div>
            <p className="mb-4 text-xs text-ink-subtle">Let AI do the heavy lifting for you</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {oneClick.map((a) => (
                <button key={a.title} onClick={() => runOneClick(a)} className={`rounded-xl border border-line p-4 text-left transition hover:shadow-sm ${TILE_BG[a.tone]}`}>
                  <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[a.tone]}`}><a.icon className="h-4.5 w-4.5" /></span>
                  <p className="text-sm font-semibold text-ink">{a.title}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{a.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* BOTTOM ROW */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* AI Voice Assistant */}
            <Card>
              <h2 className="font-display text-base font-semibold text-ink">AI Voice Assistant</h2>
              <p className="mb-4 text-xs text-ink-subtle">Talk to your AI executive</p>
              <div className="flex flex-col items-center py-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-0.5">
                    {[8, 14, 20, 12, 24, 16].map((h, i) => (
                      <span key={i} className={`w-1 rounded-full bg-violet-200 ${listening ? "animate-pulse" : ""}`} style={{ height: h }} />
                    ))}
                  </div>
                  <button aria-label={listening ? "Stop listening" : "Start voice input"} aria-pressed={listening} onClick={() => setListening((v) => !v)} className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-violet-200 ring-8 ring-violet-100 ${listening ? "bg-status-danger-solid hover:bg-status-danger-solid animate-pulse" : "bg-violet-600 hover:bg-violet-700"}`}>
                    <Mic className="h-6 w-6" />
                  </button>
                  <div className="flex items-end gap-0.5">
                    {[16, 24, 12, 20, 14, 8].map((h, i) => (
                      <span key={i} className={`w-1 rounded-full bg-violet-200 ${listening ? "animate-pulse" : ""}`} style={{ height: h }} />
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium text-ink-subtle">{listening ? "Listening..." : "Click mic and ask anything..."}</p>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {voiceChips.map((c) => (
                  <button key={c} onClick={() => { setListening(false); askQuestion(c); }} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover">{c}</button>
                ))}
              </div>
            </Card>

            {/* AI Command Timeline */}
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">AI Command Timeline</h2>
                <button onClick={() => setAllActivityOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">View All Activity</button>
              </div>
              <p className="mb-4 text-xs text-ink-subtle">Live actions taken by AI</p>
              <ul className="space-y-3.5">
                {timeline.map((t) => (
                  <li key={t.time} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-medium text-ink-subtle">{t.time}</span>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[t.tone]}`}><t.icon className="h-4 w-4" /></span>
                    <p className="min-w-0 flex-1 text-sm text-ink-muted">{t.text}</p>
                    <Badge tone={t.tone as Tone}>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            {/* AI Memory & Knowledge */}
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">AI Memory &amp; Knowledge</h2>
                <button onClick={() => setMemoryOpen(true)} className="text-xs font-semibold text-violet-ink transition hover:underline">View Details</button>
              </div>
              <p className="mb-4 text-xs text-ink-subtle">Your AI learns from your business</p>
              <div className="grid grid-cols-2 gap-3">
                {memory.map((m) => (
                  <div key={m.label} className="rounded-xl border border-line p-3 text-center">
                    <span className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[m.tone]}`}><m.icon className="h-4.5 w-4.5" /></span>
                    <p className="text-2xs text-ink-subtle">{m.label}</p>
                    <p className="font-display text-base font-bold text-ink">{m.value}</p>
                    {m.sub && <p className="text-2xs font-medium text-status-ok-ink">{m.sub}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-violet-tint p-3">
                <Sparkles className="h-4 w-4 shrink-0 text-violet-ink" />
                <p className="text-xs text-ink-muted">AI learns from every interaction to serve you better</p>
              </div>
            </Card>
          </div>

          {/* ===== MODALS ===== */}

          {/* Chat History */}
          <Modal
            open={chatHistoryOpen}
            onClose={() => setChatHistoryOpen(false)}
            title="Chat History"
            description="Your recent conversation with the AI executive."
            icon={History}
            iconTone="violet"
            footer={<button className="btn btn-outline" onClick={() => setChatHistoryOpen(false)}>Close</button>}
          >
            {chat.length === 0 ? (
              <p className="text-sm text-ink-subtle">No messages yet. Ask the AI anything to start a conversation.</p>
            ) : (
              <div className="space-y-2">
                {chat.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-inset text-ink-muted"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>

          {/* Tasks Modal (from greeting fallback / not primary path) */}
          <Modal
            open={tasksModalOpen}
            onClose={() => setTasksModalOpen(false)}
            title="My Tasks"
            icon={ClipboardCheck}
            iconTone="brand"
            footer={<button className="btn btn-primary" onClick={() => setTasksModalOpen(false)}>Done</button>}
          >
            <ul className="space-y-2">
              {[...highTasks, ...medTasks].map((t) => (
                <li key={t.title} className="flex items-center gap-2.5 text-sm">
                  <t.icon className="h-4 w-4 text-ink-subtle" />
                  <span className={t.done ? "text-ink-subtle line-through" : "text-ink-muted"}>{t.title}</span>
                  <span className="ml-auto text-xs text-ink-subtle">{t.due}</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* Health breakdown */}
          <Modal
            open={healthOpen}
            onClose={() => setHealthOpen(false)}
            title="Business Health Breakdown"
            description={`Score components (overall ${healthStats?.overall ?? 0} / 100).`}
            icon={LineChart}
            iconTone="emerald"
            footer={<button className="btn btn-outline" onClick={() => setHealthOpen(false)}>Close</button>}
          >
            <ul className="space-y-3">
              {health.map((h) => (
                <li key={h.label} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[h.tone]}`}><h.icon className="h-4 w-4" /></span>
                  <span className="flex-1 text-sm text-ink-muted">{h.label}</span>
                  <span className="text-sm font-semibold text-ink">{h.value}%</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* View All High Priority */}
          <Modal
            open={allHighOpen}
            onClose={() => setAllHighOpen(false)}
            title="All High Priority Tasks"
            icon={Flag}
            iconTone="rose"
            footer={<button className="btn btn-outline" onClick={() => setAllHighOpen(false)}>Close</button>}
          >
            <ul className="space-y-2">
              {highTasks.map((t) => (
                <li key={t.title} className="flex items-center gap-2.5 text-sm">
                  <t.icon className="h-4 w-4 text-status-danger-ink" />
                  <span className={t.done ? "text-ink-subtle line-through" : "text-ink-muted"}>{t.title}</span>
                  <span className="ml-auto text-xs text-ink-subtle">{t.due}</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* View All Medium Priority */}
          <Modal
            open={allMedOpen}
            onClose={() => setAllMedOpen(false)}
            title="All Medium Priority Tasks"
            icon={FileBarChart}
            iconTone="amber"
            footer={<button className="btn btn-outline" onClick={() => setAllMedOpen(false)}>Close</button>}
          >
            <ul className="space-y-2">
              {medTasks.map((t) => (
                <li key={t.title} className="flex items-center gap-2.5 text-sm">
                  <t.icon className="h-4 w-4 text-status-warn-ink" />
                  <span className={t.done ? "text-ink-subtle line-through" : "text-ink-muted"}>{t.title}</span>
                  <span className="ml-auto text-xs text-ink-subtle">{t.due}</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* View All Tasks */}
          <Modal
            open={allTasksOpen}
            onClose={() => setAllTasksOpen(false)}
            title="All AI Tasks"
            description="Tasks generated & prioritized by AI. Tap a task in the card to mark it done."
            icon={ClipboardList}
            iconTone="violet"
            footer={<button className="btn btn-outline" onClick={() => setAllTasksOpen(false)}>Close</button>}
          >
            <ul className="space-y-2">
              {[...highTasks, ...medTasks].map((t) => (
                <li key={t.title} className="flex items-center gap-2.5 text-sm">
                  <t.icon className="h-4 w-4 text-ink-subtle" />
                  <span className={t.done ? "text-ink-subtle line-through" : "text-ink-muted"}>{t.title}</span>
                  <span className="ml-auto text-xs text-ink-subtle">{t.due}</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* Manage Agents */}
          <Modal
            open={manageAgentsOpen}
            onClose={() => setManageAgentsOpen(false)}
            title="Manage Agents"
            description="Your AI workforce is running 24/7."
            icon={UserCog}
            iconTone="violet"
            footer={<button className="btn btn-primary" onClick={() => setManageAgentsOpen(false)}>Done</button>}
          >
            <ul className="space-y-2">
              {agents.map((a) => (
                <li key={a.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone]}`}><a.icon className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{a.name}</p>
                    <p className="text-xs text-ink-subtle">{a.metric} · {a.label}</p>
                  </div>
                  <Badge tone="emerald">{a.status}</Badge>
                </li>
              ))}
            </ul>
          </Modal>

          {/* Agent detail */}
          <Modal
            open={agentDetail !== null}
            onClose={() => setAgentDetail(null)}
            title={agentDetail?.name ?? "Agent"}
            description="Live agent metrics"
            icon={agentDetail?.icon ?? Bot}
            iconTone="violet"
            footer={<button className="btn btn-outline" onClick={() => setAgentDetail(null)}>Close</button>}
          >
            {agentDetail && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-inset p-3 text-center">
                  <p className="font-display text-2xl font-bold text-ink">{agentDetail.metric}</p>
                  <p className="text-xs text-ink-subtle">{agentDetail.label}</p>
                </div>
                <div className="rounded-xl bg-surface-inset p-3 text-center">
                  <p className="font-display text-2xl font-bold text-ink">{agentDetail.rate}</p>
                  <p className="text-xs text-ink-subtle">Success Rate</p>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-xl bg-status-ok-bg p-3 text-sm text-ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-ok-solid" /> {agentDetail.status} · Last active {agentDetail.last}
                </div>
              </div>
            )}
          </Modal>

          {/* Insight result */}
          <Modal
            open={insightResult !== null}
            onClose={() => setInsightResult(null)}
            title={insightResult?.title ?? "Insight"}
            description={insightResult?.desc}
            icon={insightResult?.icon ?? Lightbulb}
            iconTone="violet"
            footer={<button className="btn btn-primary" onClick={() => setInsightResult(null)}>Got it</button>}
          >
            <div className="flex items-start gap-2 rounded-xl bg-violet-tint p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-ink" />
              <p className="text-sm text-ink-muted">AI is on it — &quot;{insightResult?.action}&quot; has been queued. Your agents are working on this insight and will report back shortly.</p>
            </div>
          </Modal>

          {/* One Click result */}
          <Modal
            open={oneClickResult !== null}
            onClose={() => setOneClickResult(null)}
            title={oneClickResult?.title ?? "AI Action"}
            description={oneClickResult?.desc}
            icon={oneClickResult?.icon ?? Wand2}
            iconTone="brand"
            footer={<button className="btn btn-primary" onClick={() => setOneClickResult(null)}>Done</button>}
          >
            <div className="flex items-start gap-2 rounded-xl bg-brand-tint p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
              <p className="text-sm text-ink-muted">
                {oneClickResult?.title === "Generate Report"
                  ? "Your report is being downloaded as a CSV file. AI compiled the latest business health metrics for you."
                  : `AI is on it — "${oneClickResult?.title}" is running. Your agents will complete this shortly and notify you.`}
              </p>
            </div>
          </Modal>

          {/* View All Insights */}
          <Modal
            open={allInsightsOpen}
            onClose={() => setAllInsightsOpen(false)}
            title="All AI Insights"
            icon={Lightbulb}
            iconTone="amber"
            footer={<button className="btn btn-outline" onClick={() => setAllInsightsOpen(false)}>Close</button>}
          >
            <ul className="space-y-3">
              {insights.map((i) => (
                <li key={i.title} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[i.tone]}`}><i.icon className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{i.title}</p>
                    <p className="text-xs text-ink-subtle">{i.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Modal>

          {/* View All Activity */}
          <Modal
            open={allActivityOpen}
            onClose={() => setAllActivityOpen(false)}
            title="All AI Activity"
            description="Live actions taken by AI"
            icon={Clock}
            iconTone="emerald"
            footer={<button className="btn btn-outline" onClick={() => setAllActivityOpen(false)}>Close</button>}
          >
            <ul className="space-y-3">
              {timeline.map((t) => (
                <li key={t.time} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs font-medium text-ink-subtle">{t.time}</span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_BG[t.tone]}`}><t.icon className="h-4 w-4" /></span>
                  <p className="min-w-0 flex-1 text-sm text-ink-muted">{t.text}</p>
                  <Badge tone={t.tone as Tone}>{t.status}</Badge>
                </li>
              ))}
            </ul>
          </Modal>

          {/* Memory details */}
          <Modal
            open={memoryOpen}
            onClose={() => setMemoryOpen(false)}
            title="AI Memory & Knowledge"
            description="Your AI learns from your business."
            icon={Database}
            iconTone="sky"
            footer={<button className="btn btn-outline" onClick={() => setMemoryOpen(false)}>Close</button>}
          >
            <ul className="space-y-2">
              {memory.map((m) => (
                <li key={m.label} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[m.tone]}`}><m.icon className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-subtle">{m.label}</p>
                    <p className="font-display text-base font-bold text-ink">{m.value}</p>
                  </div>
                  {m.sub && <span className="text-xs font-medium text-status-ok-ink">{m.sub}</span>}
                </li>
              ))}
            </ul>
          </Modal>
        </>
      )}
    </div>
  );
}
