# Catch

> 粘贴链接，接住任何视频。A minimal macOS video downloader — paste a link, catch the video.

<p align="center">
  <img src="./.github/screenshot.png" width="680" alt="Catch 主界面：毛玻璃窗口、胶囊输入框、下载列表" />
</p>

Catch 是一个极简的 macOS 视频下载工具：一个输入框、一个列表，没有别的。支持 YouTube、哔哩哔哩、X/Twitter 等 **1800+ 网站**（由 yt-dlp / BBDown 驱动），自动识别链接类型、自动抓取视频标题，下载完成点击即可打开文件。

## 特性

- **三种投递方式**：粘贴链接、窗口内任意位置 ⌘V、把链接直接拖进窗口
- **剪贴板检测**：复制了视频链接再切回窗口，自动弹出一键下载建议
- **真实标题**：自动抓取视频页标题作为任务名和文件名，不是无意义的时间戳
- **自动识别**：B 站走 BBDown、m3u8 流走 N_m3u8DL-RE、其余交给 yt-dlp，无需手选类型
- **失败兜底**：明显无效的链接（如网站首页）提交时即拦截；任何下载失败都会弹出通知和原因，可一键查看完整日志
- **macOS 原生质感**：Liquid Glass 毛玻璃（原生 vibrancy）、隐藏式标题栏、胶囊控件、亮暗双模式，遵循 macOS 26 设计规范
- **零遥测**：移除了上游项目的统计上报和 Sentry，不向任何服务器发送使用数据

## 安装

从 [Releases](../../releases) 下载 `Catch-setup-darwin-arm64-*.dmg`（Apple Silicon）。

应用未经 Apple 公证，首次打开请右键 → 打开。

## 从源码构建

```bash
# 依赖：Node.js ≥ 20、pnpm ≥ 10、Go ≥ 1.22
pnpm install
pnpm deps:download   # 下载 yt-dlp / ffmpeg / BBDown 等二进制
pnpm dev:electron    # 开发模式（热重载）
pnpm release:electron  # 打包 .dmg
```

## 技术栈

Electron + React 19 + TailwindCSS 4 + Ant Design 6（前端），Go + Gin + SQLite（下载调度核心），下载引擎为 [yt-dlp](https://github.com/yt-dlp/yt-dlp)、[BBDown](https://github.com/nilaoda/BBDown)、[N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE)、[ffmpeg](https://ffmpeg.org/)。

## 致谢

本项目基于 [caorushizi/mediago](https://github.com/caorushizi/mediago)（MIT）深度改造：重写了整个界面与交互、精简为单一下载流、增加标题解析与剪贴板集成、移除遥测。感谢原作者的优秀架构。

## 许可

[MIT](./LICENSE)。仅供学习研究使用，请遵守目标网站的服务条款，勿下载侵权内容。
