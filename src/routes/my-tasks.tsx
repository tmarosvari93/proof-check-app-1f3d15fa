import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/state/SessionProvider";
import { notForYouText } from "@/state/tasks";
import type { RoutePath } from "@/components/app/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/my-tasks")({
  head: () => ({
    meta: [
      { title: "Proof Check — My tasks" },
      { name: "description", content: "What needs you now, and where your requests stand." },
      { property: "og:title", content: "Proof Check — My tasks" },
      { property: "og:description", content: "What needs you now, and where your requests stand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyTasks,
});

function MyTasks() {
  const s = useSession();
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">My tasks</h1>
      <p className="mt-1 text-sm text-neutral-600">What needs you now, and where your requests stand.</p>
      {s.tasks.length === 0 ? (
        <div className="mt-4 rounded-md border border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
          {s.session.request ? notForYouText(s.session) : "No tasks yet."}
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
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.tasks.map((t, i) => (
                <TableRow key={`${t.workId}-${t.round}-${i}`}>
                  <TableCell className="font-medium">{t.workId}</TableCell>
                  <TableCell>{t.product}</TableCell>
                  <TableCell>{t.piece}</TableCell>
                  <TableCell>{t.round}</TableCell>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>
                    {t.to === null ? (
                      <span className="text-sm text-neutral-400">Waiting on someone else</span>
                    ) : t.actionable ? (
                      <Link to={t.to as RoutePath} className="text-sm font-medium underline">
                        Open
                      </Link>
                    ) : null}
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
