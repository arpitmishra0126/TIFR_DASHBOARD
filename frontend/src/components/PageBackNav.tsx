import { Link, useNavigate } from "react-router-dom";

/** Rendered once, globally, by Layout.tsx above every non-Overview page's
 * content — not duplicated per page. "Back" uses the router's own history
 * stack (react-router's `navigate(-1)`, not `window.history.back()`) to
 * step back one context; "Back to Home" always goes to Overview regardless
 * of history. */
export default function PageBackNav() {
  const navigate = useNavigate();

  return (
    <div className="page-back-nav">
      <button type="button" className="back-nav-button" onClick={() => navigate(-1)}>
        <span aria-hidden="true">←</span> Back
      </button>
      <Link to="/" className="back-nav-button">
        <span aria-hidden="true">🏠</span> Back to Home
      </Link>
    </div>
  );
}
