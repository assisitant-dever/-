// src/pages/CorePage.tsx
import React, { useState, useEffect } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";

export default function CorePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const [messages, setMessages] = useState<{ role: string; content: string; docx_file?: string; id?: number }[]>([]);
  const [input, setInput] = useState("");
  const [docType, setDocType] = useState("通知");
  const [previewContent, setPreviewContent] = useState("请开始输入您的公文需求。");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<{ id: number; original_name: string; filename: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const currentConv = state.conversations.find((c) => c.id.toString() === id) || null;

  // ----------------- 加载历史消息 -----------------
  useEffect(() => {
    if (currentConv) {
      dispatch({ type: "SET_CURRENT_CONV", payload: currentConv });
      if (Array.isArray(currentConv.messages)) {
        setMessages(currentConv.messages);
        if (currentConv.messages.length > 0) {
          setPreviewContent(currentConv.messages[currentConv.messages.length - 1]?.content || "");
        }
      } else {
        setMessages([{ role: "assistant", content: "欢迎，请输入您的公文需求。" }]);
      }
    } else if (id !== "new") {
      alert("会话不存在");
      navigate("/home");
    }
  }, [id, state.conversations, currentConv, dispatch, navigate]);

  // ----------------- 加载模板列表 -----------------
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await api.get("/api/templates");
        setTemplates(res.data);
      } catch (err) {
        console.error("加载模板失败", err);
      }
    };
    loadTemplates();
  }, []);

  // ----------------- 发送消息 -----------------
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("doc_type", docType);
      formData.append("user_input", input);
      formData.append("conv_id", id || "new");

      const response = await api.post("/api/generate", formData);
      const { text, filename } = response.data;

      const aiMsg = {
        role: "assistant",
        content: text,
        docx_file: filename,
        id: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setPreviewContent(text);

    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "生成失败，请重试";
      const errorMsgBlock = { role: "assistant", content: `❌ ${errorMsg}` };
      setMessages((prev) => [...prev, errorMsgBlock]);
    } finally {
      setLoading(false);
    }
  };

  // ----------------- 搜索过滤模板 -----------------
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  return (
    <div className="flex h-screen bg-white">
      {/* 左侧：对话内容 */}
      <div className="flex-1 flex flex-col">
        {/* 聊天区域 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center">暂无消息</p>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {/* 下载按钮 */}
                  {msg.docx_file && (
                    <a
                      href={`/api/download/${msg.docx_file}`}
                      target="_blank"
                      download
                      className="text-sm mt-2 inline-block text-green-600 hover:underline"
                    >
                      📥 下载公文文件
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex space-x-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="通知">通知</option>
              <option value="请示">请示</option>
              <option value="会议纪要">会议纪要</option>
              <option value="报告">报告</option>
              <option value="函">函</option>
            </select>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="请输入您的公文需求..."
              className="flex-1 px-3 py-2 border rounded text-sm"
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? "生成中..." : "发送"}
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧：预览 + 模板 */}
      <div className="w-80 bg-gray-50 flex flex-col border-l">
        {/* 预览 */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="font-bold mb-2">公文预览</h3>
          <div className="bg-white p-3 border rounded text-sm whitespace-pre-wrap">
            {previewContent}
          </div>
        </div>

        {/* 模板库 */}
        <div className="border-t p-4">
          <h3 className="font-bold mb-2">模板库</h3>
          <input
            type="text"
            placeholder="搜索模板..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-1 border rounded text-sm mb-2"
          />
          <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
            {filteredTemplates.map((t) => (
              <li
                key={t.id}
                className="p-1 hover:bg-gray-200 rounded truncate cursor-pointer"
                title={t.original_name}
                onClick={async () => {
                  try {
                    const res = await api.get(`/api/template-content/${t.filename}`);
                    setSelectedTemplate(res.data.content);
                    alert(`已选中模板：${t.original_name}，将作为格式参考`);
                  } catch (err) {
                    alert("加载模板内容失败");
                  }
                }}
              >
                📄 {t.original_name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}