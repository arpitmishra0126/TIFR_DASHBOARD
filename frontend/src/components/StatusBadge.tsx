interface StatusBadgeProps {
  label: string;
  tone: "good" | "neutral" | "warning" | "critical";
}

export default function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${tone}`}>
      <span className="status-badge-dot" />
      {label}
    </span>
  );
}
