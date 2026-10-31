import { useRef } from "react";

export function DropZone({
  label,
  accept,
  hint,
  busy,
  busyText,
  error,
  chosenName,
  onFile,
}: {
  label: string;
  accept: string;
  hint: string;
  busy?: boolean;
  busyText?: string;
  error?: string;
  chosenName?: string;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className="cursor-pointer rounded-md border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center"
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm text-neutral-600">
          Drop the {accept} here or <span className="underline">browse</span>
        </p>
        {busy ? (
          <p className="mt-1 text-sm text-neutral-500">{busyText}</p>
        ) : chosenName ? (
          <p className="mt-1 text-sm text-neutral-500">{chosenName}</p>
        ) : (
          <p className="mt-1 text-xs text-neutral-400">{hint}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
