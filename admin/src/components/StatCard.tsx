type StatCardProps = {
  label: string;
  value: string;
  tone: "teal" | "amber" | "coral" | "blue";
};

export function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
