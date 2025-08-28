import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000", // 注意不要重复 /api
  withCredentials: true,             // 如果后端要求 cookies
});

// 请求拦截器：自动加 Authorization
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
