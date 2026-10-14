/**
 * A file the person chose, as the new-project routes take it: its name and its
 * bytes in base64, so a document that is not text arrives byte for byte.
 */
export interface SentFile {
  name: string;
  content: string;
  encoding: "base64";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export async function readFiles(files: Iterable<File>): Promise<SentFile[]> {
  return Promise.all(
    [...files].map(async (file) => ({
      name: file.name,
      content: toBase64(new Uint8Array(await file.arrayBuffer())),
      encoding: "base64" as const,
    })),
  );
}
