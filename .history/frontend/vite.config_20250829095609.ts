// 新建的 vite.config.ts（仅保留核心配置，排除插件干扰）
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  console.log("Vite 配置加载的 VITE_API_URL：", env.VITE_API_URL); // 终端打印，确认配置加载
  return {
    plugins: [react()], // 仅保留 react 插件，暂时移除 tsconfigPaths 等其他插件
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
          logLevel: 'debug' // 开启代理日志，终端会显示请求转发详情
        }
      },
      port: 3000
    }
  };
});