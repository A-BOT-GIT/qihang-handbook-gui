export {};

declare global {
  interface Window {
    electronAPI?: {
      openHtmlDialog: () => Promise<string[]>;
      openImagesDialog: () => Promise<string[]>;
      saveJsonDialog: (defaultName: string) => Promise<string | null>;
      saveHtmlDialog: (defaultName: string) => Promise<string | null>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      readBinaryFile: (filePath: string) => Promise<{ data: string; name: string } | null>;
      getPath: (name: string) => Promise<string>;
      onImportHtmlFiles: (callback: (paths: string[]) => void) => () => void;
      onImportImageFiles: (callback: (paths: string[]) => void) => () => void;
      onExportHtml: (callback: () => void) => () => void;
      onSaveProject: (callback: () => void) => () => void;
    };
  }
}
