import { apiClient } from "@/lib/api";

// --- AI Command Center API ---
// Mirrors app/schemas/ai.py on the backend. Icon fields arrive as lucide icon
// name strings (e.g. "ClipboardList") that the page resolves via ICON_MAP.

export interface AiPriority {
  id: string;
  text: string;
  icon: string;
  tone: string;
  order: number;
}

export interface AiHealthMetric {
  id: string;
  label: string;
  value: number;
  icon: string;
  tone: string;
  trend: string;
  order: number;
}

export interface AiHealthStats {
  overall: number;
  rating: string;
  color: string;
  center_label: string;
  note: string;
}

export interface AiTask {
  id: string;
  title: string;
  due: string;
  priority: string; // "high" | "medium"
  icon: string;
  done: boolean;
  order: number;
}

export interface AiTaskStats {
  high: number;
  medium: number;
  total: number;
}

export interface AiAgent {
  id: string;
  name: string;
  icon: string;
  tone: string;
  metric: string;
  label: string;
  rate: string;
  last_active: string;
  status: string;
  order: number;
}

export interface AiInsight {
  id: string;
  title: string;
  description: string;
  action: string;
  icon: string;
  tone: string;
  order: number;
}

export interface AiAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  order: number;
}

export interface AiActivity {
  id: string;
  time: string;
  text: string;
  status: string; // "Success" | "Alert"
  icon: string;
  tone: string;
  order: number;
}

export interface AiMemoryStat {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: string;
  tone: string;
  order: number;
}

export interface AiPrompt {
  id: string;
  text: string;
  kind: string; // "suggestion" | "voice"
  order: number;
}

// --- Reads ---

export async function apiAiPriorities(): Promise<AiPriority[]> {
  const { data } = await apiClient.get<AiPriority[]>("/ai/priorities");
  return data;
}

export async function apiAiHealthMetrics(): Promise<AiHealthMetric[]> {
  const { data } = await apiClient.get<AiHealthMetric[]>("/ai/health/metrics");
  return data;
}

export async function apiAiHealthStats(): Promise<AiHealthStats> {
  const { data } = await apiClient.get<AiHealthStats>("/ai/health/stats");
  return data;
}

export async function apiAiTasks(priority?: "high" | "medium"): Promise<AiTask[]> {
  const { data } = await apiClient.get<AiTask[]>("/ai/tasks", {
    params: priority ? { priority } : {},
  });
  return data;
}

export async function apiAiTaskStats(): Promise<AiTaskStats> {
  const { data } = await apiClient.get<AiTaskStats>("/ai/tasks/stats");
  return data;
}

export async function apiUpdateAiTask(id: string, done?: boolean): Promise<AiTask> {
  const { data } = await apiClient.patch<AiTask>(`/ai/tasks/${id}`, { done });
  return data;
}

export async function apiAiAgents(): Promise<AiAgent[]> {
  const { data } = await apiClient.get<AiAgent[]>("/ai/agents");
  return data;
}

export async function apiAiInsights(): Promise<AiInsight[]> {
  const { data } = await apiClient.get<AiInsight[]>("/ai/insights");
  return data;
}

export async function apiAiActions(): Promise<AiAction[]> {
  const { data } = await apiClient.get<AiAction[]>("/ai/actions");
  return data;
}

export async function apiAiActivities(status?: "Success" | "Alert"): Promise<AiActivity[]> {
  const { data } = await apiClient.get<AiActivity[]>("/ai/activities", {
    params: status ? { status } : {},
  });
  return data;
}

export async function apiAiMemoryStats(): Promise<AiMemoryStat[]> {
  const { data } = await apiClient.get<AiMemoryStat[]>("/ai/memory/stats");
  return data;
}

export async function apiAiPrompts(kind?: "suggestion" | "voice"): Promise<AiPrompt[]> {
  const { data } = await apiClient.get<AiPrompt[]>("/ai/prompts", {
    params: kind ? { kind } : {},
  });
  return data;
}

// --- Writes / actions ---

export async function apiAiChat(question: string): Promise<string> {
  const { data } = await apiClient.post<{ reply: string }>("/ai/chat", { question });
  return data.reply;
}

export async function apiAiReport(): Promise<Blob> {
  const { data } = await apiClient.get("/ai/report", { responseType: "blob" });
  return data as Blob;
}
