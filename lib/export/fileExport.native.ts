import * as Sharing from "expo-sharing";

export type ExportTextFileInput = {
  filename: string;
  text: string;
  mimeType: string;
  dialogTitle?: string;
};

type NativeFile = {
  uri?: string;
  create?: (options?: { intermediates?: boolean; overwrite?: boolean }) => void;
  write?: (content: string) => void;
};

type ExpoFileSystemModule = {
  File?: new (...uris: unknown[]) => NativeFile;
  Paths?: {
    cache?: unknown;
    document?: unknown;
  };
};

export async function exportTextFile(input: ExportTextFileInput): Promise<void> {
  const fileSystem = (await import("expo-file-system")) as unknown as ExpoFileSystemModule;
  const FileCtor = fileSystem.File;
  const baseDir = fileSystem.Paths?.cache ?? fileSystem.Paths?.document;
  if (!FileCtor || !baseDir) return;

  const file = new FileCtor(baseDir, input.filename);
  if (typeof file.create !== "function" || typeof file.write !== "function" || !file.uri) return;

  file.create({ intermediates: true, overwrite: true });
  file.write(input.text);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return;

  await Sharing.shareAsync(file.uri, {
    mimeType: input.mimeType,
    dialogTitle: input.dialogTitle,
  });
}
