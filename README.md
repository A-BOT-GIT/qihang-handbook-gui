# 起航研学手册 - Windows 11 桌面版

基于 Electron 的桌面出版编辑工具，用于创建和管理研学手册内容。

## 功能特点

- 🖌️ **可视化页面编辑器** - 拖拽式编辑页面元素
- 📦 **素材库管理** - 图片导入与管理
- 📄 **HTML 模板导入** - 支持 `{{slot}}` 占位符模板
- ↩️ **撤销/重做** - 完整的操作历史
- 🖼️ **HTML 导出** - 导出为独立 HTML 文件
- 💾 **项目保存/加载** - JSON 格式项目文件
- 🪟 **Windows 11 风格** - Mica 毛玻璃效果，原生体验

## 系统要求

- **Windows 11** (推荐) / Windows 10
- macOS 12+ / Linux (跨平台支持)

## 快速开始

```bash
# 开发模式
npm run dev:web          # 仅 Web 端
npm run dev:electron     # 仅 Electron 端 (需先启动 Web 服务器)
npm run dev              # 同时启动 Web + Electron

# 生产构建
npm run build

# 启动生产版本
npm start

# 打包为安装包
npm run dist:win         # Windows (NSIS 安装包 + 绿色版)
npm run dist:linux       # Linux (AppImage + deb)
npm run dist:mac         # macOS (dmg + zip)
```

## 项目结构

```
├── electron/              # Electron 主进程
│   ├── main.ts            # 主进程入口
│   └── preload.ts         # 预加载脚本 (安全 IPC)
├── src/                   # React 渲染进程
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # React 入口
│   ├── types.ts           # 类型定义
│   ├── data.ts            # 默认数据
│   ├── templateRegistry.ts # 模板注册
│   ├── styles.css          # 样式
│   └── electron.d.ts      # Electron API 类型声明
├── scripts/               # 构建脚本
│   ├── dev-electron.mjs   # 开发模式构建
│   └── build-electron.mjs # 生产模式构建
├── build/                 # 构建资源 (图标等)
├── dist/                  # Web 构建产物
├── dist-electron/         # Electron 构建产物
└── release/               # 打包输出
```

## 开发指南

### 技术栈

- **框架**: Electron 34 + React 19
- **构建**: Vite 7 + esbuild
- **语言**: TypeScript 5
- **样式**: CSS (Windows 11 Mica 风格)

### 开发流程

1. **Web 开发**: `npm run dev:web` 启动 Vite 开发服务器
2. **Electron 开发**: 先启动 Web 服务器，再运行 `npm run dev:electron`
3. **断点调试**: Electron 窗口自动打开 DevTools

### 构建与打包

```bash
# 完整构建 (Web + Electron)
npm run build

# 打包 Windows 安装包
npm run dist:win
```

## 架构说明

### 进程模型

```
主进程 (electron/main.ts)
  └── 渲染进程 (src/)
       ├── React 应用
       ├── 页面编辑器
       ├── 素材管理器
       └── 导出功能
```

### IPC 通信

使用 `contextBridge` 安全暴露 API：

- `dialog:*` - 原生对话框
- `file:*` - 文件读写
- `app:*` - 应用信息
- `shell:*` - 系统操作

## 许可证

MIT
