export function Card({ children }) {
	return (
		<main data-component="card" className="bg-paper p-3 text-ink">
			{children}
		</main>
	);
}
