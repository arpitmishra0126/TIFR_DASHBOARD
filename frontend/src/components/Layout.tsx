import { NavLink, Outlet, useLocation } from "react-router-dom";

import { IconMoon, IconRefresh, IconSun } from "./icons";
import PageBackNav from "./PageBackNav";
import RouteErrorBoundary from "./RouteErrorBoundary";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";

interface HeaderTab {
  label: string;
  to: string;
  /** Other routes (besides `to` itself) that should also light up this tab -
   * same "parent stays active on a child route" precedent used dashboard-
   * wide (e.g. the former sidebar's matchAlso). */
  matchAlso?: string[];
}

// Assessments/Health/Development/Analysis tabs were removed 2026-09-26
// pending a later navigation-structure brainstorm - their routes/pages/
// components are untouched and still fully reachable by direct URL (same
// "reachable by URL, not nav-linked" precedent already used elsewhere in
// this app), only these header tabs were taken out. Do not reintroduce
// them here without an explicit instruction on the finalized structure.
//
// "Participants" was swapped for "Data Quality" the same day (explicit
// instruction) - the Participant Registry page/route (/registry) is
// completely unchanged and still fully functional, just no longer linked
// from this header; it remains reachable by direct URL, same precedent as
// the tabs above.
const HEADER_TABS: HeaderTab[] = [
  { label: "Dashboard", to: "/" },
  { label: "Study Questionnaires", to: "/study-questionnaires" },
  { label: "Data Quality", to: "/data-quality" },
];

export default function Layout() {
  const location = useLocation();
  const { refresh, refreshing, lastUpdated, error } = useRefresh();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell">
      <div className="app-main">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-header-top-row">
              <div className="app-header-text">
                <div className="app-header-eyebrow">Neurodevelopmental Follow-up Study</div>
                <h1 className="app-header-title">ICMR Neurodevelopment Study</h1>
                <p className="app-header-subtitle">Live study overview and participant assessment monitoring</p>
              </div>

              <div className="app-header-controls">
                <span className="live-badge">
                  <span className="live-badge-dot" />
                  Live REDCap data
                </span>
                {lastUpdated && (
                  <span className="last-updated">
                    {lastUpdated.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                )}
                {error && <span className="refresh-error">Refresh failed: {error}</span>}
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                  aria-busy={refreshing}
                >
                  <span className={`refresh-icon${refreshing ? " spinning" : ""}`}>
                    <IconRefresh width={15} height={15} />
                  </span>
                  <span className="refresh-button-label">{refreshing ? "Refreshing…" : "Refresh data"}</span>
                </button>
                <button
                  type="button"
                  className="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                  title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                >
                  {theme === "light" ? <IconMoon width={15} height={15} /> : <IconSun width={15} height={15} />}
                </button>
              </div>
            </div>

            <nav className="app-header-tabs">
              {HEADER_TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === "/"}
                  className={({ isActive }) => {
                    const active = isActive || (tab.matchAlso ?? []).includes(location.pathname);
                    return `app-header-tab${active ? " active" : ""}`;
                  }}
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="app-content">
          {location.pathname !== "/" && <PageBackNav />}
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
