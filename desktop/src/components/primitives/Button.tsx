type Variant = "primary" | "subtle" | "ghost";

// Button is the app's standard clickable control.
export function Button({
  label,
  onClick,
  variant = "subtle",
  title,
}: {
  label: string;
  onClick: () => void;
  variant?: Variant;
  title?: string;
}) {
  const cls =
    variant === "primary"
      ? "bg-accent text-accent-text hover:opacity-90"
      : variant === "ghost"
        ? "text-text hover:bg-surface-alt"
        : "bg-surface-alt text-text border border-border hover:bg-border";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}
