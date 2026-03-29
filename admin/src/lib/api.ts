import type {
  AdminOverview,
  CompletedTaskInsightRecord,
  ReferralInsightRecord,
  TaskRecord,
  UserDetailResponse,
  UserRecord,
  WithdrawalRecord
} from "../../../shared/src/types";
import { auth } from "./firebase";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

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
  getTasks: () => request<{ tasks: TaskRecord[] }>("/api/admin/tasks"),
  getCompletedTasks: () => request<{ completions: CompletedTaskInsightRecord[] }>("/api/admin/completions"),
  createTask: (input: { title: string; description: string; link: string; rewardPaise: number; status: TaskRecord["status"] }) =>
    request<{ task: TaskRecord }>("/api/admin/tasks", { method: "POST", body: input }),
  updateTask: (taskId: string, input: Partial<{ title: string; description: string; link: string; rewardPaise: number; status: TaskRecord["status"] }>) =>
    request<{ task: TaskRecord }>(`/api/admin/tasks/${taskId}`, { method: "PATCH", body: input }),
  deleteTask: (taskId: string) => request<{ ok: boolean }>(`/api/admin/tasks/${taskId}`, { method: "DELETE" }),
  getWithdrawals: () => request<{ withdrawals: WithdrawalRecord[] }>("/api/admin/withdrawals"),
  approveWithdrawal: (withdrawalId: string, adminNote: string | null) =>
    request<{ withdrawal: WithdrawalRecord }>(`/api/admin/withdrawals/${withdrawalId}/approve`, { method: "POST", body: { adminNote } }),
  rejectWithdrawal: (withdrawalId: string, adminNote: string | null) =>
    request<{ withdrawal: WithdrawalRecord }>(`/api/admin/withdrawals/${withdrawalId}/reject`, { method: "POST", body: { adminNote } }),
  getReferrals: () => request<{ referrals: ReferralInsightRecord[] }>("/api/admin/referrals")
};
