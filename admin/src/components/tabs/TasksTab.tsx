import type { FormEvent } from "react";
import { formatDateTime, formatRupeesFromPaise } from "../../../../shared/src/format";
import type { TaskRecord } from "../../../../shared/src/types";
import { Panel } from "../Panel";

type TaskFormState = {
  title: string;
  description: string;
  link: string;
  rewardRupees: string;
  status: TaskRecord["status"];
};

type TasksTabProps = {
  tasks: TaskRecord[];
  taskForm: TaskFormState;
  editingTaskId: string | null;
  saving: boolean;
  onChange: (next: TaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (taskId: string) => void;
};

export function TasksTab({
  tasks,
  taskForm,
  editingTaskId,
  saving,
  onChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete
}: TasksTabProps) {
  return (
    <div className="content-grid">
      <Panel title={editingTaskId ? "Edit task" : "Create task"} subtitle="Tasks are shown to users once and pay out through the transaction ledger.">
        <form className="task-form" onSubmit={onSubmit}>
          <label>
            Title
            <input value={taskForm.title} onChange={(event) => onChange({ ...taskForm, title: event.target.value })} required />
          </label>
          <label>
            Description
            <textarea rows={5} value={taskForm.description} onChange={(event) => onChange({ ...taskForm, description: event.target.value })} required />
          </label>
          <label>
            Link
            <input type="url" value={taskForm.link} onChange={(event) => onChange({ ...taskForm, link: event.target.value })} required />
          </label>
          <div className="inline-fields">
            <label>
              Reward (INR)
              <input
                type="number"
                min="1"
                step="0.01"
                value={taskForm.rewardRupees}
                onChange={(event) => onChange({ ...taskForm, rewardRupees: event.target.value })}
                required
              />
            </label>
            <label>
              Status
              <select value={taskForm.status} onChange={(event) => onChange({ ...taskForm, status: event.target.value as TaskRecord["status"] })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit">{saving ? "Saving..." : editingTaskId ? "Update task" : "Create task"}</button>
            {editingTaskId ? (
              <button type="button" className="secondary-button" onClick={onCancelEdit}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Task library" subtitle="Paused tasks stay in the system but are hidden from user dashboards.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Reward</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    <span>{task.description}</span>
                  </td>
                  <td>{formatRupeesFromPaise(task.rewardPaise)}</td>
                  <td>
                    <span className={task.status === "active" ? "status-pill success" : "status-pill muted"}>{task.status}</span>
                  </td>
                  <td>{formatDateTime(task.updatedAt)}</td>
                  <td className="action-row">
                    <button type="button" className="text-button" onClick={() => onEdit(task)}>
                      Edit
                    </button>
                    <button type="button" className="text-button danger" onClick={() => onDelete(task.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
