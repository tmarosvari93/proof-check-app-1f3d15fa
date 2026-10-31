import type { ReactNode } from "react";
import type { Decision } from "@/state/types";

type Tone = "undecided" | "real" | "not" | "green" | "red" | "amber" | "plain";

const tones: Record<Tone, string> = {
  undecided: "border border-dashed border-neutral-400 bg-white text-neutral-600",
  real: "border border-neutral-900 bg-neutral-900 text-white",
  not: "border border-neutral-300 bg-neutral-200 text-neutral-600",
  green: "border border-green-300 bg-green-100 text-green-800",
  red: "border border-red-300 bg-red-100 text-red-800",
  amber: "border border-amber-300 bg-amber-100 text-amber-800",
  plain: "border border-neutral-300 bg-white text-neutral-800",
};

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function DecisionChip({ decision }: { decision: Decision }) {
  if (decision === "real_error") return <Chip tone="real">Real error</Chip>;
  if (decision === "not_error") return <Chip tone="not">Not an error</Chip>;
  return <Chip tone="undecided">Undecided</Chip>;
}
