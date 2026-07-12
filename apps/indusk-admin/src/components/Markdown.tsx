import { isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/Mermaid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface MarkdownProps {
  children: string;
  /** Extra Tailwind classes applied to the prose container. */
  className?: string;
}

/**
 * Server-rendered markdown with project styling.
 *
 * Two layers of styling:
 *   1. Tailwind `prose` (via @tailwindcss/typography) handles headings,
 *      paragraphs, lists, blockquotes, code, links — the bulk of body text.
 *   2. Custom `components` overrides for tables: every markdown table renders
 *      via the project's `<Table>` primitive (Table/TableHeader/TableBody/...),
 *      so a brief or research doc with a pipe-table gets the same visual
 *      treatment as a trajectory table elsewhere in the app. Single source of
 *      truth — no inline `<table className=...>` anywhere.
 *
 * GFM (GitHub Flavored Markdown) is enabled via `remark-gfm` so pipe-tables,
 * task lists, strikethrough, and autolinks all render correctly.
 *
 * Picked `react-markdown` over `marked` because it returns a React element
 * tree (XSS-safe by construction; no `dangerouslySetInnerHTML`) and is
 * idiomatic for Next.js server components. To swap libraries later, change
 * only this file — every callsite imports `<Markdown>`, not `<ReactMarkdown>`.
 */
function isMermaidCodeElement(node: ReactNode): boolean {
  if (!isValidElement<{ className?: string }>(node)) return false;
  return (
    typeof node.props.className === "string" &&
    node.props.className.includes("language-mermaid")
  );
}

const components: Components = {
  table: ({ children }) => <Table>{children}</Table>,
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
  pre({ children, ...rest }) {
    // ```mermaid blocks render their own container via <Mermaid> — skip the
    // default <pre> wrapper so Tailwind Typography's `pre` styling
    // (padding/background/monospace) doesn't fight the diagram's own box.
    const child = Array.isArray(children) ? children[0] : children;
    if (isMermaidCodeElement(child)) return <>{children}</>;
    return <pre {...rest}>{children}</pre>;
  },
  code({ className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match?.[1] === "mermaid") {
      return <Mermaid source={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

export function Markdown({ children, className = "" }: MarkdownProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
