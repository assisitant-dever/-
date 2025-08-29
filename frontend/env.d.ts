// src/env.d.ts
export {};  // 关键：让文件成为模块

interface ImportMetaEnv {
  readonly VITE_API_URL: string;  // 与 .env 中的变量对应
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}