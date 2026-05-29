/**
 * Type declarations for Electron API exposed via preload script.
 * Provides type safety for `window.electronAPI` in the renderer process.
 */
export {};

declare global {
  interface ElectronAPI {
    // Dialog
    openHtmlDialog: () => Promise<string[]>;
    openImagesDialog: () => Promise<string[]>;
    saveJsonDialog: (defaultName: string) => Promise<string | null>;
    saveHtmlDialog: (defaultName: string) => Promise<string | null>;

    // File operations
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    readBinaryFile: (filePath: string) => Promise<{ data: string; name: string } | null>;

    // App info
    getPath: (name: string) => Promise<string>;

    // Event listeners for menu-triggered actions
    onImportHtmlFiles: (callback: (paths: string[]) => void) => void;
    onImportImageFiles: (callback: (paths: string[]) => void) => void;
    onExportHtml: (callback: () => void) => void;
    onSaveProject: (callback: () => void) => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
