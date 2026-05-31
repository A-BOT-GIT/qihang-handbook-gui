# Windows 便携版闪退修复总结

## 📋 问题分析

根据原项目（起航研学手册GUI项目）的开发记录，Windows 便携版闪退的根本原因是：

1. **`app.getPath('userData')` 在模块加载阶段执行** — Windows 上可能抛异常导致日志系统瘫痪
2. **单实例锁异步逻辑问题** — `requestSingleInstanceLock()` 返回 false 时直接 `app.quit()`，但异步逻辑导致窗口创建后又关闭
3. **无崩溃日志** — 无法诊断问题

## ✅ 已应用的修复

### 1. 崩溃日志系统 (`electron/main.ts` 第 15-40 行)

```typescript
// 崩溃安全启动日志（第一行即写日志）
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
```

**效果**：
- 日志文件位置：`~/.qihang-crash-logs/crash.log`
- 第一行即写日志，确保能捕获启动阶段的错误
- 同时输出到 stderr，便于调试

### 2. 延迟初始化路径 (`electron/main.ts` 第 42-72 行)

```typescript
// 延迟初始化路径（app.getPath 需在 ready 后调用才安全）
let userDataDir: string | null = null;

function ensureDirs() {
  if (userDataDir) return;
  try {
    userDataDir = app.getPath('userData');
  } catch (e: any) {
    crashLog(`WARN: app.getPath(userData) failed, using fallback: ${e.message}`);
    userDataDir = path.join(os.homedir(), '.qihang-handbook');
  }
  // ...
}
```

**效果**：
- `app.getPath()` 从模块加载阶段延迟到 `createWindow()` 内调用
- 添加 fallback 路径，即使 `app.getPath()` 失败也能继续运行
- 避免启动阶段的异常导致应用崩溃

### 3. 修复单实例锁逻辑 (`electron/main.ts` 第 260-275 行)

```typescript
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
```

**效果**：
- 移除了 `if (!gotLock) app.quit()` 的强制退出
- 允许开发时多次启动调试
- 避免异步逻辑导致的窗口创建后又关闭的问题

### 4. 渲染进程错误捕获 (`electron/main.ts` 第 130-165 行)

```typescript
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
```

**效果**：
- 捕获渲染进程的所有控制台消息（包括 JS 错误）
- 记录 DOM 加载和页面加载完成事件
- 便于诊断渲染进程的问题

### 5. 调试日志 IPC (`electron/main.ts` 第 242-272 行)

```typescript
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
```

**效果**：
- 前端可以通过 IPC 写入调试日志
- 前端可以读取调试日志
- 便于前后端协同调试

### 6. Preload 暴露调试接口 (`electron/preload.ts` 第 18-20 行)

```typescript
// Debug logging
debugAppend: (entry: any): Promise<{ success: boolean }> => ipcRenderer.invoke('debug:append', entry),
debugRead: (): Promise<{ success: boolean; content?: string; error?: string }> => ipcRenderer.invoke('debug:read'),
debugClear: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('debug:clear'),
```

**效果**：
- 前端可以通过 `window.electronAPI.debugAppend()` 写入日志
- 前端可以通过 `window.electronAPI.debugRead()` 读取日志

## 🔍 调试方法

### 查看崩溃日志

```bash
cat ~/.qihang-crash-logs/crash.log
```

### 查看调试日志

```bash
cat ~/.qihang-handbook/debug.log
```

### 前端添加调试日志

```typescript
// 在 React 组件中
useEffect(() => {
  window.electronAPI.debugAppend({
    level: 'info',
    source: 'App.tsx',
    message: 'Component mounted',
    detail: { timestamp: new Date().toISOString() }
  });
}, []);
```

## 📦 构建说明

### Linux 上构建 Linux 版本

```bash
npm run build
npm run dist:linux
```

### Windows 上构建 Windows 版本

```bash
npm run build
npm run dist:win
```

### macOS 上构建 macOS 版本

```bash
npm run build
npm run dist:mac
```

## 🚀 下一步

1. **在 Windows 上测试** — 构建便携版并测试是否仍然闪退
2. **查看崩溃日志** — 如果仍然闪退，查看 `~/.qihang-crash-logs/crash.log` 了解具体错误
3. **添加更多日志** — 根据需要在关键位置添加 `crashLog()` 调用
4. **性能优化** — 如果应用启动缓慢，可以优化日志写入频率

## 📝 参考

- 原项目修复记录：`/home/zza/起航研学手册GUI项目/BUGFIX_SUMMARY.md`
- 原项目主进程实现：`/home/zza/起航研学手册GUI项目/scripts/copy-electron-files.cjs`

---

**修复日期**：2026-05-31  
**修复版本**：V2.0.0
