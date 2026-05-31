# Windows 便携版测试指南

## 🎯 测试目标

验证 Windows 便携版是否仍然闪退，以及新的日志系统是否能正确捕获错误。

## 📋 测试步骤

### 1. 在 Windows 上构建

```bash
# 在 Windows 命令行中
npm run build
npm run dist:win
```

生成的文件位置：`release/起航研学手册 V2-2.0.0-x64.exe`

### 2. 运行可执行文件

双击 `起航研学手册 V2-2.0.0-x64.exe` 运行应用。

### 3. 观察现象

- **成功**：应用正常启动，显示编辑界面
- **失败**：应用闪退，窗口立即关闭

### 4. 查看日志

如果应用闪退，查看以下日志文件：

#### 崩溃日志
```
C:\Users\<用户名>\.qihang-crash-logs\crash.log
```

#### 调试日志
```
C:\Users\<用户名>\AppData\Local\qihang-handbook\debug.log
```

### 5. 分析日志

#### 崩溃日志示例（正常启动）
```
--- BOOT 2026-05-31T21:50:00.000Z pid=1234 ---
[2026-05-31T21:50:00.000Z] main.ts loaded, cwd=C:\Users\zza\AppData\Local\qihang-handbook platform=win32
[2026-05-31T21:50:00.100Z] singleInstanceLock: primary
[2026-05-31T21:50:00.200Z] main.ts init done, waiting for app.ready...
[2026-05-31T21:50:00.300Z] app.ready fired
[2026-05-31T21:50:00.400Z] createWindow called, isPackaged=true
[2026-05-31T21:50:00.500Z] userDataDir=C:\Users\zza\AppData\Local\qihang-handbook
[2026-05-31T21:50:00.600Z] preload path=... exists=true
[2026-05-31T21:50:00.700Z] loading URL: file://...
[2026-05-31T21:50:01.000Z] renderer DOM ready
[2026-05-31T21:50:01.200Z] renderer did-finish-load
```

#### 崩溃日志示例（异常）
```
--- BOOT 2026-05-31T21:50:00.000Z pid=1234 ---
[2026-05-31T21:50:00.000Z] main.ts loaded, cwd=... platform=win32
[2026-05-31T21:50:00.100Z] UNCAUGHT: Cannot read property 'getPath' of undefined
[2026-05-31T21:50:00.100Z] Stack trace: ...
```

## 🔧 常见问题

### Q: 应用仍然闪退，但没有日志文件

**A**: 这表示应用在写日志之前就崩溃了。可能的原因：
- Node.js 模块加载失败
- Electron 初始化失败
- 系统权限问题

**解决方案**：
1. 尝试以管理员身份运行
2. 检查 Windows Defender 是否阻止了应用
3. 检查磁盘空间是否充足

### Q: 日志文件存在但为空

**A**: 这表示应用在初始化日志系统之前就崩溃了。

**解决方案**：
1. 检查 `~/.qihang-crash-logs/` 目录是否存在
2. 检查目录权限是否正确
3. 尝试手动创建目录：`mkdir -p ~/.qihang-crash-logs`

### Q: 日志显示 "did-fail-load"

**A**: 这表示应用加载 HTML 文件失败。

**解决方案**：
1. 检查 `dist/index.html` 是否存在
2. 检查文件路径是否正确
3. 检查文件权限是否正确

### Q: 日志显示渲染进程错误

**A**: 这表示前端代码有错误。

**解决方案**：
1. 查看具体的错误信息
2. 在开发环境中重现错误
3. 修复代码并重新构建

## 📊 测试清单

- [ ] 应用能正常启动
- [ ] 菜单栏功能正常
- [ ] 快捷键生效
- [ ] 文件打开/保存正常
- [ ] HTML导出正常
- [ ] PNG导出正常
- [ ] 撤销/重做正常
- [ ] 无崩溃和错误
- [ ] 内存占用正常（<200MB）
- [ ] 启动时间正常（<3秒）
- [ ] 日志文件正确生成
- [ ] 日志内容完整准确

## 📞 反馈

如果应用仍然闪退，请：

1. 收集以下信息：
   - `~/.qihang-crash-logs/crash.log` 的完整内容
   - `~/.qihang-handbook/debug.log` 的完整内容
   - Windows 版本和系统信息
   - 应用启动时的具体现象

2. 联系技术支持并提供上述信息

---

**测试指南版本**：1.0  
**最后更新**：2026-05-31
