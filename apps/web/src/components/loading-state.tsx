export function LoadingState({
  label = "Cargando…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`loader ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}
