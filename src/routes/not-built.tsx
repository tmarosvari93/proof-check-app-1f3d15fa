import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";

export const Route = createFileRoute("/not-built")({
  validateSearch: (search: Record<string, unknown>) => ({
    screen: typeof search.screen === "string" ? search.screen : undefined,
  }),
  component: NotBuilt,
  head: () => ({
    meta: [
      { title: "Designed, not built · Proof Check" },
      { name: "description", content: "This screen is part of the full design, not built in this prototype." },
      { property: "og:title", content: "Designed, not built · Proof Check" },
      { property: "og:description", content: "This screen is part of the full design, not built in this prototype." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SCREEN_NAMES: Record<string, string> = {
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

function NotBuilt() {
  const { screen } = Route.useSearch();
  return (
    <AppLayout role="anyone">
      <h1 className="text-2xl font-bold">Designed, not built in this prototype</h1>
      <p className="mt-2 text-lg">{screen ? (SCREEN_NAMES[screen] ?? screen) : null}</p>
      <p className="mt-4 text-sm text-muted-foreground max-w-xl">
        This screen is part of the full design. The prototype builds only what proves the value: reading the spec, reading the
        proof, comparing them, and comparing two rounds.
      </p>
      <p className="mt-4">
        <Link to="/" className="underline text-sm">
          Back to home
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Design canvas: link to be added</p>
    </AppLayout>
  );
}
