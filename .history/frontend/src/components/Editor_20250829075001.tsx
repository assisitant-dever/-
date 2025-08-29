import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { saveAs } from "file-saver";

const API_BASE = "";

export default function Editor() {
  // ---------------- 用户状态 ----------------
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [username, setUsername] = useState("");

  // ---------------- 公文生成状态 ----------------
  const [userInput, setUserInput] = useState("");
  const [selectedType, setSelectedType] = useState("通知");
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [generatedFile, setGeneratedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ---------------- 用户数据 ----------------
  const [templates, setTemplates] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // ---------------- 登录注册表单 ----------------
  const [formUser, setFormUser] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // ---------------- Axios header ----------------
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // ---------------- 获取用户模板和历史 ----------------
  const fetchUserData = async () => {
    if (!token) return;
    try {
      const [tplRes, histRes] = await Promise.all([
        axios.get(`${API_BASE}/api/templates`, { headers: authHeader }),
        axios.get(`${API_BASE}/api/history`, { headers: authHeader }),
      ]);
      setTemplates(tplRes.data);
      setHistory(histRes.data);
    } catch (err) {
      console.error(err);
      toast.error("获取用户数据失败");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [token]);

  // ---------------- 登录/注册 ----------------
  const handleAuth = async () => {
    if (!formUser || !formPassword) {
      toast.error("请输入用户名和密码");
      return;
    }
    try {
      const url = `${API_BASE}/auth/${isRegister ? "register" : "login"}`;
      const res = await axios.post(url, { username: formUser, password: formPassword });
      if (!isRegister) {
        setToken(res.data.access_token);
        localStorage.setItem("token", res.data.access_token);
        setUsername(formUser);
        toast.success("登录成功");
      } else {
        toast.success("注册成功，请登录");
        setIsRegister(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "操作失败");
    }
  };

  // ---------------- 上传模板 ----------------
  const handleTemplateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedTemplate(file);

    if (!token) {
      toast.error("请先登录");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/api/upload-template`, formData, { headers: { ...authHeader } });
      toast.success(`模板上传成功: ${res.data.original_name}`);
      fetchUserData(); // 更新模板列表
    } catch (err) {
      console.error(err);
      toast.error("模板上传失败");
    }
  };

  // ---------------- 生成公文 ----------------
  const handleGenerate = async () => {
    if (!token) {
      toast.error("请先登录");
      return;
    }
    if (!userInput.trim()) {
      toast.error("请输入生成公文的要求");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("doc_type", selectedType);
      formData.append("user_input", userInput);
      if (selectedTemplate) formData.append("template_filename", selectedTemplate.name);

      const res = await axios.post(`${API_BASE}/api/generate`, formData, { headers: { ...authHeader } });
      setGeneratedFile(res.data.filename);
      toast.success("生成成功");
      fetchUserData(); // 更新历史列表
    } catch (err) {
      console.error(err);
      toast.error("生成失败");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- 下载文档 ----------------
  const handleDownload = async (filename: string) => {
    if (!token) {
      toast.error("请先登录");
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/download/${encodeURIComponent(filename)}`, { responseType: "blob", headers: authHeader });
      saveAs(res.data, filename);
    } catch (err) {
      console.error(err);
      toast.error("下载失败");
    }
  };

  // ---------------- 渲染 ----------------
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
        <h1 className="text-3xl mb-4">公文助手 - 登录/注册</h1>
        <input placeholder="用户名" className="border p-2 mb-2" value={formUser} onChange={e => setFormUser(e.target.value)} />
        <input placeholder="密码" type="password" className="border p-2 mb-2" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
        <button onClick={handleAuth} className="bg-blue-600 text-white px-4 py-2 rounded mb-2">
          {isRegister ? "注册" : "登录"}
        </button>
        <button className="text-blue-500 underline" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "去登录" : "去注册"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="mb-4 flex justify-between">
        <h1 className="text-2xl font-bold">公文助手</h1>
        <div>
          <span className="mr-2">用户: {username}</span>
          <button onClick={() => { setToken(null); localStorage.removeItem("token"); toast.info("已登出"); }} className="text-red-500 underline">登出</button>
        </div>
      </div>

      {/* 公文生成表单 */}
      <div className="bg-white p-4 rounded shadow mb-4">
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="border p-2 mr-2">
          <option value="通知">通知</option>
          <option value="请示">请示</option>
          <option value="会议纪要">会议纪要</option>
        </select>

        <input type="file" onChange={handleTemplateChange} className="border p-2 mr-2" />
        <textarea
          placeholder="请输入公文要求"
          className="border p-2 w-full mt-2"
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
        />
        <button onClick={handleGenerate} className="bg-blue-600 text-white px-4 py-2 mt-2 rounded" disabled={loading}>
          {loading ? "生成中..." : "生成公文"}
        </button>
      </div>

      {/* 历史文档列表 */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-2">历史文档</h2>
        {history.length === 0 && <p>暂无历史文档</p>}
        {history.map(doc => (
          <div key={doc.id} className="flex justify-between items-center border-b py-2">
            <span>{doc.doc_type} - {doc.filename}</span>
            <button onClick={() => handleDownload(doc.filename)} className="text-blue-500 underline">下载</button>
          </div>
        ))}
      </div>

      {/* 模板列表 */}
      <div className="bg-white p-4 rounded shadow mt-4">
        <h2 className="text-xl font-bold mb-2">模板列表</h2>
        {templates.length === 0 && <p>暂无模板</p>}
        {templates.map(t => (
          <div key={t.id} className="border-b py-2">{t.original_name}</div>
        ))}
      </div>
    </div>
  );
}
