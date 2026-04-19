import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  children: string;
  /** Extra Tailwind classes applied to the prose container. */
  className?: string;
}

/**
 * Server-rendered markdown with project-default Tailwind prose styling.
 *
 * Picked `react-markdown` over `marked` because:
 *   - Returns a React element tree (no `dangerouslySetInnerHTML`, no separate
 *     sanitization step — XSS-safe by construction).
 *   - Idiomatic for Next.js server components; no build-time HTML stringification.
 *   - The bundle-size delta is irrelevant for the admin UI's surface (server
 *     components don't ship JS unless they need client interactivity).
 *
 * To swap libraries later, change only this file. Every callsite imports
 * `<Markdown>` rather than `<ReactMarkdown>`.
 */
export function Markdown({ children, className = "" }: MarkdownProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`.trim()}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
