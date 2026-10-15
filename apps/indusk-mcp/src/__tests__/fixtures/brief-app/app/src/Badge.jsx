export function Badge({ children }) {
	return (
		<span data-component="badge" className="bg-amber-50 p-[13px]">
			{children}
		</span>
	);
}
