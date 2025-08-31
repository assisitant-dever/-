// src/api.ts
import axios from "axios";

const api = axios.create({

  baseURL: "import.meta.env.VITE_API_URL;", // 或你的后端地址

});

// ✅ 请求拦截器：自动带上 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ 响应拦截器：处理 token 失效
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // 清除本地状态
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      // 可选：触发全局登出
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;