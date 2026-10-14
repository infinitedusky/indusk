import type { ReactNode, TextareaHTMLAttributes } from "react";

export interface PromptBoxProps {
  value?: string;
  onChange?: (value: string) => void;
  /** The person chose to add documents. */
  onAdd?: () => void;
  /** Documents already added, drawn between the box and its buttons. */
  attachments?: ReactNode;
  /** Beside the add button: what sends the words on. */
  actions?: ReactNode;
  /** Under the buttons: a line saying what happens next. */
  hint?: ReactNode;
  textareaProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange"
  >;
}

/**
 * The "What do you want to build?" box: the question, one text box to answer
 * it in, and a way to add documents to write the brief from. Nothing else is
 * asked first.
 */
export function PromptBox({
  value,
  onChange,
  onAdd,
  attachments,
  actions,
  hint,
  textareaProps,
}: PromptBoxProps) {
  return (
    <section
      data-component="prompt-box"
      data-state="default"
      className="grid gap-3"
    >
      <h2 className="measure-question font-display text-3xl leading-7 font-bold">
        What do you want to build?
      </h2>
      <textarea
        aria-label="Tell the agent what you want to build"
        className="min-h-input w-full resize-y rounded-xl border border-line bg-surface p-4 text-ink"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...textareaProps}
      />
      {attachments}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm leading-3 text-ink-soft"
          onClick={onAdd}
        >
          + Add documents to write the brief from
        </button>
        {actions}
      </div>
      {hint}
    </section>
  );
}
