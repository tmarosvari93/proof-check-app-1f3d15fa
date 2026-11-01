import type { FileRef } from "@/state/types";

/** A single uploaded-file link. Opens in a new tab; spec files use download (browsers cannot show .xlsx). */
export function FileLink({ file, download }: { file: FileRef; download?: boolean | undefined }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      {...(download ? { download: file.name } : {})}
      className="underline"
    >
      {file.name}
    </a>
  );
}

/** One-line "Files: Spec … · Proof …" row. Shows nothing when both links are missing. */
export function FilesRow({
  specFile,
  proofFile,
}: {
  specFile?: FileRef | null | undefined;
  proofFile?: FileRef | null | undefined;
}) {
  if (!specFile && !proofFile) return null;
  return (
    <p className="mt-1 text-sm text-neutral-600">
      Files:{" "}
      {specFile && (
        <>
          Spec <FileLink file={specFile} download />
        </>
      )}
      {specFile && proofFile && " · "}
      {proofFile && (
        <>
          Proof <FileLink file={proofFile} />
        </>
      )}
    </p>
  );
}
