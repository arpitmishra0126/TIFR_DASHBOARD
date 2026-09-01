interface DataLoadErrorProps {
  message: string;
  onRetry: () => void;
}

/** Reusable error state for a failed live-data fetch, with a Retry action. */
export default function DataLoadError({ message, onRetry }: DataLoadErrorProps) {
  return (
    <div className="data-load-error">
      <p className="error-text">Could not reach backend: {message}</p>
      <button type="button" className="refresh-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
