import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { IconChart, IconClose, IconHome, IconMenu, IconUsers } from "./icons";
import RouteErrorBoundary from "./RouteErrorBoundary";
import Topbar from "./Topbar";

// The Assessments hub (/assessments) is now the SINGLE authoritative
// instrument catalogue — grouped, polished instrument cards with live
// completion status. Top navigation is deliberately just three items
// (Overview | Registry | Assessments); there is no dropdown/instrument list
// in the nav itself any more. Every individual assessment page (Child
// Illness History, Screen Time, Physical Activity, Dietary Intake,
// Neurodevelopment) is reached by clicking through the hub — routes/APIs
// for all of them are unchanged, only this nav-level discovery path moved.
const ASSESSMENT_ROUTES = [
  "/assessments",
  "/health-screening",
  "/physical-activity",
  "/screen-time",
  "/dietary-intake",
  "/neurodevelopment",
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAssessmentsActive = ASSESSMENT_ROUTES.includes(location.pathname);

  return (
    <div className="app-shell">
      <header className="app-topnav">
        <div className="topnav-header-row">
          <div className="topnav-brand">
            <span className="topnav-brand-mark">IN</span>
            <div className="topnav-brand-text">
              <div className="topnav-brand-title">ICMR Neurodevelopment Study Dashboard</div>
            </div>
          </div>

          <div className="topnav-status">
            <span className="live-badge">
              <span className="live-badge-dot" />
              Live REDCap data
            </span>
          </div>

          <Topbar />

          <button
            type="button"
            className="mobile-menu-button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <IconClose width={18} height={18} /> : <IconMenu width={18} height={18} />}
          </button>
        </div>

        <nav className="topnav-links">
          <NavLink to="/" end className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            <IconHome width={15} height={15} />
            Overview
          </NavLink>
          <NavLink to="/registry" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            <IconUsers width={15} height={15} />
            Registry
          </NavLink>
          <NavLink to="/assessments" className={() => `topnav-link${isAssessmentsActive ? " active" : ""}`}>
            <IconChart width={15} height={15} />
            Assessments
          </NavLink>
        </nav>

        {mobileOpen && (
          <nav className="topnav-mobile-menu">
            <NavLink to="/" end className={({ isActive }) => `topnav-mobile-link${isActive ? " active" : ""}`}>
              Overview
            </NavLink>
            <NavLink to="/registry" className={({ isActive }) => `topnav-mobile-link${isActive ? " active" : ""}`}>
              Registry
            </NavLink>
            <NavLink to="/assessments" className={() => `topnav-mobile-link${isAssessmentsActive ? " active" : ""}`}>
              Assessments
            </NavLink>
          </nav>
        )}
      </header>

      <main className="app-content">
        <RouteErrorBoundary key={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
