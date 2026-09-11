interface FullScreenLoaderProps {
  message: string;
}

/**
 * The single, shared full-viewport loading state for the whole app - shown
 * while a page's live REDCap fetch is in flight. Covers the entire
 * viewport (including the header/nav, which stay mounted underneath but
 * are visually hidden by this overlay) so no partial/half-loaded chrome is
 * ever visible. No sub-status text, no artificial delay - callers render
 * this only for as long as their own data is actually null.
 */
export default function FullScreenLoader({ message }: FullScreenLoaderProps) {
  return (
    <div className="fullscreen-loader" role="status" aria-live="polite">
      <div className="fullscreen-loader-spinner" aria-hidden="true" />
      <div className="fullscreen-loader-text">{message}</div>
    </div>
  );
}
