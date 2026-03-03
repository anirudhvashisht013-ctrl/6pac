export type ExportTextFileInput = {
  filename: string;
  text: string;
  mimeType: string;
  dialogTitle?: string;
};

export async function exportTextFile(input: ExportTextFileInput): Promise<void> {
  const blob = new Blob([input.text], { type: `${input.mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = input.filename;
  a.click();
  URL.revokeObjectURL(url);
}
