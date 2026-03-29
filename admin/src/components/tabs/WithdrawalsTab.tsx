import { formatDateTime, formatRupeesFromPaise } from "../../../../shared/src/format";
import type { WithdrawalRecord } from "../../../../shared/src/types";
import { formatUsername } from "../../lib/presenters";
import { Panel } from "../Panel";

type WithdrawalsTabProps = {
  withdrawals: WithdrawalRecord[];
  onReview: (withdrawalId: string, action: "approve" | "reject") => void;
};

export function WithdrawalsTab({ withdrawals, onReview }: WithdrawalsTabProps) {
  return (
    <Panel title="Withdrawal queue" subtitle="Approvals leave the hold in place. Rejections refund the user balance automatically.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>
                  <strong>{withdrawal.displayName}</strong>
                  <span>{formatUsername(withdrawal.username)}</span>
                </td>
                <td>{formatRupeesFromPaise(withdrawal.amountPaise)}</td>
                <td>
                  {withdrawal.payoutType} · {withdrawal.payoutValue}
                </td>
                <td>
                  <span
                    className={
                      withdrawal.status === "approved"
                        ? "status-pill success"
                        : withdrawal.status === "rejected"
                          ? "status-pill danger"
                          : "status-pill pending"
                    }
                  >
                    {withdrawal.status}
                  </span>
                </td>
                <td>{formatDateTime(withdrawal.requestedAt)}</td>
                <td className="action-row">
                  {withdrawal.status === "pending" ? (
                    <>
                      <button type="button" className="text-button" onClick={() => onReview(withdrawal.id, "approve")}>
                        Approve
                      </button>
                      <button type="button" className="text-button danger" onClick={() => onReview(withdrawal.id, "reject")}>
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="muted-label">Reviewed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
