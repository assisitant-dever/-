// pages/CorePage.tsx
import { useState,useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";

export default function CorePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [docType, setDocType] = useState("通知");
  const [previewContent, setPreviewContent] = useState("这里是生成的公文预览...");
  const [loading, setLoading] = useState(false);

  // 当前会话
  const currentConv = state.conversations.find((c) => c.id.toString() === id) || null;

  useEffect(() => {
    if (currentConv) {
      dispatch({ type: "SET_CURRENT_CONV", payload: currentConv });
      // 模拟加载历史消息
      setMessages([
        { role: "assistant", content: "您好，请上传公文模板或告诉我公文类型。" },
      ]);
    } else if (id !== "new") {
      alert("会话不存在");
      navigate("/home");
    }
  }, [id, state.conversations, currentConv, dispatch, navigate]);

  // 发送消息
const handleSend = async () => {
  if (!input.trim()) return;

  const userMsg = { role: "user", content: input };
  setMessages((prev) => [...prev, userMsg]);
  setInput("");
  setLoading(true);

  try {
    // ✅ 调用你现有的 /api/generate 接口
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("user_input", input);
    formData.append("conv_id", id || "new"); // 支持 new 和具体 ID

    const response = await api.post("/api/generate", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    const { text, filename } = response.data;

    // ✅ AI 回复消息
    const aiMsg = {
      role: "assistant",
      content: text,
      docx_file: filename, // 用于后续下载
    };

    setMessages((prev) => [...prev, aiMsg]);
    setPreviewContent(text); // 更新预览

  } catch (err: any) {
    const errorMsg = err.response?.data?.detail || "生成失败，请重试";
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `❌ ${errorMsg}` },
    ]);
  } finally {
    setLoading(false);
  }
};

  // 上传模板
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`已上传模板：${file.name}`);
      // 这里可以调用 API 上传文件
      // api.post("/api/upload", formData)
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* 左侧：Sidebar */}
      <Sidebar onSelect={() => {}} />

      {/* 中间：聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 聊天内容 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 mt-10">
              开始与 AI 交互，撰写您的公文
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-3xl mx-auto p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-100 ml-auto"
                    : "bg-gray-100 mr-auto"
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>

        {/* 输入框 */}
        <div className="p-4 border-t bg-white dark:bg-slate-800">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="输入您的请求，例如：写一份关于放假的通知"
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleSend} disabled={loading}>
              {loading ? "发送中..." : "发送"}
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧：控制面板 */}
      <div className="w-80 border-l bg-slate-50 dark:bg-slate-800 p-4 overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">公文配置</h3>

        {/* 公文类型选择 */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">公文类型</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700"
          >
            <option>通知</option>
            <option>报告</option>
            <option>请示</option>
            <option>函</option>
            <option>纪要</option>
          </select>
        </div>

        {/* 上传模板 */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">上传模板</label>
          <input
            type="file"
            onChange={handleUpload}
            accept=".doc,.docx,.pdf"
            className="w-full p-2 border rounded-lg"
          />
        </div>

        {/* 公文预览 */}
        <div className="border rounded-lg p-4 bg-white dark:bg-slate-700">
          <h4 className="font-bold mb-2">公文预览</h4>
          <div className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">
            {previewContent}
          </div>
        </div>
      </div>
    </div>
  );
}