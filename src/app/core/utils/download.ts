/**
 * Saves text as a file via the browser's normal download (a temporary
 * <a download> click) - no server involved.
 *
 * `bom` prefixes a UTF-8 byte-order mark: without it, Excel on Windows
 * reads UTF-8 CSVs as its legacy encoding ("Bär" -> "BÃ¤r"). The CSV
 * import strips it again.
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  { type = 'text/csv;charset=utf-8', bom = false }: { type?: string; bom?: boolean } = {},
): void {
  const blob = new Blob(bom ? ['\uFEFF', text] : [text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url));
}
