import { createFileRoute, Link } from "@tanstack/react-router";

const names: Record<string, string> = {
  "process-flow": "0 Process flow",
  unclaimed: "A2 Unclaimed",
  "tasks-checker": "A3 My tasks: checker",
  "tasks-requester": "A3.1 My tasks: requester",
  "tasks-lead": "A3.2 My tasks: lead",
  "task-view": "A3.8 Task view",
  "track-all": "A4 Track all work",
  "designer-home": "B1 Designer home",
  "designer-tasks": "B2 Designer my tasks",
};

export const Route = createFileRoute("/not-built")({
  validateSearch: (search: Record<string, unknown>): { screen?: string } => ({
    ...(typeof search["screen"] === "string" ? { screen: search["screen"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Proof Check — Designed, not built" },
      { name: "description", content: "This screen is part of the full design but not built in this prototype." },
      { property: "og:title", content: "Proof Check — Designed, not built" },
      { property: "og:description", content: "This screen is part of the full design but not built in this prototype." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotBuilt,
});

function NotBuilt() {
  const { screen } = Route.useSearch();
  const name = screen ? (names[screen] ?? screen) : "";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Designed, not built in this prototype</h1>
      {name && <p className="mt-1 text-lg text-neutral-700">{name}</p>}
      <p className="mt-4 text-sm text-neutral-600">
        This screen is part of the full design. The prototype builds only what proves the value: reading the spec,
        reading the proof, comparing them, and comparing two rounds.
      </p>
      <p className="mt-4">
        <Link to="/" className="underline">
          Back to home
        </Link>
      </p>
      <p className="mt-2 text-sm text-neutral-500">Design canvas: link to be added</p>
    </div>
  );
}
