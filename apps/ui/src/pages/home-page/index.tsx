import { type FC, useEffect, useRef, useState } from "react";
import { App, Pagination } from "antd";
import { useMemoizedFn } from "ahooks";
import { useShallow } from "zustand/react/shallow";
import {
  DownloadType,
  type DownloadEvent,
  type DownloadFailedEvent,
} from "@mediago/shared-common";
import { SettingsIcon } from "@/assets/svg";
import { SettingsDialog } from "@/components/settings-dialog";
import { createDownloadTasks } from "@/api/download-task";
import { onDownloadEvent } from "@/api/events";
import { getPageTitle } from "@/api/util";
import { usePlatform } from "@/hooks/use-platform";
import { useTasks } from "@/hooks/use-tasks";
import { appStoreSelector, useAppStore } from "@/store/app";
import { cn, isWeb } from "@/utils";
import { DownloadList } from "./components/download-list";

// 根据链接特征自动判断下载类型，省去用户手选
function detectType(url: string): DownloadType {
  if (/bilibili\.com|b23\.tv/.test(url)) return DownloadType.bilibili;
  if (/\.m3u8(\?|#|$)/.test(url)) return DownloadType.m3u8;
  if (/\.(mp4|mkv|webm|flv|mov|mp3|m4a)(\?|#|$)/.test(url))
    return DownloadType.direct;
  // 其余全部交给 yt-dlp（YouTube、X、抖音等 1800+ 网站）
  return DownloadType.youtube;
}

const URL_RE = /^https?:\/\/\S+$/i;

// 纯站点首页（没有路径也没有参数）不可能是视频页，提前拦截，
// 避免把 bilibili.com 首页之类的链接交给下载器后注定失败
function isHomepageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === "/" || u.pathname === "") && !u.search;
  } catch {
    return true;
  }
}

// 去掉网页标题里的站点名后缀，如 " - YouTube" "_哔哩哔哩_bilibili"；
// 后端抓取失败时返回 download_<数字> 兜底名，视为没抓到
function cleanTitle(title: string): string {
  if (/^download_\d+$/.test(title)) return "";
  return title
    .replace(
      /[\s_]*[-–—|·_][\s_]*(YouTube|哔哩哔哩.*|bilibili.*|X|Twitter|TikTok|抖音.*)\s*$/i,
      "",
    )
    .trim();
}

// 抓取视频页标题（3 秒超时，失败返回空串交给后端兜底命名）
async function fetchTitle(url: string): Promise<string> {
  try {
    const result = await Promise.race([
      getPageTitle(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(), 3000)),
    ]);
    return cleanTitle(result?.data || "");
  } catch {
    return "";
  }
}

const HomePage: FC = () => {
  const { message, notification } = App.useApp();
  const { shell } = usePlatform();
  const appStore = useAppStore(useShallow(appStoreSelector));
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  // 已建议/已提交过的链接不再重复弹建议条
  const seenUrlsRef = useRef<Set<string>>(new Set());

  const { data, pagination, total, mutate, setPage, setPageSize } = useTasks();

  // 渲染时同步最新列表，供失败通知反查任务名
  const dataRef = useRef(data);
  dataRef.current = data;

  // 兜底：任何任务下载失败都主动弹通知，不让失败淹没在列表里
  useEffect(() => {
    return onDownloadEvent((...args: unknown[]) => {
      const event = args[1] as DownloadEvent;
      if (event?.type !== "failed") return;
      const failed = (event as DownloadFailedEvent).data;
      const name = dataRef.current.find((t) => t.id === failed.id)?.name;
      const reason = failed.error?.slice(0, 120);
      notification.error({
        message: "下载失败",
        description: `${name || `任务 ${failed.id}`}${
          reason ? `：${reason}` : ""
        }，点击列表中该任务的「查看日志」可看完整原因。`,
        duration: 6,
      });
    });
  }, [notification]);

  const handleDownloadUrl = useMemoizedFn(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || submitting) return;
    if (!URL_RE.test(trimmed)) {
      message.error("请输入有效的 http/https 链接");
      return;
    }
    if (isHomepageUrl(trimmed)) {
      message.warning("这是网站首页，请粘贴具体视频页的链接");
      return;
    }

    seenUrlsRef.current.add(trimmed);
    setClipboardUrl("");
    setSubmitting(true);
    try {
      // 先解析真实视频标题，作为任务名和文件名
      const title = await fetchTitle(trimmed);
      await createDownloadTasks(
        [{ type: detectType(trimmed), name: title, url: trimmed }],
        true,
      );
      setUrl("");
      message.success(title ? `已开始下载「${title}」` : "已开始下载");
      mutate();
    } catch {
      message.error("添加下载失败，请检查链接");
    } finally {
      setSubmitting(false);
    }
  });

  // 窗口聚焦时检测剪贴板里的新链接，弹一键下载建议
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = (await navigator.clipboard.readText())?.trim();
        if (
          text &&
          URL_RE.test(text) &&
          !isHomepageUrl(text) &&
          !seenUrlsRef.current.has(text)
        ) {
          setClipboardUrl(text);
        }
      } catch {
        // 剪贴板权限被拒时静默跳过
      }
    };
    window.addEventListener("focus", checkClipboard);
    checkClipboard();
    return () => window.removeEventListener("focus", checkClipboard);
  }, []);

  // 窗口任意处 ⌘V：不用先点输入框，粘贴即下载
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && URL_RE.test(text)) {
        e.preventDefault();
        handleDownloadUrl(text);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleDownloadUrl]);

  // 拖一条链接进窗口即下载（Downie 同款交互）
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const text = (
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text") ||
        ""
      ).trim();
      const first = text.split("\n")[0]?.trim();
      if (first && URL_RE.test(first)) handleDownloadUrl(first);
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [handleDownloadUrl]);

  const handleChangePage = useMemoizedFn((page: number, pageSize: number) => {
    setPage(page);
    setPageSize(pageSize);
  });

  // 保存目录的短名（完整路径放 tooltip）
  const folderName = appStore.local?.split("/").filter(Boolean).pop() || "";

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent text-[13px]">
      {/* Tahoe 规范的顶部 toolbar 行：红绿灯 + 标题 + 工具按钮，整行可拖拽窗口 */}
      <div className="drag-region flex h-[52px] shrink-0 select-none flex-row items-center justify-between pl-[84px] pr-4">
        <span className="text-[13px] font-semibold text-[#1A1A1A] dark:text-[#ECECEA]">
          Catch
        </span>
        <div className="flex flex-row items-center gap-1.5 text-[12px] text-black/40 dark:text-white/40">
          {!isWeb && appStore.local && (
            <button
              type="button"
              title={`打开 ${appStore.local}`}
              className="cursor-pointer rounded-full px-2.5 py-1 transition-colors hover:bg-black/[0.05] hover:text-black/70 dark:hover:bg-white/[0.07] dark:hover:text-white/70"
              onClick={() => shell.open(appStore.local)}
            >
              保存到 {folderName} ↗
            </button>
          )}
          <button
            type="button"
            title="设置"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/[0.05] hover:text-black/70 dark:hover:bg-white/[0.07] dark:hover:text-white/70"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon fill="currentColor" width={14} height={14} />
          </button>
        </div>
      </div>
      <div className="mx-auto flex h-full w-full max-w-[640px] flex-col overflow-hidden px-6">
        {/* 输入区 */}
        <div className="flex shrink-0 flex-col gap-3 pb-5 pt-4">
          {/* Tahoe 规范：输入栏用 capsule 胶囊形（搜索框同款几何） */}
          <div className="flex h-12 w-full flex-row items-center gap-2 rounded-full border border-black/[0.08] bg-white/65 pl-5 pr-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors focus-within:border-black/20 focus-within:bg-white/80 dark:border-white/10 dark:bg-[#282828]/60 dark:focus-within:border-white/25 dark:focus-within:bg-[#282828]/80">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDownloadUrl(url);
              }}
              placeholder="粘贴或拖入视频链接"
              className="flex-1 bg-transparent text-[13px] text-[#1A1A1A] outline-none placeholder:text-black/25 dark:text-[#ECECEA] dark:placeholder:text-white/25"
            />
            <button
              type="button"
              disabled={submitting || !url.trim()}
              onClick={() => handleDownloadUrl(url)}
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1A1A1A] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#333330] disabled:cursor-default disabled:opacity-30 dark:bg-[#ECECEA] dark:text-[#1A1A1A] dark:hover:bg-white"
            >
              {submitting ? "解析中…" : "下载"}
            </button>
          </div>

          {/* 剪贴板建议条 */}
          {clipboardUrl && !submitting && (
            <button
              type="button"
              onClick={() => handleDownloadUrl(clipboardUrl)}
              className="flex w-full cursor-pointer flex-row items-center gap-2 rounded-full border border-black/[0.06] bg-white/45 px-4 py-2 text-left transition-colors hover:bg-white/65 dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:bg-white/[0.09]"
            >
              <span className="shrink-0 text-black/40 dark:text-white/40">
                检测到剪贴板链接
              </span>
              <span className="flex-1 truncate text-[#1A1A1A] dark:text-[#ECECEA]">
                {clipboardUrl}
              </span>
              <span className="shrink-0 font-medium text-[#1A1A1A] dark:text-[#ECECEA]">
                下载 ↩
              </span>
            </button>
          )}
        </div>

        <DownloadList />

        {total > pagination.pageSize && (
          <Pagination
            className="flex shrink-0 justify-end py-3"
            current={pagination.page}
            pageSize={pagination.pageSize}
            onChange={handleChangePage}
            total={total}
          />
        )}
      </div>

      {/* 拖拽提示蒙层 */}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-black/30 bg-white/70 backdrop-blur-sm dark:border-white/30 dark:bg-black/50">
          <span
            className={cn(
              "text-[15px] font-medium text-[#1A1A1A] dark:text-[#ECECEA]",
            )}
          >
            松开以下载链接
          </span>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};

export default HomePage;
