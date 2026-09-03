import { Link } from "react-router-dom";

/** Placed above the PageHeader on every instrument detail page — returns
 * directly to the Assessment Hub. Does not touch browser history (a plain
 * route Link, not history.back()), so it behaves the same regardless of how
 * the page was reached. */
export default function BackToAssessments() {
  return (
    <Link to="/assessments" className="back-link">
      ← Back to Assessments
    </Link>
  );
}
