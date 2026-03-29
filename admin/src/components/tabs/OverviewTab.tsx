import { formatRupeesFromPaise } from "../../../../shared/src/format";
import type { AdminOverview, ReferralInsightRecord, WithdrawalRecord } from "../../../../shared/src/types";
import { Panel } from "../Panel";

type OverviewTabProps = {
  overview: AdminOverview | null;
  referrals: ReferralInsightRecord[];
  withdrawals: WithdrawalRecord[];
};

export function OverviewTab({ overview, referrals, withdrawals }: OverviewTabProps) {
  const pendingWithdrawals = withdrawals.filter((withdrawal) => withdrawal.status === "pending");

  return (
    <div className="content-grid">
      <Panel title="Operational snapshot" subtitle="High-signal metrics from the live Firestore ledger.">
        <div className="metric-list">
          <div>
            <span>Completed tasks</span>
            <strong>{overview?.completedTaskCount ?? 0}</strong>
          </div>
          <div>
            <span>Rewarded referrals</span>
            <strong>{overview?.rewardedReferralCount ?? 0}</strong>
          </div>
          <div>
            <span>Referral payouts</span>
            <strong>{formatRupeesFromPaise(overview?.totalReferralRewardsPaise ?? 0)}</strong>
          </div>
          <div>
            <span>Approved withdrawals</span>
            <strong>{overview?.approvedWithdrawalCount ?? 0}</strong>
          </div>
          <div>
            <span>Total withdrawn</span>
            <strong>{formatRupeesFromPaise(overview?.totalWithdrawnPaise ?? 0)}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="Pending withdrawals" subtitle="Newest payout requests waiting for manual review.">
        <div className="stack-list">
          {pendingWithdrawals.slice(0, 6).map((withdrawal) => (
            <div key={withdrawal.id} className="list-card">
              <div>
                <strong>{withdrawal.displayName}</strong>
                <span>
                  {withdrawal.payoutType} · {withdrawal.payoutValue}
                </span>
              </div>
              <div className="list-card-meta">
                <strong>{formatRupeesFromPaise(withdrawal.amountPaise)}</strong>
                <span>{new Date(withdrawal.requestedAt).toLocaleString("en-IN")}</span>
              </div>
            </div>
          ))}
          {!pendingWithdrawals.length ? <p className="empty-copy">No pending withdrawals right now.</p> : null}
        </div>
      </Panel>

      <Panel title="Referral pulse" subtitle="Recent referral relationships and payout states.">
        <div className="stack-list">
          {referrals.slice(0, 6).map((referral) => (
            <div key={referral.id} className="list-card">
              <div>
                <strong>{referral.referrerDisplayName}</strong>
                <span>invited {referral.referredDisplayName}</span>
              </div>
              <span className={referral.rewardGranted ? "status-pill success" : "status-pill pending"}>
                {referral.rewardGranted ? "Rewarded" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
