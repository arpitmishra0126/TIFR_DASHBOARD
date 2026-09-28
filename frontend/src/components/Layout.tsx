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

// Nav updated 2026-09-28 for the Dashboard-as-hub redesign: DSEQ / Screen
// Time and Child Health History are now featured as their own top-level
// tabs (they're the two "Key Study Modules" prominently linked from the
// Dashboard hub) alongside the existing Study Questionnaires/Data Quality
// tabs. Every other route (Participants/Registry, Assessments hub,
// Physical Activity, Dietary Intake, Neurodevelopment, etc.) is unchanged
// and still fully reachable by direct URL, same "reachable by URL, not
// nav-linked" precedent already used throughout this app - do not
// reintroduce those tabs here without an explicit instruction.
const HEADER_TABS: HeaderTab[] = [
  { label: "Dashboard", to: "/" },
  { label: "DSEQ / Screen Time", to: "/screen-time" },
  { label: "Child Health History", to: "/health-screening" },
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
