import { useRef, type ReactNode } from "react";

interface DropZoneProps {
  accept: string;
  title: string;
  line: string;
  hint?: string;
  status?: ReactNode;
  disabled?: boolean;
  onFile: (file: File) => void;
}

/** Dashed drop zone with a real hidden file input behind it. */
export function DropZone({ accept, title, line, hint, status, disabled, onFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`border border-dashed rounded p-6 text-center ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="text-sm">
        {line.split("browse")[0]}
        <span className="underline">browse</span>
      </p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
      {status ? <div className="mt-2 text-sm">{status}</div> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
