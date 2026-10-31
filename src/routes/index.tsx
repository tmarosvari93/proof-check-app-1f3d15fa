import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";
import { StartOver } from "@/components/app/StartOver";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Home · Proof Check" },
      { name: "description", content: "Checks packaging proofs against the product spec. The app highlights, people decide." },
      { property: "og:title", content: "Home · Proof Check" },
      { property: "og:description", content: "Checks packaging proofs against the product spec. The app highlights, people decide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LINK_CARDS: { title: string; text: string; to: string; screen?: string }[] = [
  { title: "Unclaimed", text: "New work waiting for a checker. Claim one and it opens.", to: "/not-built", screen: "unclaimed" },
  { title: "My tasks", text: "What you claimed, handed on, finished or requested.", to: "/not-built", screen: "tasks-checker" },
  { title: "Track all work", text: "What everyone is working on, and the approved proofs.", to: "/not-built", screen: "track-all" },
  { title: "+ New request", text: "Start a check for a packaging piece.", to: "/new" },
];

const HOW_CARDS: { n: number; title: string; text: string; who: string }[] = [
  { n: 1, title: "Request", text: "A requester creates a request for one packaging piece, with the spec Excel and a designer.", who: "Requester" },
  { n: 2, title: "Proof upload", text: "The designer (own team or partner) uploads the proof PDF in the app.", who: "Designer" },
  { n: 3, title: "Automatic check", text: "The app reads the proof, compares it with the spec and the last round. It only highlights.", who: "System" },
  { n: 4, title: "Review", text: "A checker claims it from Unclaimed and decides every finding. Any real error: send back. None: pass on.", who: "Checker 1" },
  { n: 5, title: "4-eye check", text: "A different checker confirms what was dismissed, then passes it to approval or sends it back.", who: "Checker 2" },
  { n: 6, title: "Approval", text: "The food-safety lead approves. A send-back starts a new round, which returns to Unclaimed.", who: "Lead" },
];

function Home() {
  return (
    <AppLayout role="anyone">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold">Home</h1>
        <p className="text-sm text-muted-foreground">Welcome to Proof Check</p>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Checks packaging proofs against the product spec. The app highlights, people decide.
      </p>
      <div className="mt-4">
        <Button asChild>
          <Link to="/new">Start the demo</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {LINK_CARDS.map((c) => (
          <Link key={c.title} to={c.to} search={c.screen ? { screen: c.screen } : {}} className="border rounded p-4">
            <span className="block font-bold">{c.title}</span>
            <span className="block text-sm text-muted-foreground mt-1">{c.text}</span>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">How Proof Check works</h2>
      <div className="mt-3 grid grid-cols-4 gap-4">
        {HOW_CARDS.map((c) => (
          <div key={c.n} className="border rounded p-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {c.n}
              </span>
              <span className="font-bold">{c.title}</span>
            </div>
            <p className="text-sm mt-2">{c.text}</p>
            <p className="text-xs text-muted-foreground mt-2">{c.who}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-dashed rounded p-4">
        <h2 className="font-bold">Good to know</h2>
        <p className="text-sm mt-1">
          The app never approves anything: only people sign off. A field it cannot read is shown as {"\"could not read\""},
          never as a pass. This prototype keeps everything in your browser tab: a page refresh starts over.
        </p>
      </div>

      <div className="mt-4 border rounded p-4">
        <h2 className="font-bold">Try it with the demo files</h2>
        <p className="text-sm mt-1">
          All names and values are fictional. Download the spec Excel and the proofs: v1 with seeded errors, v2 with changes
          nobody asked for, v3 clean. Each proof also comes as a flat, image-only PDF.
        </p>
        <p className="text-sm mt-1">
          One person plays every role; the {"\"Working as\""} label shows whose page you are on.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/demo/demo_files.zip" download>
              Download demo files (.zip)
            </a>
          </Button>
          <StartOver />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Start over clears everything and returns here.</p>
      </div>
    </AppLayout>
  );
}
