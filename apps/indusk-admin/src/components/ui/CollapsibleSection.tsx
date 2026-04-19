"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface CollapsibleSectionProps {
	title: ReactNode;
	defaultOpen?: boolean;
	children: ReactNode;
	/** Optional right-aligned content in the header (e.g. status badge, count). */
	headerRight?: ReactNode;
	className?: string;
}

export function CollapsibleSection({
	title,
	defaultOpen = false,
	children,
	headerRight,
	className = "",
}: CollapsibleSectionProps) {
	const [open, setOpen] = useState(defaultOpen);
	const Chevron = open ? ChevronDown : ChevronRight;

	return (
		<div className={`rounded-md border border-gray-200 ${className}`}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
			>
				<span className="flex items-center gap-2">
					<Chevron className="h-4 w-4 text-gray-500" aria-hidden />
					<span>{title}</span>
				</span>
				{headerRight ? <span className="ml-auto">{headerRight}</span> : null}
			</button>
			{open ? <div className="border-t border-gray-200 p-3">{children}</div> : null}
		</div>
	);
}
