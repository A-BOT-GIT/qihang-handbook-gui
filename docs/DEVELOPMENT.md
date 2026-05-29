# 开发指南

## 环境要求

- Node.js 18+
- npm 9+
- 推荐: VS Code + ESLint

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式 (Web 仅用于调试)
npm run dev:web

# 开发模式 (完整桌面应用)
npm run dev          # 同时启动 Vite + Electron

# 生产构建
npm run build

# 启动生产版本
npm start

# 打包
npm run dist:win     # Windows 安装包
```

## 构建说明

### 构建流程

1. `npm run build:renderer` - Vite 构建 React 应用到 `dist/`
2. `npm run build:electron` - esbuild 编译 TypeScript 到 `dist-electron/`
3. `npm run build` - 同时执行以上两步

### 打包说明

- Windows: NSIS 安装程序 + 绿色版
- 使用 `electron-builder` 进行打包
- 打包配置见 `electron-builder.yml`

## 常见问题

### Electron 无法启动

确保先构建完成:
```bash
npm run build
npm start
```

### Windows 11 Mica 效果

需要 Windows 11 22H2+ 且 Electron 34+ 才能启用。

## 发布流程

1. 更新版本号: `package.json` 中的 `version`
2. 完整构建: `npm run build`
3. 测试: `npm start`
4. 打包: `npm run dist:win`
5. 发布到 GitHub Releases
