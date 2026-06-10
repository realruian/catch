import { dirname, resolve } from "node:path";
import { app } from "electron";

export const appData = app.getPath("appData");
export const exePath = dirname(app.getPath("exe"));

export enum Platform {
  Windows = "win32",
  MacOS = "darwin",
  Linux = "linux",
}

export const isMac = process.platform === Platform.MacOS;
export const isWin = process.platform === Platform.Windows;
export const isLinux = process.platform === Platform.Linux;

if (!process.env.APP_NAME) {
  throw new Error("APP_NAME is not defined in environment variables");
}

export const appName = process.env.APP_NAME;
export const workspace = resolve(appData, appName);
// URL scheme 必须小写：Chromium 解析 URL 时会把 scheme 小写化，
// 显示名（如 Catch）直接当 scheme 会导致生产环境协议匹配不上而白屏
export const defaultScheme = appName.toLowerCase();
export const PERSIST_MEDIAGO = "persist:mediago";
export const PERSIST_WEBVIEW = "persist:webview";
export const PRIVACY_WEBVIEW = "webview";
export const db = resolve(workspace, "app.db");
export const logDir = resolve(workspace, "logs");

// user agent
export const pcUA = "";
export const mobileUA =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";
