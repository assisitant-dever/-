import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";
import { marked } from "marked";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";

export default function CorePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  // 状态定义
  const [messages, setMessages] = useState<{ 
    role: string; 
    content: string; 
    docx_file?: string; 
    id?: number 
  }[]>([]);
  const [input, setInput] = useState("");
  const [docType, setDocType] = useState("通知");
  const [previewContent, setPreviewContent] = useState("请开始输入您的公文需求。");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<{ 
    id: number; 
    original_name: string; 
    filename: string 
  }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [currentConv, setCurrentConv] = useState<any>(null);

  // 布局核心状态：中间栏宽度（px值，而非百分比，避免flex计算误差）
  const [middleWidth, setMiddleWidth] = useState(800); // 默认宽度
  const [isResizing, setIsResizing] = useState(false);
  
  // 关键Ref：所有容器都用ref获取真实DOM，避免flex弹性盒的高度不可控问题
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ----------------- 1. 拖拽逻辑：基于绝对定位+像素计算（彻底解决拖拽失效） -----------------
  // 开始拖拽：记录初始位置
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // 阻止文本选择等默认行为
    e.stopPropagation(); // 阻止事件冒泡
    setIsResizing(true);
    
    // 监听全局鼠标事件（确保拖拽不丢失）
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('mouseleave', handleResizeEnd);
  };

  // 拖拽中：精确计算中间栏宽度
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !mainContainerRef.current || !pageRef.current) return;
    
    // 获取主容器（中+右栏）的左偏移量
    const mainContainerRect = mainContainerRef.current.getBoundingClientRect();
    // 计算中间栏新宽度（鼠标X坐标 - 主容器左偏移 - 手柄宽度的一半）
    let newWidth = e.clientX - mainContainerRect.left - 4; // 4是手柄一半宽度
    
    // 限制宽度范围（最小400px，最大主容器宽度-300px）
    const minWidth = 400;
    const maxWidth = mainContainerRect.width - 300;
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    
    // 设置中间栏宽度
    setMiddleWidth(newWidth);
  };

  // 结束拖拽：清理事件监听
  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('mouseleave', handleResizeEnd);
  };

  // ----------------- 2. 高度对齐：强制所有面板100%高度（解决上下错位） -----------------
  const syncPanelHeights = () => {
    if (!pageRef.current || !middlePanelRef.current || !rightPanelRef.current) return;
    
    // 获取页面总高度（排除侧边栏后的高度）
    const pageHeight = pageRef.current.offsetHeight;
    
    // 强制中间栏和右侧栏高度=页面高度（100%）
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageHeight}px`;
    }
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageHeight}px`;
    }
  };

  // 初始化+窗口 resize 时同步高度
  useEffect(() => {
    // 初始化高度和宽度
    syncPanelHeights();
    // 默认宽度=主容器宽度的50%（首次加载时）
    if (mainContainerRef.current) {
      setMiddleWidth(Math.floor(mainContainerRef.current.offsetWidth * 0.5));
    }

    // 窗口大小变化时重新同步
    window.addEventListener('resize', syncPanelHeights);
    
    // 组件卸载时清理
    return () => {
      window.removeEventListener('resize', syncPanelHeights);
    };
  }, []);

  // 拖拽时也同步高度（防止窗口变化导致高度错位）
  useEffect(() => {
    if (isResizing) {
      syncPanelHeights();
    }
  }, [isResizing]);

  // ----------------- 3. 原有业务逻辑保留（消息、模板、发送等） -----------------
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadConversation = async () => {
      if (!id || id === "new") return;
      setLoading(true);
      try {
        const res = await api.get(`/api/conversations/${id}`);
        setCurrentConv(res.data);
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data });
        if (Array.isArray(res.data.messages) && res.data.messages.length > 0) {
          setMessages(res.data.messages);
          setPreviewContent(res.data.messages[res.data.messages.length - 1].content || "");
        } else {
          setMessages([{ role: "assistant", content: "欢迎，请输入您的公文需求。" }]);
        }
      } catch (err) {
        console.error("加载对话失败:", err);
        alert("加载对话失败，请重试");
        navigate("/home");
      } finally {
        setLoading(false);
      }
    };

    if (id === "new") {
      setMessages([{ role: "assistant", content: "欢迎创建新对话，请输入您的公文需求。" }]);
      setCurrentConv(null);
    } else {
      loadConversation();
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [id, dispatch, navigate]);

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

  const handleTemplateSelect = async (filename: string) => {
    if (selectedTemplate === filename) return;
    try {
      const res = await api.get(`/api/template-content/${filename}`);
      setSelectedTemplate(res.data.content);
      alert(`✅ 已选中模板：${filename}，将作为格式参考`);
    } catch (err) {
      console.error("加载模板内容失败:", err);
      alert("❌ 加载模板内容失败");
    }
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
      if (id && id !== "new") formData.append("conv_id", id);
      if (selectedTemplate) formData.append("template_id", selectedTemplate);

      const response = await api.post("/api/generate", formData);
      const { text, filename, conv_id: newConvId } = response.data;

      if (id === "new" && newConvId) {
        navigate(`/conversations/${newConvId}`);
        setCurrentConv({ id: newConvId });
      }

      const aiMsg = {
        role: "assistant",
        content: text,
        docx_file: filename,
        id: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setPreviewContent(text);
      
      if (currentConv) {
        dispatch({ 
          type: "UPDATE_CONVERSATION", 
          payload: { 
            id: currentConv.id, 
            updated_at: new Date().toISOString(),
            last_message: text.substring(0, 20) + "..."
          } 
        });
      } else if (newConvId) {
        dispatch({
          type: "ADD_CONVERSATION",
          payload: {
            id: newConvId,
            title: input.length > 20 ? input.slice(0, 20) + "..." : input,
            updated_at: new Date().toISOString(),
            messages: [userMsg, aiMsg]
          }
        });
      }

      setSelectedTemplate(null);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "生成失败，请重试";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  const [previewHTML, setPreviewHTML] = useState("");
  const [previewURL, setPreviewURL] = useState("");

  useEffect(() => {
    if (previewContent) setPreviewHTML(marked.parse(previewContent));
  }, [previewContent]);

  // ----------------- 4. 布局渲染：固定高度+绝对定位拖拽手柄 -----------------
  return (
    <div 
      ref={pageRef}
      className="flex h-screen bg-white overflow-hidden"
      style={{ position: "relative" }}
    >
      {/* 侧边栏：固定宽度+100%高度 */}
      <Sidebar 
        onSelect={() => {}} 
        style={{ 
          width: "240px", 
          height: "100vh", 
          flexShrink: 0, // 禁止侧边栏收缩
          borderRight: "1px solid #e2e8f0" 
        }} 
      />

      {/* 主容器（中+右栏）：100%高度，剩余宽度 */}
      <div 
        ref={mainContainerRef}
        className="flex flex-1 overflow-hidden"
        style={{ height: "100vh" }}
      >
        {/* 中间栏：固定宽度+100%高度，内部垂直布局 */}
        <div
          ref={middlePanelRef}
          className="flex flex-col bg-white border-r border-gray-200"
          style={{ 
            width: `${middleWidth}px`, 
            height: "100vh", 
            transition: "none" // 取消过渡，避免拖拽卡顿
          }}
        >
          {/* 标题栏：固定高度48px，统一对齐 */}
          <div className="h-12 px-4 border-b border-gray-200 bg-gray-50 flex items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              {currentConv?.title || (id === "new" ? "新对话" : "公文生成")}
            </h2>
          </div>

          {/* 消息区：自适应高度（总高度-标题栏-输入区） */}
          <div className="flex-1 px-4 py-3 overflow-y-auto space-y-4">
            {loading && id !== "new" ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                加载对话中...
              ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center mt-8">暂无消息</p>
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

          {/* 输入区：固定高度72px，统一对齐 */}
          <div className="h-18 px-4 border-t border-gray-200 bg-gray-50 flex items-center">
            <div className="flex w-full space-x-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm h-10"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm resize-none h-10"
                rows={1}
                disabled={loading}
              />
              <Button 
                onClick={handleSend} 
                disabled={loading || !input.trim()}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "生成中..." : "发送"}
              </Button>
            </div>
            {selectedTemplate && (
              <p className="absolute bottom-2 left-4 text-xs text-blue-600">
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

        {/* 拖拽手柄：绝对定位，悬浮在中间栏右侧，z-index最高 */}
        <div
          ref={resizeHandleRef}
          className={`absolute top-0 bottom-0 z-50 ${
            isResizing 
              ? "bg-blue-500 cursor-col-resize w-2" 
              : "bg-gray-200 hover:bg-gray-300 cursor-col-resize w-1 transition-all"
          }`}
          style={{ 
            left: `${240 + middleWidth}px`, // 240是侧边栏宽度，确保手柄在中间栏右侧
            height: "100vh" // 手柄高度=页面高度
          }}
          onMouseDown={handleResizeStart}
        />

        {/* 右侧栏：剩余宽度+100%高度，内部垂直布局 */}
        <div
          ref={rightPanelRef}
          className="flex flex-col bg-gray-50"
          style={{ 
            flex: 1, 
            height: "100vh", 
            minWidth: "300px" // 限制最小宽度，防止被拖到过窄
          }}
        >
          {/* 预览标题栏：固定高度48px，与中间栏标题栏对齐 */}
          <div className="h-12 px-4 border-b border-gray-200 bg-gray-50 flex items-center">
            <h3 className="font-semibold text-gray-800">公文预览</h3>
          </div>

          {/* 预览区：自适应高度（总高度-标题栏-模板库） */}
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <div
              className="bg-white p-4 border border-gray-200 rounded text-sm"
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse("暂无内容") }}
            />
          </div>

          {/* 模板库：固定高度160px，确保底部对齐 */}
          <div className="h-40 px-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center mb-2 mt-1">
              <h3 className="font-semibold text-sm text-gray-800">模板库</h3>
              <input
                type="text"
                placeholder="搜索模板..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-2 flex-1 px-2 py-1 text-xs border border-gray-300 rounded h-6"
              />
            </div>
            <ul className="text-xs text-gray-700 space-y-1 max-h-[calc(100%-28px)] overflow-y-auto">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="p-1 hover:bg-gray-200 rounded truncate cursor-pointer"
                    title={t.original_name}
                    onClick={() => handleTemplateSelect(t.filename)}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li className="p-1 text-gray-400">没有找到模板</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}