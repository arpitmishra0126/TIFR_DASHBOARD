interface SectionHeaderProps {
  title: string;
  note?: string;
}

export default function SectionHeader({ title, note }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {note && <span className="section-header-note">{note}</span>}
    </div>
  );
}
