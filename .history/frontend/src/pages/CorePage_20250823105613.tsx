// src/pages/CorePage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";
import { marked } from 'marked';
import Sidebar from '../components/Sidebar'; // 路径根据你的项目结构调整

export default function CorePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  // 消息列表（本地状态，用于渲染）
  const [messages, setMessages] = useState<{ role: string; content: string; docx_file?: string; id?: number }[]>([]);
  const [input, setInput] = useState("");
  const [docType, setDocType] = useState("通知");
  const [previewContent, setPreviewContent] = useState("请开始输入您的公文需求。");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<{ id: number; original_name: string; filename: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // 滚动容器引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ----------------- 自动滚动到底部 -----------------
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ----------------- 加载当前会话数据 -----------------
  useEffect(() => {
    // ✅ 将 currentConv 的查找放入 effect 内部，确保依赖正确
    const currentConv = state.conversations.find((c) => c.id.toString() === id) || null;

    if (currentConv) {
      // 更新全局当前会话
      dispatch({ type: "SET_CURRENT_CONV", payload: currentConv });

      // 设置本地消息
      if (Array.isArray(currentConv.messages) && currentConv.messages.length > 0) {
        setMessages(currentConv.messages);
        setPreviewContent(currentConv.messages[currentConv.messages.length - 1]?.content || "");
      } else {
        setMessages([{ role: "assistant", content: "欢迎，请输入您的公文需求。" }]);
      }
    } else if (id !== "new") {
      alert("会话不存在");
      navigate("/home");
    }

    // 自动聚焦输入框
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [id, state.conversations, dispatch, navigate]);

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
      if (selectedTemplate) formData.append("template_content", selectedTemplate);

      const response = await api.post("/api/generate", formData);
      const { text, filename, html } = response.data;

      const aiMsg = {
        role: "assistant",
        content: text,
        docx_file: filename,
        id: Date.now(),
      };

      // 添加到消息列表
      setMessages((prev) => [...prev, aiMsg]);
      setPreviewContent(text); // 更新预览
      setPreviewHTML(html); // ✅ HTML 预览（如果用了 dangerouslySetInnerHTML）
      setPreviewURL(`/api/download/${filename}`);

      // ✅ 自动更新会话标题（仅第一次）
      if (messages.length === 0 && currentConv) {
        const newTitle = input.length > 20 ? input.slice(0, 20) + "..." : input;
        dispatch({ type: "UPDATE_CONVERSATION", payload: { id: currentConv.id, title: newTitle } });
      }

      // ✅ 重置模板选择
      setSelectedTemplate(null);

    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "生成失败，请重试";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
// ----------------- 下载文件 -----------------
const handleDownload = async (filename: string) => {
  if (loading) return;
  setLoading(true);
  try {
    // ✅ 使用封装的 api 实例（它会自动携带 token）
    const response = await api.get(`/api/download/${filename}`, {
      responseType: "blob", // 必须是 blob
    });

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename); // 设置下载的文件名
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    if (err.response?.status === 401) {
      alert("登录已过期，请重新登录");
      navigate("/login");
    } else if (err.response?.status === 404) {
      alert("文件不存在");
    } else {
      alert("下载失败：" + (err.message || "未知错误"));
    }
  } finally {
    setLoading(false);
  }
};
  // ----------------- 搜索过滤模板 -----------------
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  // ----------------- 预览内容（支持 HTML）-----------------
  const [previewHTML, setPreviewHTML] = useState(""); // 用于 dangerouslySetInnerHTML
  const [previewURL, setPreviewURL] = useState("");  // 下载链接

  return (
    <div 
  className="grid h-screen bg-white"
  style={{
    // 定义三列：
    // 第一列：侧边栏（固定宽 256px，收起时为 0）
    // 第二列：聊天区（自动填充）
    // 第三列：预览区（固定 384px）
    gridTemplateColumns: isOpen ? '256px 1fr 384px' : '0 1fr 384px',
    transition: 'grid-template-columns 0.3s ease-in-out'
  }}
>
  {/* ========== 1. 侧边栏 ========== */}
  <Sidebar onSelect={() => {}} />

  {/* ========== 2. 聊天主区域 ========== */}
  <div className="flex flex-col overflow-hidden">
    {/* 消息列表 */}
    <div className="flex-1 p-4 overflow-y-auto space-y-4">
      {/* 原来的消息渲染逻辑 */}
      {messages.length === 0 ? (
        <p className="text-gray-500 text-center">暂无消息</p>
      ) : (
        messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.docx_file && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(msg.docx_file!); }}
                  className="text-sm mt-2 inline-block text-green-600 hover:underline cursor-pointer"
                  disabled={loading}
                >
                  📥 下载公文文件
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>

    {/* 输入框 */}
    <div className="p-4 border-t bg-gray-50">
      {/* 原输入框逻辑 */}
    </div>
  </div>

  {/* ========== 3. 右侧预览 + 模板 ========== */}
  <div className="border-l bg-gray-50 flex flex-col overflow-hidden">
    {/* 预览 */}
    <div className="flex-1 p-4 overflow-y-auto">
      <h3 className="font-bold mb-2">公文预览</h3>
      <div
        className="bg-white p-3 border rounded text-sm"
        dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse(previewContent || "暂无内容") }}
      />
    </div>

    {/* 模板库 */}
    <div className="border-t p-4 flex-shrink-0">
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
                const res = await api.get(`/api/templates/${t.id}`);
                setSelectedTemplate(res.data.content);
              } catch (err) {
                console.error("加载模板失败", err);
                alert("加载失败");
              }
            }}
          >
            {t.original_name}
          </li>
        ))}
      </ul>
    </div>
  </div>
</div>

  );
}