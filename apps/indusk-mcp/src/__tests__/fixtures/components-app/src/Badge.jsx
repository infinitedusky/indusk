export function Badge({ children }) {
	return (
		<span data-component="badge" className="bg-paper p-2 text-ink">
			{children}
		</span>
	);
}
