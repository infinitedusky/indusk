import type { ReactNode } from "react";

export interface SidebarProps {
	/** Optional header content (project name, version, controls). */
	header?: ReactNode;
	/** Main content of the sidebar — typically the plan list. */
	children: ReactNode;
	className?: string;
}

/**
 * Left-rail container for navigation. Width is fixed; content scrolls.
 */
export function Sidebar({ header, children, className = "" }: SidebarProps) {
	return (
		<aside
			className={`flex h-screen w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white ${className}`}
		>
			{header ? (
				<div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">{header}</div>
			) : null}
			<div className="flex-1 overflow-y-auto px-2 py-3">{children}</div>
		</aside>
	);
}
