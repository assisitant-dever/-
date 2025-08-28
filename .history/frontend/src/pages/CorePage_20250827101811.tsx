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

  // 业务状态
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

  // 布局核心状态（像素级控制）
  const [middleWidth, setMiddleWidth] = useState(800); // 中间栏宽度（px）
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240); // 侧边栏固定宽度

  // 关键Ref（所有容器精确控制）
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ----------------- 1. 拖拽手柄定位修复（解决竖条在最右侧问题） -----------------
  const updateResizeHandlePosition = () => {
    if (!resizeHandleRef.current || !middlePanelRef.current || !pageRef.current) return;
    
    // 计算手柄正确位置：侧边栏宽度 + 中间栏宽度 - 手柄一半宽度（确保居中）
    const handleLeft = sidebarWidth + middleWidth - 1; // 1是手柄一半宽度（总宽度2px）
    resizeHandleRef.current.style.left = `${handleLeft}px`;
  };

  // 拖拽逻辑（精确像素计算）
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    // 全局监听，防止拖拽丢失
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('mouseleave', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !mainContainerRef.current || !pageRef.current) return;
    
    // 计算中间栏新宽度：鼠标X坐标 - 侧边栏宽度 - 手柄宽度（2px）
    const mainContainerRect = mainContainerRef.current.getBoundingClientRect();
    let newWidth = e.clientX - sidebarWidth - 2;
    
    // 限制宽度范围（最小400px，最大主容器宽度-300px）
    const minWidth = 400;
    const maxWidth = mainContainerRect.width - 300;
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    
    setMiddleWidth(newWidth);
    updateResizeHandlePosition(); // 实时更新手柄位置
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('mouseleave', handleResizeEnd);
  };

  // ----------------- 2. 高度对齐修复（解决顶部/底部错位） -----------------
  const syncAllHeights = () => {
    if (!pageRef.current || !middlePanelRef.current || !rightPanelRef.current) return;
    
    // 1. 基础高度：页面总高度（100vh）
    const pageHeight = pageRef.current.offsetHeight;
    
    // 2. 固定区域高度（像素级统一）
    const headerHeight = 48; // 顶部标题栏高度（h-12）
    const inputAreaHeight = 72; // 中间输入区高度（h-18）
    const templateAreaHeight = 160; // 右侧模板库高度（h-40）
    
    // 3. 中间栏高度同步
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageHeight}px`;
      // 消息区高度：总高度 - 标题栏 - 输入区（确保内容区高度正确）
      const middleContentArea = middlePanelRef.current.querySelector('.middle-content-area');
      if (middleContentArea) {
        middleContentArea.style.height = `${pageHeight - headerHeight - inputAreaHeight}px`;
      }
    }
    
    // 4. 右侧栏高度同步
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageHeight}px`;
      // 预览区高度：总高度 - 标题栏 - 模板库（确保与中间消息区高度匹配）
      const rightContentArea = rightPanelRef.current.querySelector('.right-content-area');
      if (rightContentArea) {
        rightContentArea.style.height = `${pageHeight - headerHeight - templateAreaHeight}px`;
      }
    }
    
    // 5. 拖拽手柄高度同步
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.height = `${pageHeight}px`;
    }
  };

  // 初始化+窗口变化时同步所有布局
  useEffect(() => {
    // 初始化侧边栏宽度（确保与实际渲染一致）
    setSidebarWidth(240);
    
    // 初始化中间栏宽度（主容器50%）
    if (mainContainerRef.current) {
      setMiddleWidth(Math.floor(mainContainerRef.current.offsetWidth * 0.5));
    }
    
    // 同步高度和手柄位置
    syncAllHeights();
    updateResizeHandlePosition();
    
    // 窗口变化时重新同步
    window.addEventListener('resize', () => {
      syncAllHeights();
      updateResizeHandlePosition();
    });
    
    // 组件卸载清理
    return () => {
      window.removeEventListener('resize', syncAllHeights);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // 中间栏宽度变化时同步手柄位置
  useEffect(() => {
    updateResizeHandlePosition();
  }, [middleWidth]);

  // ----------------- 3. 原有业务逻辑保留 -----------------
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

  // ----------------- 4. 布局渲染（像素级对齐） -----------------
  return (
    <div 
      ref={pageRef}
      className="flex h-screen bg-white overflow-hidden"
      style={{ position: "relative" }}
    >
      {/* 侧边栏：固定宽度240px，100%高度 */}
      <Sidebar 
        onSelect={() => {}} 
        style={{ 
          width: `${sidebarWidth}px`, 
          height: "100vh", 
          flexShrink: 0, 
          borderRight: "1px solid #e2e8f0",
          margin: 0,
          padding: 0
        }} 
      />

      {/* 主容器（中+右栏）：剩余宽度，100%高度 */}
      <div 
        ref={mainContainerRef}
        className="flex flex-1 overflow-hidden"
        style={{ height: "100vh", margin: 0, padding: 0 }}
      >
        {/* 中间栏：固定宽度，100%高度 */}
        <div
          ref={middlePanelRef}
          className="flex flex-col bg-white border-r border-gray-200"
          style={{ 
            width: `${middleWidth}px`, 
            height: "100vh", 
            margin: 0,
            padding: 0,
            overflow: "hidden"
          }}
        >
          {/* 顶部标题栏：固定48px高度，像素级对齐 */}
          <div className="h-12 px-4 border-b border-gray-200 bg-gray-50 flex items-center" style={{
            height: "48px",
            margin: 0,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0"
          }}>
            <h2 className="text-lg font-semibold text-gray-800" style={{
              margin: 0,
              padding: 0,
              lineHeight: "48px" // 垂直居中
            }}>
              {currentConv?.title || (id === "new" ? "新对话" : "公文生成")}
            </h2>
          </div>

          {/* 消息区：固定高度计算，overflow-auto */}
          <div className="middle-content-area px-4 py-3 overflow-y-auto space-y-4" style={{
            padding: "12px 16px",
            margin: 0,
            overflowY: "auto"
          }}>
            {loading && id !== "new" ? (
              <div className="flex justify-center items-center h-full text-gray-500" style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                加载对话中...
              ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center mt-8" style={{
                marginTop: "32px",
                textAlign: "center"
              }}>暂无消息</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  style={{ marginBottom: "16px" }}
                >
                  <div
                    className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${
                      msg.role === "user" 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-100 text-gray-800"
                    }`}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                    }}
                  >
                    <p className="whitespace-pre-wrap" style={{ margin: 0, padding: 0 }}>
                      {msg.content}
                    </p>
                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.docx_file!);
                        }}
                        className="text-sm mt-2 inline-block text-green-600 hover:underline cursor-pointer"
                        disabled={loading}
                        style={{
                          marginTop: "8px",
                          color: "#16a34a",
                          cursor: "pointer"
                        }}
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

          {/* 底部输入区：固定72px高度，与右侧模板库底部对齐 */}
          <div className="px-4 border-t border-gray-200 bg-gray-50 flex items-center" style={{
            height: "72px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center"
          }}>
            <div className="flex w-full space-x-2" style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
                style={{
                  width: "96px",
                  height: "40px",
                  padding: "0 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  height: "40px",
                  padding: "0 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  resize: "none",
                  lineHeight: "40px"
                }}
              />
              <Button 
                onClick={handleSend} 
                disabled={loading || !input.trim()}
                style={{
                  height: "40px",
                  padding: "0 16px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                {loading ? "生成中..." : "发送"}
              </Button>
            </div>
            {selectedTemplate && (
              <p className="absolute bottom-2 left-[272px] text-xs text-blue-600" style={{
                position: "absolute",
                bottom: "8px",
                left: `${sidebarWidth + 16}px`, // 侧边栏宽度+内边距
                fontSize: "12px",
                color: "#2563eb",
                margin: 0
              }}>
                ✅ 已选择模板作为参考
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="ml-2 text-red-500 underline"
                  style={{
                    marginLeft: "8px",
                    color: "#dc2626",
                    textDecoration: "underline",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  取消
                </button>
              </p>
            )}
          </div>
        </div>

        {/* 拖拽手柄：精确居中在中间栏右侧，z-index最高 */}
        <div
          ref={resizeHandleRef}
          className={`absolute top-0 bottom-0 z-50 transition-all ${
            isResizing 
              ? "bg-blue-500 cursor-col-resize w-2 opacity-100" 
              : "bg-gray-200 hover:bg-gray-300 cursor-col-resize w-2 opacity-70"
          }`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "2px",
            zIndex: 100, // 确保在最上层
            cursor: "col-resize"
          }}
          onMouseDown={handleResizeStart}
        />

        {/* 右侧栏：剩余宽度，100%高度 */}
        <div
          ref={rightPanelRef}
          className="flex flex-col bg-gray-50"
          style={{ 
            flex: 1, 
            height: "100vh", 
            minWidth: "300px",
            margin: 0,
            padding: 0,
            overflow: "hidden"
          }}
        >
          {/* 顶部预览标题栏：固定48px高度，与中间栏标题栏对齐 */}
          <div className="h-12 px-4 border-b border-gray-200 bg-gray-50 flex items-center" style={{
            height: "48px",
            margin: 0,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center"
          }}>
            <h3 className="font-semibold text-gray-800" style={{
              margin: 0,
              padding: 0,
              lineHeight: "48px", // 垂直居中
              fontSize: "16px"
            }}>公文预览</h3>
          </div>

          {/* 预览区：固定高度计算，与中间消息区对齐 */}
          <div className="right-content-area px-4 py-3 overflow-y-auto" style={{
            padding: "12px 16px",
            margin: 0,
            overflowY: "auto"
          }}>
            <div
              className="bg-white p-4 border border-gray-200 rounded text-sm"
              style={{
                backgroundColor: "white",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px"
              }}
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse("暂无内容") }}
            />
          </div>

          {/* 底部模板库：固定160px高度，与中间输入区底部对齐 */}
          <div className="px-4 border-t border-gray-200 bg-gray-50" style={{
            height: "160px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column"
          }}>
            <div className="flex items-center mb-2 mt-1" style={{
              display: "flex",
              alignItems: "center",
              margin: "8px 0",
              gap: "8px"
            }}>
              <h3 className="font-semibold text-sm text-gray-800" style={{
                margin: 0,
                fontSize: "14px"
              }}>模板库</h3>
              <input
                type="text"
                placeholder="搜索模板..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  height: "24px",
                  padding: "0 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "12px"
                }}
              />
            </div>
            <ul className="text-xs text-gray-700 space-y-1 overflow-y-auto" style={{
              flex: 1,
              fontSize: "12px",
              color: "#374151",
              margin: 0,
              padding: 0,
              listStyle: "none",
              overflowY: "auto"
            }}>
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="p-1 hover:bg-gray-200 rounded truncate cursor-pointer"
                    title={t.original_name}
                    onClick={() => handleTemplateSelect(t.filename)}
                    style={{
                      padding: "4px 8px",
                      marginBottom: "4px",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li className="p-1 text-gray-400" style={{
                  padding: "4px 8px",
                  color: "#9ca3af"
                }}>没有找到模板</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}