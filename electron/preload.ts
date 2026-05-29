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

  // Listen for menu-triggered events
  onImportHtmlFiles: (callback: (paths: string[]) => void) => {
    ipcRenderer.on('import-html-files', (_event, paths) => callback(paths));
  },
  onImportImageFiles: (callback: (paths: string[]) => void) => {
    ipcRenderer.on('import-image-files', (_event, paths) => callback(paths));
  },
  onExportHtml: (callback: () => void) => {
    ipcRenderer.on('export-html', () => callback());
  },
  onSaveProject: (callback: () => void) => {
    ipcRenderer.on('save-project', () => callback());
  },
});
