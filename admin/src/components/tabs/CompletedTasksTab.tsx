import { formatDateTime, formatRupeesFromPaise } from "../../../../shared/src/format";
import type { CompletedTaskInsightRecord } from "../../../../shared/src/types";
import { formatUsername } from "../../lib/presenters";
import { Panel } from "../Panel";

type CompletedTasksTabProps = {
  completions: CompletedTaskInsightRecord[];
};

export function CompletedTasksTab({ completions }: CompletedTasksTabProps) {
  return (
    <Panel title="Completed tasks" subtitle="Recent verified completions across the earning bot.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Task</th>
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
                  <td>{formatRupeesFromPaise(completion.rewardPaise)}</td>
                  <td>{formatDateTime(completion.startedAt)}</td>
                  <td>{formatDateTime(completion.completedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
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
