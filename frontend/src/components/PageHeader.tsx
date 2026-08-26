interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export default function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <div className="page-header">
      {eyebrow && (
        <div className="page-header-eyebrow">
          <span className="page-header-eyebrow-mark" />
          {eyebrow}
        </div>
      )}
      <h1>{title}</h1>
      {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
    </div>
  );
}
