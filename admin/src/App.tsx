import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ADMIN_POLL_INTERVAL_MS } from "../../shared/src/constants";
import { formatDateTime, formatRupeesFromPaise } from "../../shared/src/format";
import type {
  AdminOverview,
  CompletedTaskInsightRecord,
  ReferralInsightRecord,
  TaskImageRecord,
  TaskRecord,
  UserDetailResponse,
  UserRecord,
  WithdrawalRecord
} from "../../shared/src/types";
import { LoginView } from "./components/LoginView";
import { StatCard } from "./components/StatCard";
import { CompletedTasksTab } from "./components/tabs/CompletedTasksTab";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { ReferralsTab } from "./components/tabs/ReferralsTab";
import { TasksTab } from "./components/tabs/TasksTab";
import { UsersTab } from "./components/tabs/UsersTab";
import { WithdrawalsTab } from "./components/tabs/WithdrawalsTab";
import { api, clearApiBaseUrl, getApiBaseUrl, saveApiBaseUrl } from "./lib/api";
import { ADMIN_LOGIN, auth } from "./lib/firebase";

type TabId = "overview" | "tasks" | "users" | "completed" | "withdrawals" | "referrals";
type ThemeMode = "dark" | "light";
type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "users", label: "Users" },
  { id: "completed", label: "Completed Tasks" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "referrals", label: "Referrals" }
];

const emptyTaskForm = {
  taskType: "maps_review" as TaskRecord["taskType"],
  title: "",
  description: "",
  link: "",
  caption: "",
  timerSeconds: "30",
  proofRequired: true,
  galleryImages: [] as TaskImageRecord[],
  rewardRupees: "10",
  status: "active" as TaskRecord["status"]
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

const THEME_STORAGE_KEY = "income-hub-admin-theme";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function getSavedTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "light" ? "light" : "dark";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect admin credentials.";
      case "auth/too-many-requests":
        return "Too many login attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":
        return "Network request failed. Check your connection and try again.";
      default:
        break;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [username, setUsername] = useState(ADMIN_LOGIN.username);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(getApiBaseUrl);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskInsightRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralInsightRecord[]>([]);

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskImageUploading, setTaskImageUploading] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState("0");
  const [balanceAdjustNote, setBalanceAdjustNote] = useState("");
  const [balanceAdjustSaving, setBalanceAdjustSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthenticated(Boolean(user));
      setAuthEmail(user?.email ?? null);
      setAuthReady(true);

      if (!user) {
        setOverview(null);
        setUsers([]);
        setTasks([]);
        setCompletedTasks([]);
        setWithdrawals([]);
        setReferrals([]);
        setSelectedUserId(null);
        setSelectedUserDetail(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  async function loadUserDetail(
    userId: string,
    options: {
      updateSelection?: boolean;
      silent?: boolean;
    } = {}
  ) {
    const { updateSelection = true, silent = false } = options;

    if (updateSelection) {
      setSelectedUserId(userId);
    }

    if (!silent) {
      setDetailLoading(true);
    }

    try {
      const detail = await api.getUserDetail(userId);
      setSelectedUserDetail(detail);
      setBalanceAdjustAmount("0");
      setBalanceAdjustNote("");
    } catch (error) {
      setDashboardError(getErrorMessage(error, "Failed to load user detail."));
    } finally {
      if (!silent) {
        setDetailLoading(false);
      }
    }
  }

  async function refreshDashboard(silent: boolean) {
    if (!silent) {
      setDashboardLoading(true);
    }

    try {
      const [nextOverview, nextUsers, nextTasks, nextCompletions, nextWithdrawals, nextReferrals] = await Promise.all([
        api.getOverview(),
        api.getUsers(),
        api.getTasks(),
        api.getCompletedTasks(),
        api.getWithdrawals(),
        api.getReferrals()
      ]);

      setOverview(nextOverview);
      setUsers(nextUsers.users);
      setTasks(nextTasks.tasks);
      setCompletedTasks(nextCompletions.completions);
      setWithdrawals(nextWithdrawals.withdrawals);
      setReferrals(nextReferrals.referrals);
      setLastUpdated(new Date().toISOString());
      setDashboardError(null);

      if (selectedUserId) {
        void loadUserDetail(selectedUserId, { updateSelection: false, silent: true });
      }
    } catch (error) {
      setDashboardError(getErrorMessage(error, "Failed to load dashboard data."));
    } finally {
      if (!silent) {
        setDashboardLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let active = true;

    async function syncDashboard(silent: boolean) {
      if (!active) {
        return;
      }

      await refreshDashboard(silent);
    }

    void syncDashboard(false);
    const interval = window.setInterval(() => {
      void syncDashboard(true);
    }, ADMIN_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authenticated, selectedUserId]);

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (normalizeUsername(username) !== normalizeUsername(ADMIN_LOGIN.username)) {
        throw new Error("Use the configured admin username to access this panel.");
      }

      await signInWithEmailAndPassword(auth, ADMIN_LOGIN.email, password);
      setPassword("");
      setToast({ tone: "success", message: "Admin session secured successfully." });
    } catch (error) {
      setAuthError(getErrorMessage(error, "Login failed."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setAuthError(null);
    setPassword("");
    setToast({ tone: "success", message: "Signed out of the admin console." });
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskSaving(true);

    try {
      const rewardPaise = Math.round(Number(taskForm.rewardRupees) * 100);
      if (!Number.isFinite(rewardPaise) || rewardPaise <= 0) {
        throw new Error("Reward must be a valid amount.");
      }

      const payload = {
        taskType: taskForm.taskType,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        link: taskForm.link.trim(),
        caption: taskForm.caption.trim() || null,
        galleryImages: taskForm.galleryImages,
        timerSeconds: Math.max(1, Number(taskForm.timerSeconds) || 30),
        proofRequired: taskForm.proofRequired,
        rewardPaise,
        status: taskForm.status
      };

      if (editingTaskId) {
        await api.updateTask(editingTaskId, payload);
        setToast({ tone: "success", message: "Task updated successfully." });
      } else {
        await api.createTask(payload);
        setToast({ tone: "success", message: "Task created successfully." });
      }

      setTaskForm(emptyTaskForm);
      setEditingTaskId(null);
      await refreshDashboard(true);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to save task.");
      setDashboardError(message);
      setToast({ tone: "error", message });
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleTaskImagesSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setTaskImageUploading(true);
    try {
      const nextImages = [...taskForm.galleryImages];
      for (const file of Array.from(fileList).slice(0, 3)) {
        const imageData = await fileToDataUrl(file);
        const uploaded = await api.uploadImage({ imageData, fileName: file.name });
        nextImages.push(uploaded.image);
      }

      setTaskForm((current) => ({
        ...current,
        galleryImages: nextImages.slice(0, 6)
      }));
      setToast({ tone: "success", message: "Task images uploaded successfully." });
    } catch (error) {
      const message = getErrorMessage(error, "Unable to upload task images.");
      setDashboardError(message);
      setToast({ tone: "error", message });
    } finally {
      setTaskImageUploading(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm("Delete this task? Users who already completed it will keep their rewards.")) {
      return;
    }

    try {
      await api.deleteTask(taskId);
      setToast({ tone: "success", message: "Task deleted successfully." });
      await refreshDashboard(true);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to delete task.");
      setDashboardError(message);
      setToast({ tone: "error", message });
    }
  }

  async function handleWithdrawalReview(withdrawalId: string, action: "approve" | "reject") {
    const noteInput = window.prompt("Optional admin note");
    const adminNote = noteInput?.trim() ? noteInput.trim() : null;

    try {
      if (action === "approve") {
        await api.approveWithdrawal(withdrawalId, adminNote);
        setToast({ tone: "success", message: "Withdrawal approved successfully." });
      } else {
        await api.rejectWithdrawal(withdrawalId, adminNote);
        setToast({ tone: "success", message: "Withdrawal rejected and refunded." });
      }

      await refreshDashboard(true);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to review withdrawal.");
      setDashboardError(message);
      setToast({ tone: "error", message });
    }
  }

  function beginTaskEdit(task: TaskRecord) {
    setEditingTaskId(task.id);
    setTaskForm({
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      link: task.link,
      caption: task.caption ?? "",
      timerSeconds: String(task.timerSeconds),
      proofRequired: task.proofRequired,
      galleryImages: task.galleryImages,
      rewardRupees: String(task.rewardPaise / 100),
      status: task.status
    });
    setActiveTab("tasks");
  }

  function handleSaveApiBaseUrl() {
    const value = apiBaseUrlInput.trim();
    if (!value) {
      clearApiBaseUrl();
      setApiBaseUrlInput(getApiBaseUrl());
      setToast({ tone: "success", message: "Backend URL override cleared. Using default resolution again." });
      return;
    }

    saveApiBaseUrl(value);
    setApiBaseUrlInput(getApiBaseUrl());
    setToast({ tone: "success", message: "Backend URL saved successfully." });
    if (authenticated) {
      void refreshDashboard(false);
    }
  }

  async function handleAdjustBalance() {
    if (!selectedUserId) {
      return;
    }

    const amountPaise = Math.round(Number(balanceAdjustAmount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise === 0) {
      setToast({ tone: "error", message: "Enter a non-zero amount to increase or decrease the balance." });
      return;
    }

    if (!balanceAdjustNote.trim()) {
      setToast({ tone: "error", message: "Add a short admin note for the wallet adjustment." });
      return;
    }

    setBalanceAdjustSaving(true);
    try {
      await api.adjustUserBalance(selectedUserId, {
        amountPaise,
        note: balanceAdjustNote.trim()
      });
      setToast({ tone: "success", message: "User balance updated successfully." });
      await refreshDashboard(true);
      await loadUserDetail(selectedUserId, { updateSelection: false });
      setBalanceAdjustAmount("0");
      setBalanceAdjustNote("");
    } catch (error) {
      const message = getErrorMessage(error, "Unable to adjust user balance.");
      setDashboardError(message);
      setToast({ tone: "error", message });
    } finally {
      setBalanceAdjustSaving(false);
    }
  }

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner-card">
          <span className="spinner" />
          <strong>Preparing secure admin console...</strong>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <LoginView
        loading={authLoading}
        error={authError}
        username={username}
        password={password}
        backendUrl={apiBaseUrlInput}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onBackendUrlChange={setApiBaseUrlInput}
        onSaveBackendUrl={handleSaveApiBaseUrl}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="app-shell">
      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}

      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <p className="eyebrow">Income Hub</p>
            <h1>Admin Console</h1>
            <p className="sidebar-copy">Monitor task performance, referral growth, withdrawals, and user activity from one secure dashboard.</p>
          </div>

          <div className="sidebar-admin-card">
            <span>Signed in as</span>
            <strong>{ADMIN_LOGIN.username}</strong>
            <small>{authEmail ?? "Firebase admin session"}</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={tab.id === activeTab ? "nav-button active" : "nav-button"} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <label>
            Backend API URL
            <input
              type="url"
              value={apiBaseUrlInput}
              onChange={(event) => setApiBaseUrlInput(event.target.value)}
              placeholder="https://your-backend.up.railway.app"
            />
          </label>
          <button className="secondary-button" type="button" onClick={handleSaveApiBaseUrl}>
            Save backend URL
          </button>
          <button className="secondary-button" type="button" onClick={() => void refreshDashboard(false)}>
            Refresh now
          </button>
          <button className="secondary-button" type="button" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
            Switch to {theme === "dark" ? "light" : "dark"} theme
          </button>
          <button className="ghost-button" type="button" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Live operations</p>
            <h2>Telegram earning bot command center</h2>
            <p>Firebase Auth secures the admin entry point, while Railway-backed APIs keep task management and wallet operations consistent.</p>
          </div>
          <div className="hero-meta">
            <span>{dashboardLoading ? "Syncing data" : "Live status"}</span>
            <strong>{lastUpdated ? formatDateTime(lastUpdated) : "Awaiting first sync"}</strong>
            <p className="sync-indicator">{dashboardLoading ? "Pulling the latest Firestore state..." : "Auto-refresh enabled every 20 seconds."}</p>
          </div>
        </header>

        {dashboardError ? <div className="alert-banner">{dashboardError}</div> : null}

        {overview ? (
          <div className="stat-grid">
            <StatCard label="Total users" value={String(overview.userCount)} tone="blue" />
            <StatCard label="Total earnings" value={formatRupeesFromPaise(overview.totalEarningsPaise)} tone="teal" />
            <StatCard label="Total tasks" value={String(overview.totalTaskCount)} tone="amber" />
            <StatCard label="Pending withdrawals" value={String(overview.pendingWithdrawalCount)} tone="coral" />
          </div>
        ) : null}

        {!overview && dashboardLoading ? (
          <div className="panel panel-loading">
            <span className="spinner" />
            <p className="empty-copy">Loading your live admin metrics...</p>
          </div>
        ) : null}

        {activeTab === "overview" ? <OverviewTab overview={overview} referrals={referrals} withdrawals={withdrawals} /> : null}
        {activeTab === "tasks" ? (
          <TasksTab
            tasks={tasks}
            taskForm={taskForm}
            editingTaskId={editingTaskId}
            saving={taskSaving}
            imageUploading={taskImageUploading}
            onChange={setTaskForm}
            onSubmit={handleTaskSubmit}
            onImagesSelected={(fileList) => void handleTaskImagesSelected(fileList)}
            onRemoveImage={(imageUrl) =>
              setTaskForm((current) => ({
                ...current,
                galleryImages: current.galleryImages.filter((image) => image.url !== imageUrl)
              }))
            }
            onCancelEdit={() => {
              setEditingTaskId(null);
              setTaskForm(emptyTaskForm);
            }}
            onEdit={beginTaskEdit}
            onDelete={(taskId) => void handleDeleteTask(taskId)}
          />
        ) : null}
        {activeTab === "users" ? (
          <UsersTab
            users={users}
            selectedUserDetail={selectedUserDetail}
            detailLoading={detailLoading}
            onSelectUser={(userId) => void loadUserDetail(userId)}
            balanceAdjustAmount={balanceAdjustAmount}
            balanceAdjustNote={balanceAdjustNote}
            balanceAdjustSaving={balanceAdjustSaving}
            onBalanceAdjustAmountChange={setBalanceAdjustAmount}
            onBalanceAdjustNoteChange={setBalanceAdjustNote}
            onAdjustBalance={() => void handleAdjustBalance()}
          />
        ) : null}
        {activeTab === "completed" ? <CompletedTasksTab completions={completedTasks} /> : null}
        {activeTab === "withdrawals" ? <WithdrawalsTab withdrawals={withdrawals} onReview={(id, action) => void handleWithdrawalReview(id, action)} /> : null}
        {activeTab === "referrals" ? <ReferralsTab referrals={referrals} /> : null}
      </main>
    </div>
  );
}
