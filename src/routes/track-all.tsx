import { createFileRoute } from "@tanstack/react-router";
import { trackAllNote, trackAllSample } from "@/state/demo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/track-all")({
  head: () => ({
    meta: [
      { title: "Proof Check — Track all work" },
      { name: "description", content: "Sample overview of every packaging check request and its rounds." },
      { property: "og:title", content: "Proof Check — Track all work" },
      { property: "og:description", content: "Sample overview of every packaging check request and its rounds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackAll,
});

const orInProgress = (d: string) => (d === "" ? "In progress" : d);

function TrackAll() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">Track all work</h1>
      <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-100 p-3 text-sm text-neutral-700">
        {trackAllNote}
      </div>
      <div className="mt-4 rounded-md border border-neutral-300">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Work ID</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Piece</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>First proof received</TableHead>
              <TableHead>First request sent</TableHead>
              <TableHead>Rounds</TableHead>
              <TableHead>Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trackAllSample.map((r) => (
              <TableRow key={r.workId}>
                <TableCell className="font-medium">{r.workId}</TableCell>
                <TableCell>{r.product}</TableCell>
                <TableCell>{r.piece}</TableCell>
                <TableCell>{r.partner}</TableCell>
                <TableCell>{orInProgress(r.received)}</TableCell>
                <TableCell>{orInProgress(r.firstRequest)}</TableCell>
                <TableCell>{r.rounds}</TableCell>
                <TableCell>{orInProgress(r.approved)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
