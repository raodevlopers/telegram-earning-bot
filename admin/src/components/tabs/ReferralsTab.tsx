import { formatDateTime } from "../../../../shared/src/format";
import type { ReferralInsightRecord } from "../../../../shared/src/types";
import { formatUsername } from "../../lib/presenters";
import { Panel } from "../Panel";

type ReferralsTabProps = {
  referrals: ReferralInsightRecord[];
};

export function ReferralsTab({ referrals }: ReferralsTabProps) {
  return (
    <Panel title="Referral ledger" subtitle="Rewards are credited after the invited user finishes their first successful task.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Referrer</th>
              <th>Referred user</th>
              <th>Status</th>
              <th>Created</th>
              <th>Rewarded</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((referral) => (
              <tr key={referral.id}>
                <td>
                  <strong>{referral.referrerDisplayName}</strong>
                  <span>{formatUsername(referral.referrerUsername)}</span>
                </td>
                <td>
                  <strong>{referral.referredDisplayName}</strong>
                  <span>{formatUsername(referral.referredUsername)}</span>
                </td>
                <td>
                  <span className={referral.rewardGranted ? "status-pill success" : "status-pill pending"}>
                    {referral.rewardGranted ? "Rewarded" : "Pending"}
                  </span>
                </td>
                <td>{formatDateTime(referral.createdAt)}</td>
                <td>{formatDateTime(referral.rewardedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
