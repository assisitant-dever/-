import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// 请求拦截器：自动加 Authorization
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

export default api;
