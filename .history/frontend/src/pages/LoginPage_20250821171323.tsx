import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApp } from "../store/app";

export default function LoginPage() {
  const { dispatch } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      dispatch({ type: "SET_USER", payload: res.data.username });
      navigate("/home");
    } catch (err) {
      console.error(err);
      alert("登录失败");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">登录</h2>
        <input type="email" placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} 
          className="w-full p-2 mb-4 border rounded-lg" />
        <input type="password" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)} 
          className="w-full p-2 mb-4 border rounded-lg" />
        <button onClick={handleLogin} disabled={loading} 
          className="w-full bg-blue-600 text-white py-2 rounded-lg">
          {loading ? "登录中..." : "登录"}
        </button>
        <p className="mt-4 text-sm text-center">
          没有账号？ <a href="/register" className="text-blue-500">注册</a>
        </p>
      </div>
    </div>
  );
}
