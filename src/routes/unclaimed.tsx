import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "@/state/SessionProvider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/unclaimed")({
  head: () => ({
    meta: [
      { title: "Proof Check — Unclaimed" },
      { name: "description", content: "Proofs uploaded and waiting for a checker to claim them." },
      { property: "og:title", content: "Proof Check — Unclaimed" },
      { property: "og:description", content: "Proofs uploaded and waiting for a checker to claim them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Unclaimed,
});

function Unclaimed() {
  const s = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();

  const claim = () => {
    setError(undefined);
    const e = s.claimProof();
    if (e) setError(e);
    else void navigate({ to: "/review" });
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Unclaimed</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Proofs that are uploaded and waiting for a checker. Claim one and it opens.
      </p>
      {s.unclaimed.length === 0 ? (
        <div className="mt-4 rounded-md border border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
          {s.session.request === null
            ? "Nothing is waiting. Create a request and upload a proof to see it here."
            : "Nothing is waiting for a checker."}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-neutral-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Piece</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.unclaimed.map((t) => (
                <TableRow key={`${t.workId}-${t.round}`}>
                  <TableCell className="font-medium">{t.workId}</TableCell>
                  <TableCell>{t.product}</TableCell>
                  <TableCell>{t.piece}</TableCell>
                  <TableCell>{t.round}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>
                    {s.canClaim ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={claim}>Claim</Button>
                        {error && <span className="text-sm text-red-600">{error}</span>}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400">Only Checker 1 claims in this demo</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
