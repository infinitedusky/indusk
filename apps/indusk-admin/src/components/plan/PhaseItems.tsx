import { Markdown } from "@/components/Markdown";
import type { ChecklistItem } from "@/lib/phases";

/**
 * A phase's tasks on the plan page: each is its plain sentence, checked or
 * not; a task with folded detail gets a closed "Technical" fold that opens to
 * the detail formatted (code shown as code), and a task with only a note keeps
 * the note line. The detail is drawn by the shared markdown component, never
 * as raw text.
 *
 * promise: technical-detail-opens-on-request
 */
export function PhaseItems({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="grid list-none gap-2">
      {/* Keyed by position: two tasks may say the same sentence. */}
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a task's sentence is not unique within a phase
        <li key={index} className="flex items-baseline gap-2">
          <span className="font-mono text-sm leading-3 text-ink-soft">
            {item.checked ? "☑" : "☐"}
          </span>
          <div className="min-w-0">
            <div className="text-sm leading-3">{item.text}</div>
            {item.detail ? (
              <details className="mt-hair">
                <summary className="cursor-pointer text-xs leading-2 text-ink-faint">
                  Technical
                </summary>
                <div className="mt-2 rounded-md border border-line bg-surface px-3 py-2">
                  <Markdown className="text-ink-soft">{item.detail}</Markdown>
                </div>
              </details>
            ) : item.note ? (
              <div className="mt-hair whitespace-pre-line text-xs leading-2 text-ink-faint">
                {item.note}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
