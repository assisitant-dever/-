// src/env.d.ts
export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly REACT_APP_API_URL: string;
    }
  }
}