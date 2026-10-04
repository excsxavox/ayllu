export function chunkText(text: string, size = 600): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const parts = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1 && clean.length <= size) return [clean];
  const chunks: string[] = [];
  let buf = "";
  for (const part of parts.length ? parts : [clean]) {
    const next = buf ? `${buf}\n\n${part}` : part;
    if (buf && next.length > size) {
      chunks.push(buf);
      buf = part;
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}
