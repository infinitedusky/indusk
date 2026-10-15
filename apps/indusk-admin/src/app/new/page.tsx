import { readParent } from "@infinitedusky/indusk-mcp/new-project";
import { NewProjectStart } from "@/components/new-project/NewProjectStart";

/**
 * `/new` - New project (new-project-flow), drawn as the approved
 * `new-project.start` draws it: a crumb, "New project", and the box that asks
 * what you want to build. Needs no project and writes nothing. Where new
 * projects go is read here, each time: it is the person's setting, changed
 * from this page (`?change=parent` opens the field to change it).
 *
 * promise: a-project-starts-as-a-conversation
 */
export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ change?: string }>;
}) {
  const { change } = await searchParams;
  const parent = readParent();
  // `new-project.no-parent` is the page asking for the folder; the component says so.
  const asking = parent === null || change === "parent";
  return (
    <main
      className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
      data-look-state={
        asking ? "prompt-box.default" : "new-project.start prompt-box.default"
      }
    >
      <header>
        <div className="text-sm leading-3 text-ink-faint">
          <b className="font-medium text-ink-soft">Projects</b> / New
        </div>
        <h1 className="font-display text-4xl leading-7 font-bold">
          New project
        </h1>
      </header>
      <NewProjectStart parent={parent} editing={change === "parent"} />
    </main>
  );
}
