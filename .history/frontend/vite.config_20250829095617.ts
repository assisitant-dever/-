/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */

import { defineConfig, loadEnv } from "vite"; // 新增 loadEnv 导入
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

function getPlugins() {
  const plugins = [react(), tsconfigPaths()];
  return plugins;
}

// 调整 defineConfig 为接收环境参数的函数形式
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_"); // 加载所有 VITE_ 前缀变量

  return {
    plugins: getPlugins(),
    server: {
      proxy: {
        '/api': {
          // 统一用 VITE_API_URL，和前端代码保持一致
          target: env.VITE_API_URL, 
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          // WebSocket 地址：把 HTTP/HTTPS 转为 WS/WSS（基于同一个变量）
          target: env.VITE_API_URL.replace('http://', 'ws://').replace('https://', 'wss://'),
          ws: true,
          changeOrigin: true,
        },
      },
      port: 3000,
    },
  };
});