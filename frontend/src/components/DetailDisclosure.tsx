import type { ReactNode } from "react";

interface DetailDisclosureProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Secondary/reference material (an exact-value table) tucked behind a
 * native disclosure toggle, so the analytical visual stays the primary
 * thing a reader sees while the underlying numbers stay one click away. */
export default function DetailDisclosure({ summary, children, defaultOpen = false }: DetailDisclosureProps) {
  return (
    <details className="detail-disclosure" open={defaultOpen}>
      <summary className="detail-disclosure-summary">{summary}</summary>
      <div className="detail-disclosure-body">{children}</div>
    </details>
  );
}
