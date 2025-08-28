import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApp } from "../store/app";

export default function LoginPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("用户名和密码不能为空");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { username, password });

      const token = res.data.access_token;

      // 保存到 localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);

      // 更新全局状态
      dispatch({ type: "SET_USER", payload: { username, token } });

      // 跳转 HomePage
      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        setError("用户名或密码错误");
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">登录</h2>
        {error && <p className="text-red-500 mb-2 text-center">{error}</p>}
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 mb-4 border rounded-lg"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded-lg"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-2 rounded-lg text-white ${
            loading ? "bg-gray-400" : "bg-blue-600"
          }`}
        >
          {loading ? "登录中..." : "登录"}
        </button>
        <p className="mt-4 text-sm text-center">
          没有账号？ <a href="/register" className="text-blue-500">注册</a>
        </p>
      </div>
    </div>
  );
}
