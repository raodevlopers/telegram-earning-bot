import { formatDateTime, formatRupeesFromPaise } from "../../../../shared/src/format";
import type { UserDetailResponse, UserRecord } from "../../../../shared/src/types";
import { formatUsername } from "../../lib/presenters";
import { Panel } from "../Panel";

type UsersTabProps = {
  users: UserRecord[];
  selectedUserDetail: UserDetailResponse | null;
  detailLoading: boolean;
  onSelectUser: (userId: string) => void;
};

export function UsersTab({ users, selectedUserDetail, detailLoading, onSelectUser }: UsersTabProps) {
  return (
    <div className="content-grid users-grid">
      <Panel title="User directory" subtitle="Click a user to inspect wallet activity, withdrawals, and referral state.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Balance</th>
                <th>Tasks</th>
                <th>Referrals</th>
                <th>Risk flags</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="row-clickable" onClick={() => onSelectUser(user.id)}>
                  <td>
                    <strong>{user.displayName}</strong>
                    <span>{formatUsername(user.username)}</span>
                  </td>
                  <td>{formatRupeesFromPaise(user.balancePaise)}</td>
                  <td>{user.completedTaskCount}</td>
                  <td>{user.referralCount}</td>
                  <td>{user.riskFlags.length ? user.riskFlags.join(", ") : "Clear"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Selected user" subtitle={selectedUserDetail ? selectedUserDetail.user.displayName : "Choose a user to inspect"}>
        {detailLoading ? <p className="empty-copy">Loading user detail...</p> : null}
        {!detailLoading && !selectedUserDetail ? <p className="empty-copy">Select a user from the table to open their audit trail.</p> : null}
        {!detailLoading && selectedUserDetail ? (
          <div className="detail-stack">
            <div className="detail-summary">
              <div>
                <span>Balance</span>
                <strong>{formatRupeesFromPaise(selectedUserDetail.user.balancePaise)}</strong>
              </div>
              <div>
                <span>Completed tasks</span>
                <strong>{selectedUserDetail.user.completedTaskCount}</strong>
              </div>
              <div>
                <span>Referral earnings</span>
                <strong>{formatRupeesFromPaise(selectedUserDetail.user.referralEarningsPaise)}</strong>
              </div>
              <div>
                <span>Last active</span>
                <strong>{formatDateTime(selectedUserDetail.user.lastActiveAt)}</strong>
              </div>
            </div>

            <div className="tag-row">
              {selectedUserDetail.user.riskFlags.length ? (
                selectedUserDetail.user.riskFlags.map((flag) => (
                  <span key={flag} className="status-pill pending">
                    {flag}
                  </span>
                ))
              ) : (
                <span className="status-pill success">No risk flags</span>
              )}
            </div>

            <div className="mini-section">
              <h3>Recent wallet transactions</h3>
              <div className="stack-list">
                {selectedUserDetail.walletTransactions.length ? (
                  selectedUserDetail.walletTransactions.slice(0, 6).map((transaction) => (
                    <div key={transaction.id} className="list-card">
                      <div>
                        <strong>{transaction.type}</strong>
                        <span>{transaction.referenceId}</span>
                      </div>
                      <div className="list-card-meta">
                        <strong>{formatRupeesFromPaise(transaction.amountPaise)}</strong>
                        <span>{formatDateTime(transaction.createdAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">No wallet transactions recorded yet.</p>
                )}
              </div>
            </div>

            <div className="mini-section">
              <h3>Withdrawals</h3>
              <div className="stack-list">
                {selectedUserDetail.withdrawals.length ? (
                  selectedUserDetail.withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="list-card">
                      <div>
                        <strong>{withdrawal.id}</strong>
                        <span>
                          {withdrawal.payoutType} | {withdrawal.payoutValue}
                        </span>
                      </div>
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
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">No withdrawals for this user yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
