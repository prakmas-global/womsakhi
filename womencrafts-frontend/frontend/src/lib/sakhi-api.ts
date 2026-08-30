import { apiClient } from "./api";

/**
 * Sakhi's data layer.
 *
 * The list, transcript and delete calls go through `apiClient` like every other
 * module. The two streaming calls do NOT — axios buffers a response before it
 * resolves, which would hold the entire answer back and defeat the point of
 * streaming. Those use `fetch` and read the body as it arrives.
 *
 * `credentials: "include"` is the fetch equivalent of axios's `withCredentials`
 * and is what attaches the httpOnly session cookie. Without it every streamed
 * request is anonymous and 401s, while the non-streaming ones keep working —
 * which looks like a bug in the assistant rather than a missing option.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020/api/v1";

export type SakhiEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "safety"; category: string; text: string; helplines: Helpline[] }
  | { type: "confirm"; action_id: string; tool: string; sentence: string; conversation_id: string }
  | { type: "action"; approved: boolean; ok: boolean; text: string; tool?: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done"; conversation_id?: string };

export interface Helpline {
  name: string;
  number: string;
  desc: string;
  urgent: boolean;
}

export interface SakhiMessage {
  id: string;
  kind: "user" | "assistant" | "safety" | "action";
  text: string;
  meta: Record<string, unknown>;
  created_at: string | null;
}

export interface SakhiConversation {
  id: string;
  title: string;
  audience: string;
  locale: string;
  message_count: number;
  pending_action: { id: string; tool: string; sentence: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SakhiConversationDetail extends SakhiConversation {
  messages: SakhiMessage[];
}

export interface SakhiStatus {
  enabled: boolean;
  provider: string;
  voice: boolean;
  budget: { exhausted: boolean };
  disclosure: string;
}

/**
 * Read one SSE response, calling `onEvent` for each frame.
 *
 * Frames are split on a blank line rather than per chunk: a chunk boundary can
 * land in the middle of a JSON payload, and parsing that gives a syntax error
 * on perfectly valid output. The tail is carried over to the next read.
 */
async function readStream(
  path: string,
  body: unknown,
  onEvent: (event: SakhiEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = "Sakhi could not be reached.";
    try {
      const payload = await response.json();
      if (payload?.detail) message = String(payload.detail);
    } catch {
      /* the body was not JSON — keep the default */
    }
    onEvent({ type: "error", message });
    onEvent({ type: "done" });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const frame = buffer.slice(0, split).trim();
      buffer = buffer.slice(split + 2);
      if (frame.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(frame.slice(6)) as SakhiEvent);
        } catch {
          /* a malformed frame is skipped rather than killing the stream */
        }
      }
      split = buffer.indexOf("\n\n");
    }
  }
}

export function sakhiChat(
  text: string,
  conversationId: string | null,
  onEvent: (event: SakhiEvent) => void,
  signal?: AbortSignal,
) {
  return readStream("/sakhi/chat", { text, conversation_id: conversationId }, onEvent, signal);
}

export function sakhiConfirm(
  conversationId: string,
  actionId: string,
  approve: boolean,
  onEvent: (event: SakhiEvent) => void,
  signal?: AbortSignal,
) {
  return readStream(
    "/sakhi/confirm",
    { conversation_id: conversationId, action_id: actionId, approve },
    onEvent,
    signal,
  );
}

export async function apiSakhiStatus(): Promise<SakhiStatus> {
  const { data } = await apiClient.get<SakhiStatus>("/sakhi/status");
  return data;
}

export async function apiSakhiConversations(): Promise<SakhiConversation[]> {
  const { data } = await apiClient.get<SakhiConversation[]>("/sakhi/conversations");
  return data;
}

export async function apiSakhiConversation(id: string): Promise<SakhiConversationDetail> {
  const { data } = await apiClient.get<SakhiConversationDetail>(`/sakhi/conversations/${id}`);
  return data;
}

export async function apiSakhiDelete(id: string): Promise<void> {
  await apiClient.delete(`/sakhi/conversations/${id}`);
}

export interface MouthFrame {
  at: number;
  open: number;
  wide: number;
  round: number;
}

export interface SakhiSpeech {
  audio: string;
  mime: string;
  duration_ms: number;
  mouth: MouthFrame[];
  voice: string;
}

/**
 * Ask for one line spoken aloud, with the mouth track that matches it.
 *
 * Audio and timings arrive together deliberately — the browser has to start
 * both at the same instant, and a second round trip for the timings would
 * guarantee they drift apart.
 */
export async function apiSakhiSpeak(text: string, locale?: string): Promise<SakhiSpeech> {
  const { data } = await apiClient.post<SakhiSpeech>("/sakhi/speak", { text, locale });
  return data;
}

export interface SakhiMemoryItem {
  id: string;
  fact: string;
  created_at: string | null;
}

export async function apiSakhiMemory(): Promise<SakhiMemoryItem[]> {
  const { data } = await apiClient.get<SakhiMemoryItem[]>("/sakhi/memory");
  return data;
}

export async function apiSakhiForget(id?: string): Promise<void> {
  await apiClient.delete(id ? `/sakhi/memory/${id}` : "/sakhi/memory");
}
