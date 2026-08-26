import { Component, type ErrorInfo, type ReactNode } from "react";

import StatusBadge from "./StatusBadge";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Contains a render-time crash to the routed content area instead of
 * unmounting the whole app (sidebar/topbar/theme survive). React error
 * boundaries must be class components — there is no hook equivalent.
 *
 * Layout.tsx remounts this per-route (key={location.pathname}), so
 * navigating away from a broken module automatically clears the error;
 * "Try again" below is for retrying the same route without navigating.
 */
export default class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Route content failed to render:", error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="route-error-card">
          <StatusBadge label="Module Unavailable" tone="warning" />
          <p className="route-error-message">
            This module could not load its data. The live REDCap connection or analytics response may be
            temporarily unavailable — no data has been invented in its place.
          </p>
          <button type="button" className="export-button" onClick={this.retry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
