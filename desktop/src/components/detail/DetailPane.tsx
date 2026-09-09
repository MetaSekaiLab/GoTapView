import { Session, TapEvent } from "../../types";
import { EventDetail } from "./EventDetail";
import { Overview } from "../overview/Overview";

// DetailPane is the docked right column: the selected event, or the session
// Overview when nothing is selected.
export function DetailPane({
  event,
  session,
  onClear,
}: {
  event: TapEvent | null;
  session: Session | null;
  onClear?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3.5 py-2.5">
        <span className="text-[13px] font-bold text-text">{event ? "Event detail" : "Session overview"}</span>
        {event && onClear && (
          <button onClick={onClear} className="text-[13px] font-bold text-accent">
            ✕
          </button>
        )}
      </div>
      {event ? <EventDetail e={event} /> : session ? <Overview session={session} /> : null}
    </div>
  );
}
