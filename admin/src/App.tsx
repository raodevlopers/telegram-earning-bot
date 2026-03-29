import { useEffect, useState } from "react";
import { ADMIN_POLL_INTERVAL_MS } from "../../shared/src/constants";
import { formatDateTime, formatRupeesFromPaise } from "../../shared/src/format";
import type { AdminOverview, ReferralInsightRecord, TaskRecord, UserDetailResponse, UserRecord, WithdrawalRecord } from "../../shared/src/types";
import { LoginView } from "./components/LoginView";
import { StatCard } from "./components/StatCard";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { ReferralsTab } from "./components/tabs/ReferralsTab";
import { TasksTab } from "./components/tabs/TasksTab";
import { UsersTab } from "./components/tabs/UsersTab";
import { WithdrawalsTab } from "./components/tabs/WithdrawalsTab";
import { api } from "./lib/api";

type TabId = "overview" | "tasks" | "users" | "withdrawals" | "referrals";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "users", label: "Users" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "referrals", label: "Referrals" }
];

const emptyTaskForm = {
  title: "",
  description: "",
  link: "",
  rewardRupees: "10",
  status: "active" as TaskRecord["status"]
};

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralInsightRecord[]>([]);

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const session = await api.getSession();
        if (!active) {
          return;
        }
        setAuthenticated(session.authenticated);
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : "Unable to validate admin session.");
        }
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let active = true;

    async function loadData(silent: boolean) {
      if (!silent) {
        setDashboardLoading(true);
      }

      try {
        const [nextOverview, nextUsers, nextTasks, nextWithdrawals, nextReferrals] = await Promise.all([
          api.getOverview(),
          api.getUsers(),
          api.getTasks(),
          api.getWithdrawals(),
          api.getReferrals()
        ]);

        if (!active) {
          return;
        }

        setOverview(nextOverview);
        setUsers(nextUsers.users);
        setTasks(nextTasks.tasks);
        setWithdrawals(nextWithdrawals.withdrawals);
        setReferrals(nextReferrals.referrals);
        setLastUpdated(new Date().toISOString());
        setDashboardError(null);

        if (selectedUserId) {
          void loadUserDetail(selectedUserId);
        }
      } catch (error) {
        if (active) {
          setDashboardError(error instanceof Error ? error.message : "Failed to load dashboard data.");
        }
      } finally {
        if (active && !silent) {
          setDashboardLoading(false);
        }
      }
    }

    void loadData(false);
    const interval = window.setInterval(() => {
      void loadData(true);
    }, ADMIN_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authenticated, selectedUserId]);

  async function loadUserDetail(userId: string) {
    setSelectedUserId(userId);
    setDetailLoading(true);

    try {
      const detail = await api.getUserDetail(userId);
      setSelectedUserDetail(detail);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Failed to load user detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError(null);

    try {
      await api.login(password);
      setAuthenticated(true);
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await api.logout();
    setAuthenticated(false);
    setSelectedUserId(null);
    setSelectedUserDetail(null);
  }

  async function handleTaskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskSaving(true);

    try {
      const rewardPaise = Math.round(Number(taskForm.rewardRupees) * 100);
      if (!Number.isFinite(rewardPaise) || rewardPaise <= 0) {
        throw new Error("Reward must be a valid amount.");
      }

      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        link: taskForm.link.trim(),
        rewardPaise,
        status: taskForm.status
      };

      if (editingTaskId) {
        await api.updateTask(editingTaskId, payload);
      } else {
        await api.createTask(payload);
      }

      setTaskForm(emptyTaskForm);
      setEditingTaskId(null);
      const nextTasks = await api.getTasks();
      setTasks(nextTasks.tasks);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to save task.");
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm("Delete this task? Users who already completed it will keep their rewards.")) {
      return;
    }

    try {
      await api.deleteTask(taskId);
      const nextTasks = await api.getTasks();
      setTasks(nextTasks.tasks);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to delete task.");
    }
  }

  async function handleWithdrawalReview(withdrawalId: string, action: "approve" | "reject") {
    const noteInput = window.prompt("Optional admin note");
    const adminNote = noteInput?.trim() ? noteInput.trim() : null;

    try {
      if (action === "approve") {
        await api.approveWithdrawal(withdrawalId, adminNote);
      } else {
        await api.rejectWithdrawal(withdrawalId, adminNote);
      }

      const [nextOverview, nextWithdrawals] = await Promise.all([api.getOverview(), api.getWithdrawals()]);
      setOverview(nextOverview);
      setWithdrawals(nextWithdrawals.withdrawals);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to review withdrawal.");
    }
  }

  function beginTaskEdit(task: TaskRecord) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      link: task.link,
      rewardRupees: String(task.rewardPaise / 100),
      status: task.status
    });
    setActiveTab("tasks");
  }

  if (sessionLoading) {
    return <div className="loading-screen">Loading admin session...</div>;
  }

  if (!authenticated) {
    return <LoginView loading={authLoading} error={authError} password={password} onPasswordChange={setPassword} onSubmit={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Income Hub</p>
          <h1>Admin Console</h1>
          <p className="sidebar-copy">Monitor task performance, referral growth, and payout risk from one place.</p>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={tab.id === activeTab ? "nav-button active" : "nav-button"} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
            Force refresh
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
            <h2>Telegram earning bot control room</h2>
            <p>Single-origin dashboard with secure cookie auth, Firestore-backed accounting, and auto-refreshing ops data.</p>
          </div>
          <div className="hero-meta">
            <span>{dashboardLoading ? "Syncing..." : "Synced"}</span>
            <strong>{lastUpdated ? formatDateTime(lastUpdated) : "Awaiting first sync"}</strong>
          </div>
        </header>

        {dashboardError ? <div className="alert-banner">{dashboardError}</div> : null}

        {overview ? (
          <div className="stat-grid">
            <StatCard label="Users" value={String(overview.userCount)} tone="blue" />
            <StatCard label="Active tasks" value={String(overview.activeTaskCount)} tone="teal" />
            <StatCard label="Pending withdrawals" value={String(overview.pendingWithdrawalCount)} tone="amber" />
            <StatCard label="Task rewards paid" value={formatRupeesFromPaise(overview.totalTaskRewardsPaise)} tone="coral" />
          </div>
        ) : null}

        {activeTab === "overview" ? <OverviewTab overview={overview} referrals={referrals} withdrawals={withdrawals} /> : null}
        {activeTab === "tasks" ? (
          <TasksTab
            tasks={tasks}
            taskForm={taskForm}
            editingTaskId={editingTaskId}
            saving={taskSaving}
            onChange={setTaskForm}
            onSubmit={handleTaskSubmit}
            onCancelEdit={() => {
              setEditingTaskId(null);
              setTaskForm(emptyTaskForm);
            }}
            onEdit={beginTaskEdit}
            onDelete={(taskId) => void handleDeleteTask(taskId)}
          />
        ) : null}
        {activeTab === "users" ? <UsersTab users={users} selectedUserDetail={selectedUserDetail} detailLoading={detailLoading} onSelectUser={(userId) => void loadUserDetail(userId)} /> : null}
        {activeTab === "withdrawals" ? <WithdrawalsTab withdrawals={withdrawals} onReview={(id, action) => void handleWithdrawalReview(id, action)} /> : null}
        {activeTab === "referrals" ? <ReferralsTab referrals={referrals} /> : null}
      </main>
    </div>
  );
}
