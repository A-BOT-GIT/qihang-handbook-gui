# Qihang Handbook GUI - V3

Latest version of the handbook GUI application based on v1.0 desktop architecture.

## Build Commands

```bash
npm run dev          # Development mode
npm run build        # Production build (renderer + electron)
npm run dist:win     # Package Windows installer
npm run dist:linux   # Package Linux version
npm run dist:mac     # Package macOS version
```

## Related Versions

- **V0.1** (`qihang-handbook-gui-v0.1`): Original version
- **V1.0/Desktop** (`qihang-handbook-gui-desktop`): ESM architecture base
- **V2.0** (`qihang-handbook-gui-v2`): With HTML source editor and crash logging

## Key Features

- HTML source editor panel
- Crash safety logging at `~/.qihang-crash-logs/crash.log`
- Windows 11 Mica material support
- Template import and export (HTML/PNG)

## Planning

- [重构工作计划](./REFACTOR_WORKPLAN.md)
