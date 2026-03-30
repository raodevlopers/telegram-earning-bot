import { formatDateTime, formatRupeesFromPaise, formatTaskType } from "../../../../shared/src/format";
import type { CompletedTaskInsightRecord } from "../../../../shared/src/types";
import { formatUsername } from "../../lib/presenters";
import { Panel } from "../Panel";

type CompletedTasksTabProps = {
  completions: CompletedTaskInsightRecord[];
};

export function CompletedTasksTab({ completions }: CompletedTasksTabProps) {
  return (
    <Panel title="Task proofs & completions" subtitle="See live proof screenshots, task types, and completion state from the bot.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Task</th>
              <th>Type</th>
              <th>Status</th>
              <th>Proof</th>
              <th>Reward</th>
              <th>Started</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {completions.length ? (
              completions.map((completion) => (
                <tr key={completion.id}>
                  <td>
                    <strong>{completion.userDisplayName}</strong>
                    <span>{formatUsername(completion.username)}</span>
                  </td>
                  <td>
                    <strong>{completion.taskTitle}</strong>
                    <span>{completion.taskId}</span>
                  </td>
                  <td>{formatTaskType(completion.taskType)}</td>
                  <td>
                    <span className={completion.status === "completed" ? "status-pill success" : "status-pill pending"}>{completion.status}</span>
                  </td>
                  <td>
                    {completion.proofImageUrl ? (
                      <a href={completion.proofImageUrl} target="_blank" rel="noreferrer" className="proof-link">
                        <img src={completion.proofImageThumbUrl ?? completion.proofImageUrl} alt={`${completion.taskTitle} proof`} className="proof-thumb" />
                      </a>
                    ) : (
                      <span className="muted-label">No proof yet</span>
                    )}
                  </td>
                  <td>{formatRupeesFromPaise(completion.rewardPaise)}</td>
                  <td>{formatDateTime(completion.startedAt)}</td>
                  <td>{formatDateTime(completion.completedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <p className="empty-copy">No completed tasks have been verified yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
