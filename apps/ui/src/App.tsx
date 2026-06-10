import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import { type FC, lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import "dayjs/locale/zh-cn";
import { useAsyncEffect, useMemoizedFn } from "ahooks";
import zhCN from "antd/es/locale/zh_CN";
import { useShallow } from "zustand/react/shallow";
import Loading from "./components/loading";
import { setAppStoreSelector, useAppStore } from "./store/app";
import { themeSelector, useSessionStore } from "./store/session";
import { isWeb } from "./utils";
import { setupHttp } from "./utils/http";
import { getConfig } from "./api/config";
import { initGoEvents, onConfigChanged } from "./api/events";

const HomePage = lazy(() => import("./pages/home-page"));

function getAlgorithm(appTheme: "dark" | "light") {
  return appTheme === "dark"
    ? antdTheme.darkAlgorithm
    : antdTheme.defaultAlgorithm;
}

const App: FC = () => {
  const { setAppStore } = useAppStore(useShallow(setAppStoreSelector));
  const { theme, setTheme } = useSessionStore(useShallow(themeSelector));
  const [adapterReady, setAdapterReady] = useState(false);

  const themeChange = useMemoizedFn((event: MediaQueryListEvent) => {
    if (event.matches) {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  });

  // 监听 config 变化
  const handleConfigChanged = useMemoizedFn(
    (_event: unknown, data: { key: string; value: unknown }) => {
      setAppStore({ [data.key]: data.value });
    },
  );

  useEffect(() => {
    return onConfigChanged(handleConfigChanged);
  }, []);

  useAsyncEffect(async () => {
    try {
      let coreUrl = "";

      if (isWeb) {
        // Web 模式：Go Core 同源提供 API 和静态文件
        coreUrl = import.meta.env.DEV
          ? "http://127.0.0.1:9900"
          : window.location.origin;
        setupHttp(coreUrl);
        initGoEvents(coreUrl);
      } else {
        // Electron 模式：从 preload IPC 拿 coreUrl
        // FIXME: 等待 Go Core 完全启动
        await new Promise((r) => setTimeout(r, 1000));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ipcResult: any = await window.electron?.app?.getEnvPath();
        const envPath = ipcResult?.code === 0 ? ipcResult.data : ipcResult;
        if (envPath?.coreUrl) {
          coreUrl = envPath.coreUrl;
          setupHttp(coreUrl);
          initGoEvents(coreUrl);
        }
      }

      // 从 Go Core（唯一可信源）同步配置到 Zustand
      if (coreUrl) {
        try {
          const config = await getConfig();
          if (config) {
            setAppStore(config as Record<string, unknown>);
          }
        } catch {
          // Go Core 可能还没就绪
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Go adapter init failed:", err);
    } finally {
      setAdapterReady(true);
    }
  }, []);

  useEffect(() => {
    const isDarkTheme = matchMedia("(prefers-color-scheme: dark)");
    isDarkTheme.addEventListener("change", themeChange);

    if (isDarkTheme.matches) {
      setTheme("dark");
    } else {
      setTheme("light");
    }

    return () => {
      isDarkTheme.removeEventListener("change", themeChange);
    };
  }, []);

  if (!adapterReady) {
    return <Loading />;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      componentSize={isWeb ? undefined : "small"}
      theme={{
        algorithm: getAlgorithm(theme),
        // 暖灰极简：近黑作为全局唯一强调色，暗色下反转为近白
        token: {
          colorPrimary: theme === "dark" ? "#ECECEA" : "#1A1A1A",
          colorInfo: theme === "dark" ? "#ECECEA" : "#1A1A1A",
          colorBgLayout: theme === "dark" ? "#212121" : "#FAFAF8",
          borderRadius: 10,
          // Tahoe 尺度：弹窗等大容器用更大的圆角
          borderRadiusLG: 16,
          fontSize: 13,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <AntdApp className="size-full overflow-hidden">
        <Routes>
          <Route
            path="*"
            element={
              <Suspense fallback={<Loading />}>
                <HomePage />
              </Suspense>
            }
          />
        </Routes>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
