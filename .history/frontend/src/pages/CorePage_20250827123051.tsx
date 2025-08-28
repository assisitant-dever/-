import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";
import { marked } from "marked";
// 注意：需确保saveAs函数存在（通常来自file-saver库，若没有需安装：npm install file-saver）
import { saveAs } from "file-saver"; 
import Sidebar from "../components/Sidebar";

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

  // ----------------- 拖拽相关状态（关键修改） -----------------
  const [mainWidth, setMainWidth] = useState(50); // 中间区宽度（百分比）
  const [resizeStart, setResizeStart] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  // 容器引用：获取中间区+分隔条+右侧区的总宽度（用于计算百分比）
  const containerRef = useRef<HTMLDivElement>(null);

  // 滚动容器引用
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ----------------- 拖拽逻辑（关键修复） -----------------
  // 1. 分隔条按下：开始拖拽
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // 阻止文本选中等默认行为
    setIsResizing(true);
    // 给文档绑定mousemove/mouseup（避免鼠标移出分隔条后失效）
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  // 2. 鼠标移动：计算中间区宽度
  const handleResize = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    // 获取容器总宽度（中间区+分隔条+右侧区的整体宽度）
    const containerTotalWidth = containerRef.current.offsetWidth;
    // 获取分隔条到容器左侧的距离（即中间区的目标宽度）
    const middleWidth = e.clientX - containerRef.current.getBoundingClientRect().left;
    // 计算百分比（限制30%-70%范围，避免宽度过小/过大）
    const middleWidthPercent = (middleWidth / containerTotalWidth) * 100;
    setMainWidth(Math.max(30, Math.min(middleWidthPercent, 70)));
  };

  // 3. 鼠标松开：结束拖拽
  const handleResizeEnd = () => {
    setIsResizing(false);
    // 移除文档上的事件绑定（避免内存泄漏）
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  // ----------------- 原有逻辑保留（仅修复currentConv未定义问题） -----------------
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
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - resizeStart;
      const newWidth =
        (mainWidth * window.innerWidth - delta) / window.innerWidth * 100;
      setMainWidth(Math.max(30, Math.min(newWidth, 70)));
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStart, mainWidth]);
  const handleTemplateSelect = async (filename: string) => {
    if (selectedTemplate === filename) return;
    try {
      const res = await api.get(`/api/template-content/${filename}`);
      setSelectedTemplate(res.data.content);
      alert(`✅ 已选中模板：${filename}，将作为格式参考`);
    } catch (err) {
      alert("❌ 加载模板内容失败");
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get(`/api/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      });
      saveAs(res.data, filename); // 依赖file-saver库，需确保安装
    } catch (err) {
      console.error("下载失败", err);
      alert("下载失败");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

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

      // 修复currentConv未定义问题：重新获取当前会话
      const currentConv = state.conversations.find((c) => c.id.toString() === id) || null;
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

  // ----------------- 渲染部分（关键添加分隔条） -----------------
  return (
    <div className="flex h-screen bg-white">
      {/* 左侧侧边栏 */}
      <Sidebar onSelect={() => {}} />
      
      {/* 中间区+分隔条+右侧区：统一容器（用于计算总宽度） */}
      <div ref={containerRef} className="flex h-screen flex-1">
        {/* 1. 中间对话区（宽度由mainWidth控制） */}
        <div
          className="flex flex-col bg-white"
          style={{ 
            width: `${mainWidth}%`, // 用width而非flexBasis，避免flex布局干扰
            transition: "width 0.1s ease" // 缩短过渡时间，提升拖拽流畅度
          }}
        >
          {/* 聊天记录区 */}
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
                      msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
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

        {/* 拖拽条 */}
        <div
          onMouseDown={handleResizeStart}
          className="w-1 cursor-col-resize bg-gray-300 hover:bg-gray-400"
        />

        {/* 3. 右侧功能区（宽度=100%-中间区宽度） */}
        <div
          className="flex flex-col bg-gray-50 border-l"
          style={{ 
            width: `${100 - mainWidth}%`, // 与中间区宽度互补
            transition: "width 0.1s ease"
          }}
        >
          {/* 预览区域 */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="font-bold mb-2">公文预览</h3>
            <div
              className="bg-white p-3 border rounded text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse(previewContent || "暂无内容") }}
            />
          </div>

          {/* 模板库（新增搜索框，优化体验） */}
          <div className="p-2 border-t">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板..."
              className="w-full px-2 py-1 text-xs border rounded mb-2"
            />
            <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => (
                  <li
                    key={t.id}
                    className={`p-1 rounded truncate cursor-pointer ${selectedTemplate === t.filename ? "bg-blue-100" : "hover:bg-gray-200"}`}
                    title={t.original_name}
                    onClick={() => handleTemplateSelect(t.filename)}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li className="p-1 text-gray-400 text-center">暂无匹配模板</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}