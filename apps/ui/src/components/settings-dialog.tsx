import { useMemoizedFn } from "ahooks";
import { InputNumber, Modal } from "antd";
import { useShallow } from "zustand/react/shallow";
import { setConfigValue } from "@/api/config";
import { usePlatform } from "@/hooks/use-platform";
import {
  appStoreSelector,
  setAppStoreSelector,
  useAppStore,
} from "@/store/app";
import { isWeb } from "@/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 极简设置：只保留下载目录和并发数 */
export function SettingsDialog({ open, onClose }: Props) {
  const appStore = useAppStore(useShallow(appStoreSelector));
  const { setAppStore } = useAppStore(useShallow(setAppStoreSelector));
  const { dialog } = usePlatform();

  const handleSelectDir = useMemoizedFn(async () => {
    const paths = await dialog.open({ type: "directory" });
    const local = paths?.[0];
    if (local) {
      await setConfigValue("local", local);
      setAppStore({ local });
    }
  });

  const handleChangeMaxRunner = useMemoizedFn(async (value: number | null) => {
    if (!value) return;
    await setConfigValue("maxRunner", value);
    setAppStore({ maxRunner: value });
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="设置"
      width={420}
    >
      <div className="flex flex-col gap-5 py-2">
        {!isWeb && (
          <div className="flex flex-col gap-1.5">
            <div className="text-sm text-[#1A1A1A] dark:text-[#ECECEA]">
              下载目录
            </div>
            <button
              type="button"
              className="cursor-pointer truncate rounded-lg border border-[#E0DED8] bg-[#FAFAF8] px-3 py-2 text-left text-xs text-[#5D5D57] hover:border-[#B5B1A6] dark:border-[#3A3A3A] dark:bg-[#2A2A2A] dark:text-[#B4B4B0]"
              title={appStore.local}
              onClick={handleSelectDir}
            >
              {appStore.local || "点击选择下载目录"}
            </button>
          </div>
        )}
        <div className="flex flex-row items-center justify-between">
          <div className="text-sm text-[#1A1A1A] dark:text-[#ECECEA]">
            同时下载数
          </div>
          <InputNumber
            min={1}
            max={10}
            value={appStore.maxRunner}
            onChange={handleChangeMaxRunner}
          />
        </div>
      </div>
    </Modal>
  );
}
