import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { RoutePath } from "@/components/app/AppLayout";
import { StartOver } from "@/components/app/StartOver";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Proof Check — Home" },
      { name: "description", content: "Checks packaging proofs against the product spec. The app highlights, people decide." },
      { property: "og:title", content: "Proof Check — Home" },
      { property: "og:description", content: "Checks packaging proofs against the product spec. The app highlights, people decide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const cards: { title: string; text: string; to: RoutePath }[] = [
  { title: "Unclaimed", text: "New work waiting for a checker. Claim one and it opens.", to: "/unclaimed" as RoutePath },
  { title: "My tasks", text: "What you claimed, handed on, finished or requested.", to: "/my-tasks" as RoutePath },
  { title: "Track all work", text: "What everyone is working on, and the approved proofs.", to: "/track-all" },
  { title: "+ New request", text: "Start a check for a packaging piece.", to: "/new" },
];

const steps = [
  { n: 1, title: "Request", text: "A requester creates a request for one packaging piece, with the spec Excel and a designer.", who: "Requester" },
  { n: 2, title: "Proof upload", text: "The designer (own team or partner) uploads the proof PDF in the app.", who: "Designer" },
  { n: 3, title: "Automatic check", text: "The app reads the proof, compares it with the spec and the last round. It only highlights.", who: "System" },
  { n: 4, title: "Review", text: "A checker claims it from Unclaimed and decides every finding. Any real error: send back. None: pass on.", who: "Checker 1" },
  { n: 5, title: "4-eye check", text: "A different checker confirms what was dismissed, then passes it to approval or sends it back.", who: "Checker 2" },
  { n: 6, title: "Approval", text: "The food-safety lead approves. A send-back starts a new round, which returns to Unclaimed.", who: "Lead" },
];

function Home() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="text-sm text-neutral-500">Welcome to Proof Check</p>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Checks packaging proofs against the product spec. The app highlights, people decide.
      </p>
      <div className="mt-4">
        <Button asChild>
          <Link to="/new">Start the demo</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.title}
            to={c.to}
            className="rounded-md border border-neutral-300 p-4 hover:bg-neutral-50"
          >
            <p className="font-semibold">{c.title}</p>
            <p className="mt-1 text-sm text-neutral-600">{c.text}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">How Proof Check works</h2>
      <div className="mt-3 grid grid-cols-4 gap-4">
        {steps.map((st) => (
          <div key={st.n} className="rounded-md border border-neutral-300 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
                {st.n}
              </span>
              {st.title}
            </p>
            <p className="mt-2 text-sm text-neutral-700">{st.text}</p>
            <p className="mt-2 text-sm text-neutral-500">{st.who}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-4">
        <p className="font-semibold">Good to know</p>
        <p className="mt-1 text-sm text-neutral-700">
          The app never approves anything: only people sign off. A field it cannot read is shown as
          "could not read", never as a pass. This prototype keeps everything in your browser tab: a
          page refresh starts over.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-neutral-300 p-4">
        <p className="font-semibold">Try it with the demo files</p>
        <p className="mt-1 text-sm text-neutral-700">
          All names and values are fictional. Download the spec Excel and the proofs: v1 with seeded
          errors, v2 with changes nobody asked for, v3 clean. Each proof also comes as a flat,
          image-only PDF. One person plays every role; switch with "Working as" at the top.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" asChild>
            <a href="/demo/demo_files.zip" download>
              Download demo files (.zip)
            </a>
          </Button>
          <StartOver />
        </div>
        <p className="mt-2 text-sm text-neutral-500">Start over clears everything and returns here.</p>
      </div>
    </div>
  );
}
