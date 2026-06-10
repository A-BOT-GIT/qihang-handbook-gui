import { app, BrowserWindow, Menu, Tray, nativeTheme, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ── 崩溃安全启动日志（第一行即写日志）──
let crashLogFile: string;
(function initCrashLog() {
  const crashLogDir = path.join(os.homedir(), '.qihang-crash-logs');
  try {
    fs.mkdirSync(crashLogDir, { recursive: true });
  } catch (_) {}
  crashLogFile = path.join(crashLogDir, 'crash.log');
  fs.appendFileSync(crashLogFile, `--- BOOT ${new Date().toISOString()} pid=${process.pid} ---\n`, 'utf-8');
})();

function crashLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    fs.appendFileSync(crashLogFile, `${line}\n`, 'utf-8');
  } catch (_) {}
  process.stderr.write(`[QIHANG] ${line}\n`);
}

crashLog(`main.ts loaded, cwd=${process.cwd()} platform=${process.platform}`);

process.on('uncaughtException', function(err: Error) {
  crashLog(`UNCAUGHT: ${err.message}\n${err.stack || ''}`);
});

process.on('unhandledRejection', function(reason: any) {
  crashLog(`UNHANDLED_REJECTION: ${String(reason)}`);
});

// ── 延迟初始化路径（app.getPath 需在 ready 后调用才安全）──
let userDataDir: string | null = null;
let stateFile: string;
let debugFile: string;

function ensureDirs() {
  if (userDataDir) return;
  try {
    userDataDir = app.getPath('userData');
  } catch (e: any) {
    crashLog(`WARN: app.getPath(userData) failed, using fallback: ${e.message}`);
    userDataDir = path.join(os.homedir(), '.qihang-handbook');
  }
  crashLog(`userDataDir=${userDataDir}`);
  stateFile = path.join(userDataDir, 'state.json');
  debugFile = path.join(userDataDir, 'debug.log');
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
  } catch (_) {}
}

function appendDebugLog(entry: any) {
  ensureDirs();
  try {
    const payload = {
      time: new Date().toISOString(),
      level: entry.level || 'info',
      source: entry.source || 'unknown',
      message: entry.message || '',
      detail: entry.detail,
    };
    fs.appendFileSync(debugFile, JSON.stringify(payload) + '\n', 'utf-8');
  } catch (e: any) {
    crashLog(`appendDebugLog error: ${e.message}`);
  }
}

function createWindow() {
  crashLog(`createWindow called, isPackaged=${app.isPackaged}`);
  ensureDirs();

  const preloadPath = path.join(__dirname, 'preload.mjs');
  crashLog(`preload path=${preloadPath} exists=${fs.existsSync(preloadPath)}`);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: true,
    backgroundColor: '#fbf8f2',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Windows 11: Mica / Acrylic background material
  if (process.platform === 'win32') {
    try {
      win.setBackgroundMaterial('mica');
    } catch {
      // older Electron versions or unsupported Windows builds
    }
    win.setMenuBarVisibility(false);
  }

  const startUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`;
  crashLog(`loading URL: ${startUrl}`);
  appendDebugLog({
    level: 'info',
    source: 'main',
    message: 'createWindow',
    detail: { startUrl, packaged: app.isPackaged, __dirname },
  });

  if (isDev) {
    win.loadURL(startUrl);
    win.webContents.openDevTools({ mode: 'bottom' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('did-fail-load', function(_event: any, code: number, desc: string, url: string) {
    crashLog(`did-fail-load code=${code} desc=${desc}`);
    appendDebugLog({
      level: 'error',
      source: 'main',
      message: 'did-fail-load',
      detail: { code, description: desc, url },
    });
  });

  win.webContents.on('render-process-gone', function(_event: any, details: any) {
    crashLog(`render-process-gone: ${JSON.stringify(details)}`);
    appendDebugLog({
      level: 'error',
      source: 'main',
      message: 'render-process-gone',
      detail: details,
    });
  });

  win.webContents.on('unresponsive', function() {
    crashLog('renderer unresponsive');
    appendDebugLog({
      level: 'warn',
      source: 'main',
      message: 'renderer-unresponsive',
    });
  });

  // 捕获渲染进程Console（包括JS报错）
  win.webContents.on('console-message', function(_event: any, level: number, message: string, line: number, sourceId: string) {
    const levels = ['verbose', 'info', 'warning', 'error'];
    crashLog(`[RENDERER:${levels[level] || level}] ${message}${sourceId ? ` (${sourceId}:${line})` : ''}`);
  });

  win.webContents.on('dom-ready', function() {
    crashLog('renderer DOM ready');
  });

  win.webContents.on('did-finish-load', function() {
    crashLog('renderer did-finish-load');
  });

  win.once('ready-to-show', () => {
    if (!isDev) {
      createAppMenu();
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  mainWindow = win;
}

function createAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入 HTML 模板',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [{ name: 'HTML 文件', extensions: ['html', 'htm'] }],
              properties: ['openFile', 'multiSelections'],
            });
            if (!result.canceled && result.filePaths.length) {
              const files = result.filePaths;
              mainWindow.webContents.send('import-html-files', files);
            }
          },
        },
        {
          label: '导入图片',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
              properties: ['openFile', 'multiSelections'],
            });
            if (!result.canceled && result.filePaths.length) {
              mainWindow.webContents.send('import-image-files', result.filePaths);
            }
          },
        },
        { type: 'separator' },
        {
          label: '导出为 HTML',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('export-html'),
        },
        {
          label: '保存项目',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('save-project'),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于起航研学手册',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于起航研学手册',
              message: '起航研学手册 GUI v3.0 - CSS 编辑版',
              detail: '基于 Electron 的桌面出版编辑工具\n\n用于创建和管理研学手册内容。',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  // Tray support - would need an icon file
}

// IPC handlers
ipcMain.handle('dialog:openHtml', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'HTML 文件', extensions: ['html', 'htm'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('dialog:openImages', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('dialog:saveJson', async (_event, defaultName: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('dialog:saveHtml', async (_event, defaultName: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'HTML 文件', extensions: ['html'] }],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
});

ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:readBinary', async (_event, filePath: string) => {
  try {
    const buf = fs.readFileSync(filePath);
    return { data: buf.toString('base64'), name: path.basename(filePath) };
  } catch {
    return null;
  }
});

ipcMain.handle('app:getPath', async (_event, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  shell.openExternal(url);
});

// 调试日志 IPC
ipcMain.handle('debug:append', async (_event, entry: any) => {
  appendDebugLog(entry || {});
  return { success: true };
});

ipcMain.handle('debug:read', async () => {
  ensureDirs();
  try {
    const content = fs.existsSync(debugFile) ? fs.readFileSync(debugFile, 'utf-8') : '';
    return { success: true, content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('debug:clear', async () => {
  ensureDirs();
  try {
    fs.writeFileSync(debugFile, '', 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  crashLog('app.ready fired');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
crashLog(`singleInstanceLock: ${gotLock ? 'primary' : 'secondary (will focus existing)'}`);
if (gotLock) {
  app.on('second-instance', function() {
    crashLog('second-instance event');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// 不再自动 quit，允许开发时多次启动调试

crashLog('main.ts init done, waiting for app.ready...');
