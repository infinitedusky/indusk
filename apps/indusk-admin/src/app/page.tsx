export default function Home() {
	return (
		<div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
			<h1 className="text-lg font-semibold text-gray-700">Select a plan</h1>
			<p className="mt-2 max-w-sm text-sm">
				Pick a plan from the sidebar to see its phases, trajectory rows, and
				falsification log.
			</p>
		</div>
	);
}
