import type {
  AdminOverview,
  CompletedTaskInsightRecord,
  ReferralInsightRecord,
  TaskImageRecord,
  TaskRecord,
  UserDetailResponse,
  UserRecord,
  WithdrawalRecord
} from "../../../shared/src/types";
import { auth } from "./firebase";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

const API_BASE_URL_STORAGE_KEY = "income_hub_api_base_url";
const ENV_API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "");

function normalizeBaseUrl(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function getSameOriginApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const { origin, hostname } = window.location;
  if (hostname === "localhost" || hostname.endsWith(".up.railway.app")) {
    return origin;
  }

  return "";
}

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return ENV_API_BASE_URL;
  }

  const stored = normalizeBaseUrl(window.localStorage.getItem(API_BASE_URL_STORAGE_KEY));
  return stored || ENV_API_BASE_URL || getSameOriginApiBaseUrl();
}

export function saveApiBaseUrl(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeBaseUrl(value);
  if (!normalized) {
    window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
}

export function clearApiBaseUrl() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const apiBaseUrl = getApiBaseUrl();
  const requestUrl = `${apiBaseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...(options.headers ?? {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const baseUrlLabel = apiBaseUrl || "current origin";
      throw new Error(`Could not reach the admin API at ${baseUrlLabel}. Update the backend URL in the admin panel and try again.`);
    }

    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload as T;
}

export const api = {
  getOverview: () => request<AdminOverview>("/api/admin/overview"),
  getUsers: () => request<{ users: UserRecord[] }>("/api/admin/users"),
  getUserDetail: (userId: string) => request<UserDetailResponse>(`/api/admin/users/${userId}`),
  adjustUserBalance: (userId: string, input: { amountPaise: number; note: string }) =>
    request<{ user: UserRecord }>(`/api/admin/users/${userId}/balance`, { method: "POST", body: input }),
  getTasks: () => request<{ tasks: TaskRecord[] }>("/api/admin/tasks"),
  getCompletedTasks: () => request<{ completions: CompletedTaskInsightRecord[] }>("/api/admin/completions"),
  uploadImage: (input: { imageData: string; fileName?: string }) =>
    request<{ image: TaskImageRecord }>("/api/admin/uploads/image", { method: "POST", body: input }),
  createTask: (input: {
    taskType: TaskRecord["taskType"];
    title: string;
    description: string;
    link: string;
    caption: string | null;
    galleryImages: TaskImageRecord[];
    timerSeconds: number;
    proofRequired: boolean;
    rewardPaise: number;
    status: TaskRecord["status"];
  }) =>
    request<{ task: TaskRecord }>("/api/admin/tasks", { method: "POST", body: input }),
  updateTask: (
    taskId: string,
    input: Partial<{
      taskType: TaskRecord["taskType"];
      title: string;
      description: string;
      link: string;
      caption: string | null;
      galleryImages: TaskImageRecord[];
      timerSeconds: number;
      proofRequired: boolean;
      rewardPaise: number;
      status: TaskRecord["status"];
    }>
  ) =>
    request<{ task: TaskRecord }>(`/api/admin/tasks/${taskId}`, { method: "PATCH", body: input }),
  deleteTask: (taskId: string) => request<{ ok: boolean }>(`/api/admin/tasks/${taskId}`, { method: "DELETE" }),
  getWithdrawals: () => request<{ withdrawals: WithdrawalRecord[] }>("/api/admin/withdrawals"),
  approveWithdrawal: (withdrawalId: string, adminNote: string | null) =>
    request<{ withdrawal: WithdrawalRecord }>(`/api/admin/withdrawals/${withdrawalId}/approve`, { method: "POST", body: { adminNote } }),
  rejectWithdrawal: (withdrawalId: string, adminNote: string | null) =>
    request<{ withdrawal: WithdrawalRecord }>(`/api/admin/withdrawals/${withdrawalId}/reject`, { method: "POST", body: { adminNote } }),
  getReferrals: () => request<{ referrals: ReferralInsightRecord[] }>("/api/admin/referrals")
};
