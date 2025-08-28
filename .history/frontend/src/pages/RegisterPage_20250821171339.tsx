import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setLoading(true);
    try {
      await api.post("/auth/register", { email, username, password });
      alert("注册成功，请登录");
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("注册失败");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">注册</h2>
        <input type="email" placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} 
          className="w-full p-2 mb-4 border rounded-lg" />
        <input type="text" placeholder="用户名" value={username} onChange={e=>setUsername(e.target.value)} 
          className="w-full p-2 mb-4 border rounded-lg" />
        <input type="password" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)} 
          className="w-full p-2 mb-4 border rounded-lg" />
        <button onClick={handleRegister} disabled={loading} 
          className="w-full bg-green-600 text-white py-2 rounded-lg">
          {loading ? "注册中..." : "注册"}
        </button>
        <p className="mt-4 text-sm text-center">
          已有账号？ <a href="/login" className="text-blue-500">登录</a>
        </p>
      </div>
    </div>
  );
}
