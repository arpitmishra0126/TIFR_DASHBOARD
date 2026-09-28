import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional right-aligned content (e.g. the current dashboard date) -
   * opt-in, every existing caller that omits it renders exactly as
   * before. */
  right?: ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div className="page-header-main">
          {eyebrow && (
            <div className="page-header-eyebrow">
              <span className="page-header-eyebrow-mark" />
              {eyebrow}
            </div>
          )}
          <h1>{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {right && <div className="page-header-right">{right}</div>}
      </div>
    </div>
  );
}
