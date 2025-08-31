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
  // 1. 加载当前环境的变量（mode 是当前环境：development/production/test）
  // process.cwd() 表示项目根目录（确保能找到 .env 文件）
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: getPlugins(),
    server: {
      proxy: {
        '/api': {
          // 2. 动态设置代理目标：从环境变量读取后端地址
          target: env.VITE_BACKEND_BASE_URL, 
          changeOrigin: true,              // 解决跨域（必要）
          secure: false,                   // 开发环境忽略 HTTPS 证书（生产环境可改为 true）
          // 可选：如果后端接口没有 /api 前缀，可通过 rewrite 移除（根据实际情况调整）
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // 补充 WebSocket 代理（如果需要，同样动态读取地址）
        '/ws': {
          target: env.VITE_BACKEND_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://'),
          ws: true, // 启用 WebSocket 代理
          changeOrigin: true,
          secure: false,
        },
      },
      port: 3000, // 前端固定端口（无需修改）
    },
  };
});