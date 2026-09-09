import { ReactNode } from "react";

// Section is a labelled block: a small uppercase heading with an optional
// right-aligned accessory, and its content below.
export function Section({
  title,
  accessory,
  children,
}: {
  title: string;
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-dim">{title}</span>
        {accessory}
      </div>
      {children}
    </div>
  );
}
