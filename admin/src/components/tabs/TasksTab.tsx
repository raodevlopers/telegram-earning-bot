import type { FormEvent } from "react";
import { formatDateTime, formatRupeesFromPaise, formatTaskType } from "../../../../shared/src/format";
import type { TaskImageRecord, TaskRecord } from "../../../../shared/src/types";
import { Panel } from "../Panel";

type TaskFormState = {
  taskType: TaskRecord["taskType"];
  title: string;
  description: string;
  link: string;
  caption: string;
  timerSeconds: string;
  proofRequired: boolean;
  galleryImages: TaskImageRecord[];
  rewardRupees: string;
  status: TaskRecord["status"];
};

type TasksTabProps = {
  tasks: TaskRecord[];
  taskForm: TaskFormState;
  editingTaskId: string | null;
  saving: boolean;
  imageUploading: boolean;
  onChange: (next: TaskFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImagesSelected: (files: FileList | null) => void;
  onRemoveImage: (imageUrl: string) => void;
  onCancelEdit: () => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (taskId: string) => void;
};

export function TasksTab({
  tasks,
  taskForm,
  editingTaskId,
  saving,
  imageUploading,
  onChange,
  onSubmit,
  onImagesSelected,
  onRemoveImage,
  onCancelEdit,
  onEdit,
  onDelete
}: TasksTabProps) {
  return (
    <div className="content-grid">
      <Panel title={editingTaskId ? "Edit task" : "Create task"} subtitle="Configure review tasks, timed browser visits, captions, and proof screenshots from one place.">
        <form className="task-form" onSubmit={onSubmit}>
          <label>
            Task type
            <select value={taskForm.taskType} onChange={(event) => onChange({ ...taskForm, taskType: event.target.value as TaskRecord["taskType"] })}>
              <option value="maps_review">Google Maps Review</option>
              <option value="site_wait">Website Visit</option>
              <option value="search_visit">Google Search Visit</option>
            </select>
          </label>
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
          <label>
            Caption to copy
            <textarea
              rows={4}
              value={taskForm.caption}
              onChange={(event) => onChange({ ...taskForm, caption: event.target.value })}
              placeholder="Optional caption/review text shown to the user"
            />
          </label>
          <div className="inline-fields">
            <label>
              Timer (seconds)
              <input
                type="number"
                min="1"
                max="600"
                value={taskForm.timerSeconds}
                onChange={(event) => onChange({ ...taskForm, timerSeconds: event.target.value })}
                required
              />
            </label>
            <label>
              Screenshot proof
              <select
                value={taskForm.proofRequired ? "yes" : "no"}
                onChange={(event) => onChange({ ...taskForm, proofRequired: event.target.value === "yes" })}
              >
                <option value="yes">Required</option>
                <option value="no">Optional</option>
              </select>
            </label>
          </div>
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

          <label>
            Reference images
            <input type="file" accept="image/*" multiple onChange={(event) => onImagesSelected(event.target.files)} />
            <small>{imageUploading ? "Uploading images..." : "Upload 2-3 screenshots/photos that users should copy or save."}</small>
          </label>

          {taskForm.galleryImages.length ? (
            <div className="gallery-preview-grid">
              {taskForm.galleryImages.map((image) => (
                <div key={image.url} className="gallery-preview-card">
                  <img src={image.url} alt={image.filename ?? "Task reference"} />
                  <button type="button" className="text-button danger" onClick={() => onRemoveImage(image.url)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

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

      <Panel title="Task library" subtitle="Paused tasks stay in the system but are hidden from user dashboards. Proof screenshots and timer behavior come from the task type you choose.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
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
                  <td>{formatTaskType(task.taskType)}</td>
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
