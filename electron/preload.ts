import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openHtmlDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openHtml'),
  openImagesDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openImages'),
  saveJsonDialog: (defaultName: string): Promise<string | null> => ipcRenderer.invoke('dialog:saveJson', defaultName),
  saveHtmlDialog: (defaultName: string): Promise<string | null> => ipcRenderer.invoke('dialog:saveHtml', defaultName),

  // File operations
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('file:write', filePath, content),
  readBinaryFile: (filePath: string): Promise<{ data: string; name: string } | null> => ipcRenderer.invoke('file:readBinary', filePath),

  // App
  getPath: (name: string): Promise<string> => ipcRenderer.invoke('app:getPath', name),

  // Debug logging
  debugAppend: (entry: any): Promise<{ success: boolean }> => ipcRenderer.invoke('debug:append', entry),
  debugRead: (): Promise<{ success: boolean; content?: string; error?: string }> => ipcRenderer.invoke('debug:read'),
  debugClear: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('debug:clear'),

  // Listen for menu-triggered events
  onImportHtmlFiles: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paths: string[]) => callback(paths);
    ipcRenderer.on('import-html-files', listener);
    return () => {
      ipcRenderer.removeListener('import-html-files', listener);
    };
  },
  onImportImageFiles: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paths: string[]) => callback(paths);
    ipcRenderer.on('import-image-files', listener);
    return () => {
      ipcRenderer.removeListener('import-image-files', listener);
    };
  },
  onExportHtml: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('export-html', listener);
    return () => {
      ipcRenderer.removeListener('export-html', listener);
    };
  },
  onSaveProject: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-project', listener);
    return () => {
      ipcRenderer.removeListener('save-project', listener);
    };
  },
});
