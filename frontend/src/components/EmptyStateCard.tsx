import type { UnavailableModule } from "../types/liveDashboard";

interface EmptyStateCardProps {
  data: UnavailableModule;
}

export default function EmptyStateCard({ data }: EmptyStateCardProps) {
  return (
    <div className="empty-state-card">
      <span className="empty-state-label">DATA NOT AVAILABLE</span>
      <p className="empty-state-reason">{data.reason}</p>
      <div className="empty-state-fields">
        {data.unavailable_fields.map((field) => (
          <span key={field} className="field-chip">
            {field}
          </span>
        ))}
      </div>
    </div>
  );
}
