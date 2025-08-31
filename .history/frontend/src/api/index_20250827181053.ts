import axios from "axios";

const api = axios.create({
  baseURL: "", // 注意不要重复 /api
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
api.generateTitle = async (convId: string | number) => {
  const res = await fetch(`/api/conversations/${convId}/generate_title`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
  });
  if (!res.ok) throw new Error("生成标题失败");
  return res.json(); // { title: string }
};

export default api;
