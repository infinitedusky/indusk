const projects = [
	{
		name: "composable.env",
		description:
			"Build .env files for every service from reusable components, profiles, and contracts. Separates what values exist from who needs them and which environment.",
		tags: ["TypeScript", "CLI", "DevTools"],
		link: "https://www.npmjs.com/package/composable.env",
	},
	{
		name: "Claude Code Skills",
		description:
			"A methodology for teaching AI agents how to plan, execute, verify, and remember. Markdown-based skills that compose into a full development system.",
		tags: ["AI", "Claude Code", "Methodology"],
	},
	{
		name: "infinitedusky",
		description:
			"This site and the monorepo behind it. Dogfoods the skill system and composable.env to build and maintain a personal brand.",
		tags: ["Next.js", "Turborepo", "pnpm"],
	},
];

const skills = [
	{
		name: "TypeScript",
		level: "Expert",
		description:
			"Full-stack TypeScript across Node.js backends, React frontends, and CLI tooling. Strong emphasis on type safety and developer experience.",
	},
	{
		name: "React / Next.js",
		level: "Advanced",
		description:
			"Server components, app router, and modern React patterns. Building fast, accessible web applications with Tailwind CSS.",
	},
	{
		name: "AI/LLM Engineering",
		level: "Advanced",
		description:
			"Claude Code skill authoring, prompt engineering, agent architectures, and building AI-assisted development workflows.",
	},
	{
		name: "DevTools & DX",
		level: "Advanced",
		description:
			"CLI tools, monorepo orchestration, environment management, and developer experience tooling that compounds over time.",
	},
	{
		name: "Web3 / Solidity",
		level: "Intermediate",
		description:
			"Smart contract development, on-chain integrations, and decentralized application architecture.",
	},
	{
		name: "Infrastructure",
		level: "Intermediate",
		description:
			"Docker, CI/CD pipelines, deployment automation, and composable environment configuration across profiles.",
	},
];

const devSystem = [
	{
		name: "plan",
		status: "stable" as const,
		description:
			"Structured planning lifecycle: research, brief, ADR, impl, retrospective. Every feature starts with understanding the problem.",
	},
	{
		name: "work",
		status: "stable" as const,
		description:
			"Execute implementation plans methodically. Works through checklists, checking each off only after verification.",
	},
	{
		name: "verify",
		status: "building" as const,
		description:
			"Automated verification loop — type checks, tests, lint — integrated into the work cycle.",
	},
	{
		name: "context",
		status: "building" as const,
		description:
			"Living project memory. Maintains CLAUDE.md so every session starts with full awareness.",
	},
];

const levelColors: Record<string, string> = {
	Expert: "bg-emerald-900/50 text-emerald-400 border-emerald-800",
	Advanced: "bg-blue-900/50 text-blue-400 border-blue-800",
	Intermediate: "bg-amber-900/50 text-amber-400 border-amber-800",
};

export default function Home() {
	return (
		<main className="min-h-screen">
			{/* Nav */}
			<nav className="fixed top-0 z-50 w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
					<span className="text-lg font-bold tracking-tight">
						infinite<span className="text-amber-400">dusky</span>
					</span>
					<div className="flex gap-6 text-sm text-zinc-400">
						<a href="#projects" className="transition hover:text-zinc-100">
							Projects
						</a>
						<a href="#skills" className="transition hover:text-zinc-100">
							Skills
						</a>
						<a href="#system" className="transition hover:text-zinc-100">
							System
						</a>
						<a href="#about" className="transition hover:text-zinc-100">
							About
						</a>
					</div>
				</div>
			</nav>

			{/* Hero */}
			<section className="flex flex-col items-center justify-center px-6 pt-40 pb-24">
				<h1 className="text-5xl font-bold tracking-tight sm:text-7xl">Hi, I&apos;m Sandy</h1>
				<h2 className="mt-4 text-xl text-zinc-400 sm:text-2xl">
					Full-Stack Developer &amp; Dev System Builder
				</h2>
				<p className="mt-6 max-w-2xl text-center text-base leading-relaxed text-zinc-500">
					I build tools that make development better — from environment management CLIs to AI skill
					systems that teach agents how to plan, execute, and learn. I believe the best code comes
					from better decisions, not just faster typing.
				</p>
				<div className="mt-8 flex gap-4">
					<a
						href="#projects"
						className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
					>
						Projects
					</a>
					<a
						href="#about"
						className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
					>
						About Me
					</a>
				</div>
			</section>

			{/* Projects */}
			<section id="projects" className="mx-auto max-w-5xl px-6 py-20">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400">Projects</h2>
				<p className="mt-2 text-2xl font-bold text-zinc-100">Things I&apos;ve built</p>
				<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((p) => (
						<div
							key={p.name}
							className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700 hover:bg-zinc-900"
						>
							<h3 className="text-lg font-semibold text-zinc-100">{p.name}</h3>
							<p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{p.description}</p>
							<div className="mt-4 flex flex-wrap gap-2">
								{p.tags.map((tag) => (
									<span
										key={tag}
										className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-400"
									>
										{tag}
									</span>
								))}
							</div>
							{p.link && (
								<a
									href={p.link}
									target="_blank"
									rel="noopener noreferrer"
									className="mt-4 inline-flex items-center gap-1 text-sm text-amber-400 transition hover:text-amber-300"
								>
									View
									<span aria-hidden="true">&rarr;</span>
								</a>
							)}
						</div>
					))}
				</div>
			</section>

			{/* Skills / Experience */}
			<section id="skills" className="mx-auto max-w-5xl px-6 py-20">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400">
					Experience
				</h2>
				<p className="mt-2 text-2xl font-bold text-zinc-100">What I work with</p>
				<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{skills.map((s) => (
						<div key={s.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
							<div className="flex items-center justify-between">
								<h3 className="text-base font-semibold text-zinc-100">{s.name}</h3>
								<span
									className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${levelColors[s.level]}`}
								>
									{s.level}
								</span>
							</div>
							<p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.description}</p>
						</div>
					))}
				</div>
			</section>

			{/* Dev System */}
			<section id="system" className="mx-auto max-w-5xl px-6 py-20">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400">
					The Dev System
				</h2>
				<p className="mt-2 text-2xl font-bold text-zinc-100">How I work with AI</p>
				<p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
					Claude Code skills that define how work gets done. Each skill is a markdown file that
					teaches the agent a specific capability — planning, execution, verification, or memory.
				</p>
				<div className="mt-10 grid gap-6 sm:grid-cols-2">
					{devSystem.map((s) => (
						<div key={s.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
							<div className="flex items-center gap-3">
								<code className="text-base font-semibold text-zinc-100">{s.name}</code>
								<span
									className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
										s.status === "stable"
											? "bg-emerald-900/50 text-emerald-400"
											: "bg-amber-900/50 text-amber-400"
									}`}
								>
									{s.status}
								</span>
							</div>
							<p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.description}</p>
						</div>
					))}
				</div>

				{/* Lifecycle */}
				<div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm">
					{["research", "brief", "ADR", "impl", "retrospective"].map((step, i) => (
						<div key={step} className="flex items-center gap-3">
							<div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-zinc-300">
								{step}
							</div>
							{i < 4 && (
								<span className="text-zinc-600" aria-hidden="true">
									&rarr;
								</span>
							)}
						</div>
					))}
				</div>
			</section>

			{/* About */}
			<section id="about" className="mx-auto max-w-3xl px-6 py-20">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400">About</h2>
				<p className="mt-2 text-2xl font-bold text-zinc-100">The person behind the system</p>
				<div className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-400">
					<p>
						I&apos;m a developer who thinks the biggest wins in AI-assisted coding come from better
						planning, not faster generation. I build tools and systems that help developers (and AI
						agents) make better decisions about what to build before writing the first line of code.
					</p>
					<p>
						My current focus is on composable developer tooling — environment management with
						composable.env, AI skill systems for Claude Code, and the infrastructure that ties it
						all together in maintainable monorepos.
					</p>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
				Built by Sandy &middot; Powered by Claude Code &middot; The system builds itself
			</footer>
		</main>
	);
}
