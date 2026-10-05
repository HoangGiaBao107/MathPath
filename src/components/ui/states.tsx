import { Button } from "./button";

type StateProps = {
  title: string;
  description: string;
};

export function LoadingState({ title, description }: StateProps) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <div className="state-panel">
      <span className="state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path
            d="M4 19.5h16M6.5 16V8m5.5 8V4m5.5 12v-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

type ErrorStateProps = StateProps & {
  onRetry?: () => void;
};

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="state-panel" role="alert">
      <span className="state-icon state-icon--error" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path
            d="M12 8v5m0 3.5h.01M10.3 4.9 2.8 18a1.8 1.8 0 0 0 1.6 2.7h15.2a1.8 1.8 0 0 0 1.6-2.7L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="small" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
