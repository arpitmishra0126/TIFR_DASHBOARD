import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  IconActivity,
  IconChevron,
  IconClose,
  IconHeart,
  IconHome,
  IconMenu,
  IconMonitor,
  IconProgress,
  IconUsers,
} from "./icons";
import RouteErrorBoundary from "./RouteErrorBoundary";
import Topbar from "./Topbar";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Neurodevelopment keeps its route/API/implementation untouched — it is
// deliberately left out of this nav list only (information-architecture
// decision), not deleted.
const MODULE_NAV: NavItem[] = [
  { to: "/health-screening", label: "Health & Screening", icon: IconHeart },
  { to: "/physical-activity", label: "Physical Activity", icon: IconActivity },
  { to: "/screen-time", label: "Screen Time", icon: IconMonitor },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assessmentsOpen, setAssessmentsOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAssessmentsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!assessmentsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAssessmentsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assessmentsOpen]);

  const isModuleActive = MODULE_NAV.some((item) => item.to === location.pathname);

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

          <div className="topnav-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`topnav-link topnav-dropdown-trigger${isModuleActive ? " active" : ""}`}
              onClick={() => setAssessmentsOpen((v) => !v)}
              aria-expanded={assessmentsOpen}
              aria-haspopup="true"
            >
              Assessments
              <IconChevron
                width={12}
                height={12}
                style={{ transform: assessmentsOpen ? "rotate(-90deg)" : "rotate(90deg)" }}
              />
            </button>
            {assessmentsOpen && (
              <div className="topnav-dropdown-menu">
                {MODULE_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `topnav-dropdown-item${isActive ? " active" : ""}`}
                    >
                      <Icon width={15} height={15} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>

          <NavLink to="/progress" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            <IconProgress width={15} height={15} />
            Progress
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
            <div className="topnav-mobile-section-label">Assessments</div>
            {MODULE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `topnav-mobile-link topnav-mobile-link-indent${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/progress" className={({ isActive }) => `topnav-mobile-link${isActive ? " active" : ""}`}>
              Progress
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
