import {
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { DownloadStatus } from "@mediago/shared-common";
import { useMemoizedFn } from "ahooks";
import { forwardRef, memo, type ReactNode } from "react";
import type { DownloadTaskDetails } from "@/hooks/use-tasks";
import { cn, fromatDateTime } from "@/utils";
import { TerminalDialog } from "./terminal-dialog";
import { usePlatform } from "@/hooks/use-platform";
import { useEnvPath } from "@/hooks/use-config";
import { appStoreSelector, useAppStore } from "@/store/app";
import { useShallow } from "zustand/react/shallow";

interface Props {
  task: DownloadTaskDetails;
  onStartDownload: (id: number) => void;
  onStopDownload: (taskId: number) => void;
  onDelete: (taskId: number) => void;
}

// macOS 系统状态色：绿=完成 红=失败 灰=待处理 黑=进行中
function statusDotColor(status?: DownloadStatus): string {
  switch (status) {
    case DownloadStatus.Success:
      return "#34C759";
    case DownloadStatus.Failed:
      return "#FF3B30";
    case DownloadStatus.Downloading:
      return "#1A1A1A";
    default:
      return "#C7C7C2";
  }
}

function statusText(task: DownloadTaskDetails): string {
  switch (task.status) {
    case DownloadStatus.Success:
      return task.exists ? "已完成" : "已完成 · 文件已被移动或删除";
    case DownloadStatus.Failed:
      return "下载失败";
    case DownloadStatus.Stopped:
      return "已暂停";
    case DownloadStatus.Pending:
      return "排队中";
    case DownloadStatus.Ready:
      return "等待下载";
    default:
      return "";
  }
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 小型无边框图标按钮，hover 才出现；转发 ref/props 以兼容 Radix asChild */
interface RowActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  icon: ReactNode;
}

const RowAction = forwardRef<HTMLButtonElement, RowActionProps>(
  function RowAction({ title, icon, onClick, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        title={title}
        onClick={(e) => {
          // 阻止冒泡，避免触发整行的「打开文件」点击
          e.stopPropagation();
          onClick?.(e);
        }}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/[0.06] hover:text-black/80 disabled:cursor-default disabled:opacity-30 dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white/80"
        {...rest}
      >
        {icon}
      </button>
    );
  },
);

export const DownloadTaskItem = memo(function DownloadTaskItem({
  task,
  onStartDownload,
  onStopDownload,
  onDelete,
}: Props) {
  const { shell } = usePlatform();
  const { envPath } = useEnvPath();
  const appStore = useAppStore(useShallow(appStoreSelector));

  const isDownloading = task.status === DownloadStatus.Downloading;
  const isSuccess = task.status === DownloadStatus.Success;
  const isFailed = task.status === DownloadStatus.Failed;
  const canStart =
    task.status === DownloadStatus.Ready ||
    task.status === DownloadStatus.Stopped ||
    isFailed;

  const handlePlay = useMemoizedFn(() => {
    if (envPath?.playerUrl) {
      shell.open(`${envPath.playerUrl}?id=${task.id}`);
    }
  });

  // 完成项：优先定位到具体文件，拿不到路径就打开下载目录
  const handleReveal = useMemoizedFn(() => {
    if (task.file) {
      shell.open(task.file);
    } else if (appStore.local) {
      shell.open(appStore.local);
    }
  });

  const percent = Math.min(100, Math.round(Number(task.percent)) || 0);

  return (
    <div
      className={cn(
        "group flex flex-row items-center gap-3 px-4 py-2.5 transition-colors",
        isSuccess && task.exists
          ? "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
      )}
      onClick={isSuccess && task.exists ? handleReveal : undefined}
    >
      {/* 状态点 */}
      <span
        className={cn("h-[7px] w-[7px] shrink-0 rounded-full", {
          "animate-pulse": isDownloading,
        })}
        style={{ background: statusDotColor(task.status) }}
      />

      {/* 标题 + 副信息 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="truncate text-[13px] leading-tight text-[#1A1A1A] dark:text-[#ECECEA]"
          title={task.name}
        >
          {task.name}
        </div>

        {isDownloading ? (
          <div className="flex flex-row items-center gap-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.12]">
              <div
                className="h-full rounded-full bg-[#1A1A1A] transition-[width] duration-300 dark:bg-[#ECECEA]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-black/45 dark:text-white/45">
              {percent}% · {task.speed}
            </span>
          </div>
        ) : (
          <div
            className="truncate text-[11px] text-black/40 dark:text-white/40"
            title={task.url}
          >
            {statusText(task)}
            {task.isLive ? " · 直播" : ""} · {urlHost(task.url)} ·{" "}
            {fromatDateTime(task.createdDate, "MM/DD HH:mm")}
          </div>
        )}
      </div>

      {/* hover 操作区 */}
      <div className="flex shrink-0 flex-row items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {isDownloading && (
          <RowAction
            title="暂停"
            icon={<PauseOutlined />}
            onClick={() => onStopDownload(task.id)}
          />
        )}
        {canStart && (
          <RowAction
            title={isFailed ? "重新下载" : "开始下载"}
            icon={<ReloadOutlined />}
            onClick={() => onStartDownload(task.id)}
          />
        )}
        {isFailed && (
          <TerminalDialog
            asChild
            trigger={<RowAction title="查看日志" icon={<FileTextOutlined />} />}
            title={task.name}
            id={task.id}
          />
        )}
        {isSuccess && (
          <>
            <RowAction
              title="播放"
              icon={<PlayCircleOutlined />}
              disabled={!task.exists}
              onClick={handlePlay}
            />
            <RowAction
              title="在文件夹中显示"
              icon={<FolderOpenOutlined />}
              onClick={handleReveal}
            />
          </>
        )}
        <RowAction
          title="删除"
          icon={<DeleteOutlined />}
          onClick={() => onDelete(task.id)}
        />
      </div>
    </div>
  );
});
