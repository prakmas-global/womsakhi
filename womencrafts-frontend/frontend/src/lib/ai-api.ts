import { apiClient } from "@/lib/api";

// --- Command Center ------------------------------------------------------------------
// No AI model runs behind these calls. Everything is counted from the platform's
// own records on the server; the tasks are a real staff to-do list.

export interface Priority { key: string; icon: string; tone: string; count: number; text: string; href: string }

export interface HealthIndicator {
  key: string; icon: string; tone: string; label: string;
  value: number | null;   // 0–100; null when there is nothing to measure yet
  measures: string;       // what the number is
  detail: string;         // the figures behind it
}

export interface Health { overall: number | null; rating: string; color: string; measured: number; indicators: HealthIndicator[] }

export interface Insight { key: string; icon: string; tone: string; title: string; description: string; href: string }

export interface Overview { generated_at: string; note: string; priorities: Priority[]; health: Health; insights: Insight[] }

export type TaskPriority = "high" | "medium" | "low";

export interface StaffTask {
  id: string; title: string; notes: string; priority: TaskPriority; due: string; done: boolean; done_at: string | null;
  href: string; assignee_id: string; assignee_name: string; created_by_name: string; created_at: string; overdue: boolean;
}

export interface TaskStats { open: number; done: number; overdue: number; mine: number }

export interface TaskInput { title: string; notes?: string; priority?: TaskPriority; due?: string; href?: string; assignee_id?: string }

export interface ActivityRow { id: string; at: string; who: string; action: string; category: string; detail: string }

export interface AskResult { answer: string; figures: Record<string, unknown>; href: string; understood: boolean; can_answer: string[] }

export async function apiCommandOverview(): Promise<Overview> {
  const { data } = await apiClient.get<Overview>("/ai/overview");
  return data;
}

export async function apiStaffTasks(show: "open" | "done" | "all" = "open", mine = false): Promise<StaffTask[]> {
  const { data } = await apiClient.get<StaffTask[]>("/ai/tasks", { params: { show, mine } });
  return data;
}

export async function apiStaffTaskStats(): Promise<TaskStats> {
  const { data } = await apiClient.get<TaskStats>("/ai/tasks/stats");
  return data;
}

export async function apiCreateStaffTask(body: TaskInput): Promise<StaffTask> {
  const { data } = await apiClient.post<StaffTask>("/ai/tasks", body);
  return data;
}

export async function apiUpdateStaffTask(id: string, body: Partial<TaskInput> & { done?: boolean }): Promise<StaffTask> {
  const { data } = await apiClient.patch<StaffTask>(`/ai/tasks/${id}`, body);
  return data;
}

export async function apiDeleteStaffTask(id: string): Promise<void> {
  await apiClient.delete(`/ai/tasks/${id}`);
}

export async function apiCommandActivity(limit = 10): Promise<ActivityRow[]> {
  const { data } = await apiClient.get<ActivityRow[]>("/ai/activity", { params: { limit } });
  return data;
}

export async function apiAsk(question: string): Promise<AskResult> {
  const { data } = await apiClient.post<AskResult>("/ai/ask", { question });
  return data;
}

export async function apiCommandReport(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>("/ai/report", { responseType: "blob" });
  return data;
}
