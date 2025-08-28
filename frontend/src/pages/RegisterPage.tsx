import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApp } from "../store/app";

export default function RegisterPage() {
  const { dispatch } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("所有字段不能为空");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/register", { username, password });
      // 注册成功后自动登录或跳转登录页
      dispatch({ type: "SET_USER", payload: res.data.access_token });
      navigate("/home");
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 400) {
        setError(err.response.data.detail || "注册失败");
      } else {
        setError("注册失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">注册</h2>
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
        <input
          type="password"
          placeholder="确认密码"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded-lg"
        />
        <button
          onClick={handleRegister}
          disabled={loading}
          className={`w-full py-2 rounded-lg text-white ${loading ? "bg-gray-400" : "bg-blue-600"}`}
        >
          {loading ? "注册中..." : "注册"}
        </button>
        <p className="mt-4 text-sm text-center">
          已有账号？ <a href="/login" className="text-blue-500">登录</a>
        </p>
      </div>
    </div>
  );
}
