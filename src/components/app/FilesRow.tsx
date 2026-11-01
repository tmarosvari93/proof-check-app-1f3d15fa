import type { FileRef } from "@/state/types";

function FileLink({ file, download, children }: { file: FileRef; download?: boolean; children: string }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      {...(download ? { download: file.name } : {})}
      className="underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/** "Files: Spec … · Proof …" — plain links that open in a new tab. Missing files show nothing. */
export function FilesRow({ spec, proof }: { spec?: FileRef | null | undefined; proof?: FileRef | null | undefined }) {
  if (!spec && !proof) return null;
  return (
    <p className="text-sm text-neutral-600">
      Files:{" "}
      {spec && <FileLink file={spec} download>Spec {spec.name}</FileLink>}
      {spec && proof ? " · " : ""}
      {proof && <FileLink file={proof}>Proof {proof.name}</FileLink>}
    </p>
  );
}

/** "Spec file: …" for the New request page, next to the read result. */
export function SpecFileRow({ file }: { file?: FileRef | null | undefined }) {
  if (!file) return null;
  return (
    <p className="text-sm text-neutral-600">
      Spec file:{" "}
      <FileLink file={file} download>
        {file.name}
      </FileLink>
    </p>
  );
}
