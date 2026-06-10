import { useMemoizedFn } from "ahooks";
import { App } from "antd";
import Loading from "@/components/loading";
import {
  startDownload,
  stopDownload,
  deleteDownloadTask,
} from "@/api/download-task";
import { useTasks } from "@/hooks/use-tasks";
import { DownloadTaskItem } from "./download-item";

export function DownloadList() {
  const { message } = App.useApp();
  const { mutate, isLoading, data } = useTasks();

  const onStartDownload = useMemoizedFn(async (id: number) => {
    await startDownload(id);
    message.success("已开始下载");
    mutate();
  });

  const onStopDownload = useMemoizedFn(async (id: number) => {
    await stopDownload(id);
    setTimeout(() => {
      mutate();
    }, 500);
  });

  const onDelete = useMemoizedFn(async (id: number) => {
    await deleteDownloadTask(id);
    mutate();
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-1 select-none flex-col items-center justify-center gap-1 pb-16 text-center">
        <span className="text-[13px] text-black/35 dark:text-white/35">
          暂无下载
        </span>
        <span className="text-[12px] text-black/25 dark:text-white/25">
          粘贴链接、⌘V 或拖入链接即可开始
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex-1 overflow-auto">
      <div className="divide-y divide-black/[0.05] rounded-2xl border border-black/[0.08] bg-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#282828]/55">
        {data.map((task) => {
          return (
            <DownloadTaskItem
              key={task.id}
              task={task}
              onStartDownload={onStartDownload}
              onStopDownload={onStopDownload}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}
