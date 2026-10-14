import { NewProjectStart } from "@/components/new-project/NewProjectStart";

/**
 * `/new` - New project (new-project-flow), drawn as the approved
 * `new-project.start` draws it: a crumb, "New project", and the box that asks
 * what you want to build. Needs no project and writes nothing.
 *
 * promise: a-project-starts-as-a-conversation
 */
export default function NewProjectPage() {
  return (
    <main
      className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
      data-look-state="new-project.start"
    >
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          New project
        </h1>
      </header>
      <NewProjectStart />
    </main>
  );
}
