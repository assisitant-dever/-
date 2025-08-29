import axios from "axios";

const api = axios.create({
  baseURL: "",
});

// 请求拦截器：自动加 Authorization
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      // ✅ 保留原 headers，添加 Authorization
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
