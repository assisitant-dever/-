import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";
import { marked } from "marked";
import Sidebar from "../components/Sidebar"; // 路径根据你的项目结构调整

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

  const [mainWidth, setMainWidth] = useState(50); // 中间部分宽度，单位百分比
  const [resizeStart, setResizeStart] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

  // 滚动容器引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart(e.clientX);
  };
  const handleDownload = async (filename: string) => {
  try {
    const res = await api.get(`/api/download/${encodeURIComponent(filename)}`, {
      responseType: "blob",
    });
    saveAs(res.data, filename);
  } catch (err) {
    console.error("下载失败", err);
    alert("下载失败");
  }
};
  const handleResize = (e: React.MouseEvent) => {
    if (!isResizing) return;
    const delta = e.clientX - resizeStart;
    const newWidth = (mainWidth * window.innerWidth - delta) / window.innerWidth * 100;
    setMainWidth(Math.max(30, Math.min(newWidth, 70))); // 限制最小30%，最大70%
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // ----------------- 自动滚动到底部 -----------------
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const currentConv = state.conversations.find((c) => c.id.toString() === id) || null;

    if (currentConv) {
      dispatch({ type: "SET_CURRENT_CONV", payload: currentConv });
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

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [id, state.conversations, dispatch, navigate]);

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
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // 禁用输入框和按钮
    setLoading(true);
    setInput("");
    
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);

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

      setMessages((prev) => [...prev, aiMsg]);
      setPreviewContent(text);
      setPreviewHTML(html);
      setPreviewURL(`/api/download/${filename}`);
      if (messages.length === 0 && currentConv) {
        const newTitle = input.length > 20 ? input.slice(0, 20) + "..." : input;
        dispatch({ type: "UPDATE_CONVERSATION", payload: { id: currentConv.id, title: newTitle } });
      }
      setSelectedTemplate(null);

    } catch (err) {
      const errorMsg = err.response?.data?.detail || "生成失败，请重试";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };


  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  const [previewHTML, setPreviewHTML] = useState(""); 
  const [previewURL, setPreviewURL] = useState(""); 

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar onSelect={() => {}} />
      <div className="flex h-screen flex-1">
        {/* 左侧：对话内容 */}
        <div
          className="flex flex-col"
          style={{ flexBasis: `${mainWidth}%`, transition: "flex-basis 0.3s ease" }}
          onMouseMove={handleResize}
          onMouseUp={handleResizeEnd}
        >
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
                    className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.docx_file!);
                        }}
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

          {/* 输入区域 */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex flex-col space-y-2">
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
                  <option value="对话">对话</option>
                </select>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="请输入您的公文需求（按 Enter 发送，Shift+Enter 换行）..."
                  className="flex-1 px-3 py-2 border rounded text-sm resize-none"
                  rows={1}
                  disabled={loading}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
                  {loading ? "生成中..." : "发送"}
                </Button>
              </div>
              {selectedTemplate && (
                <p className="text-xs text-blue-600">
                  ✅ 已选择模板作为参考
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="ml-2 text-red-500 underline"
                  >
                    取消
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：预览 */}
        <div
          className="w-80 bg-gray-50 flex flex-col border-l"
          style={{ flexBasis: `${100 - mainWidth}%`, transition: "flex-basis 0.3s ease" }}
        >
          {/* 预览区域 */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="font-bold mb-2">公文预览</h3>
            <div
              className="bg-white p-3 border rounded text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse(previewContent || "暂无内容") }}
            />
          </div>

          {/* 模板库 */}
          <div className="border-t p-4">
            {/* 模板内容 */}
          </div>
        </div>
      </div>
    </div>
  );
}
