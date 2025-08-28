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
  const [previewContent, setPreviewContent] = useState("请开始输入您的公文需求，系统将为您生成相应内容。");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<{ 
    id: number; 
    original_name: string; 
    filename: string 
  }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [currentConv, setCurrentConv] = useState<any>(null);

  // 布局状态 - 支持用户调整中间栏和右侧栏宽度
  const [sidebarWidth, setSidebarWidth] = useState(240); // 侧边栏固定宽度
  const [middleWidth, setMiddleWidth] = useState<number>(500); // 中间栏宽度
  const [isResizing, setIsResizing] = useState(false);

  // 关键Ref
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 计算初始宽度 - 中间栏和右侧栏合理分配
  const calculateInitialWidths = () => {
    if (!mainContainerRef.current) return;
    
    const containerWidth = mainContainerRef.current.offsetWidth;
    // 中间栏初始占比60%，但不小于最小宽度
    const calculatedMiddleWidth = Math.max(400, Math.min(containerWidth - 300, containerWidth * 0.6));
    setMiddleWidth(calculatedMiddleWidth);
  };

  // 更新拖拽手柄位置
  const updateResizeHandlePosition = () => {
    if (!resizeHandleRef.current || !pageRef.current) return;
    
    // 获取页面左侧偏移，确保手柄定位正确
    const pageRect = pageRef.current.getBoundingClientRect();
    // 手柄位置 = 侧边栏宽度 + 中间栏宽度 - 手柄一半宽度 + 页面左侧偏移
    const handleLeft = sidebarWidth + middleWidth - 2 + pageRect.left;
    resizeHandleRef.current.style.left = `${handleLeft}px`;
  };

  // 开始拖拽
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    
    // 添加全局事件监听 - 使用捕获阶段确保不会错过事件
    document.addEventListener('mousemove', handleResizeMove, true);
    document.addEventListener('mouseup', handleResizeEnd, true);
    document.addEventListener('mouseleave', handleResizeEnd, true);
    
    // 添加强调样式
    if (resizeHandleRef.current) {
      resizeHandleRef.current.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // 防止拖拽时选中文本
    }
  };

  // 拖拽过程 - 使用原生事件确保坐标准确
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !mainContainerRef.current || !pageRef.current) return;
    
    const containerRect = mainContainerRef.current.getBoundingClientRect();
    const pageRect = pageRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    
    // 计算新宽度 = 鼠标位置 - 侧边栏宽度 - 页面左侧偏移
    let newMiddleWidth = e.clientX - sidebarWidth - pageRect.left;
    
    // 限制宽度范围：最小400px，最大为主容器宽度-300px
    const minWidth = 400;
    const maxWidth = containerWidth - 300;
    newMiddleWidth = Math.max(minWidth, Math.min(newMiddleWidth, maxWidth));
    
    // 更新状态
    setMiddleWidth(newMiddleWidth);
    updateResizeHandlePosition();
  };

  // 结束拖拽
  const handleResizeEnd = () => {
    setIsResizing(false);
    
    // 移除全局事件监听
    document.removeEventListener('mousemove', handleResizeMove, true);
    document.removeEventListener('mouseup', handleResizeEnd, true);
    document.removeEventListener('mouseleave', handleResizeEnd, true);
    
    // 移除强调样式
    if (resizeHandleRef.current) {
      resizeHandleRef.current.classList.remove('resizing');
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // 同步所有区域高度
  const syncAllHeights = () => {
    if (!pageRef.current) return;
    
    const pageHeight = pageRef.current.offsetHeight;
    const headerHeight = 48; // 顶部标题栏高度
    const inputAreaHeight = 72; // 中间输入区高度
    const templateAreaHeight = 160; // 右侧模板库高度
    
    // 同步中间栏高度
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageHeight}px`;
      const middleContentArea = middlePanelRef.current.querySelector('.middle-content-area');
      if (middleContentArea) {
        (middleContentArea as HTMLElement).style.height = 
          `${pageHeight - headerHeight - inputAreaHeight}px`;
      }
    }
    
    // 同步右侧栏高度
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageHeight}px`;
      const rightContentArea = rightPanelRef.current.querySelector('.right-content-area');
      if (rightContentArea) {
        (rightContentArea as HTMLElement).style.height = 
          `${pageHeight - headerHeight - templateAreaHeight}px`;
      }
    }
    
    // 同步拖拽手柄高度
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.height = `${pageHeight}px`;
    }
  };

  // 初始化和窗口大小变化时调整布局
  useEffect(() => {
    calculateInitialWidths();
    syncAllHeights();
    updateResizeHandlePosition();
    
    const handleWindowResize = () => {
      if (mainContainerRef.current) {
        const containerWidth = mainContainerRef.current.offsetWidth;
        // 保持当前比例，但不超过限制
        setMiddleWidth(Math.max(400, Math.min(containerWidth - 300, middleWidth)));
      }
      syncAllHeights();
      updateResizeHandlePosition();
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mousemove', handleResizeMove, true);
      document.removeEventListener('mouseup', handleResizeEnd, true);
      document.removeEventListener('mouseleave', handleResizeEnd, true);
    };
  }, []);

  // 中间栏宽度变化时更新手柄位置
  useEffect(() => {
    updateResizeHandlePosition();
  }, [middleWidth]);

  // 消息自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载对话内容
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

  // 加载模板
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

  // 选择模板
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

  // 下载文件
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

  // 发送消息
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

  // 过滤模板
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  // 预览HTML
  const [previewHTML, setPreviewHTML] = useState("");
  useEffect(() => {
    if (previewContent) setPreviewHTML(marked.parse(previewContent));
  }, [previewContent]);

  return (
    <div 
      ref={pageRef}
      style={{ display: "flex", height: "100vh", backgroundColor: "white", overflow: "hidden", position: "relative" }}
    >
      {/* 侧边栏 */}
      <Sidebar 
        onSelect={() => {}} 
        style={{ 
          width: `${sidebarWidth}px`, 
          height: "100vh", 
          flexShrink: 0, 
          borderRight: "1px solid #e2e8f0",
          margin: 0,
          padding: 0,
          zIndex: 1
        }} 
      />

      {/* 主容器（中+右栏） */}
      <div 
        ref={mainContainerRef}
        style={{ display: "flex", flex: 1, overflow: "hidden", height: "100vh", margin: 0, padding: 0 }}
      >
        {/* 中间栏 */}
        <div
          ref={middlePanelRef}
          style={{ 
            display: "flex",
            flexDirection: "column",
            width: `${middleWidth}px`, 
            height: "100vh", 
            margin: 0,
            padding: 0,
            overflow: "hidden",
            backgroundColor: "white",
            borderRight: "1px solid #e2e8f0",
            transition: "width 0.1s ease-out", // 平滑过渡
            zIndex: 1
          }}
        >
          {/* 顶部标题栏 */}
          <div style={{
            height: "48px",
            margin: 0,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f9fafb",
            display: "flex",
            alignItems: "center"
          }}>
            <h2 style={{
              margin: 0,
              padding: 0,
              lineHeight: "48px",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937"
            }}>
              {currentConv?.title || (id === "new" ? "新对话" : "公文生成")}
            </h2>
          </div>

          {/* 消息区 */}
          <div
            className="middle-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
            }}
          >
            {loading && id !== "new" ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
              }}>
                加载对话中...
              </div>
            ) : messages.length === 0 ? (
              <p style={{
                marginTop: "32px",
                textAlign: "center",
                color: "#6b7280",
              }}>暂无消息</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  style={{ 
                    display: "flex",
                    marginBottom: "16px",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      backgroundColor: msg.role === "user" ? "#2563eb" : "#f3f4f6",
                      color: msg.role === "user" ? "white" : "#1f2937",
                    }}
                  >
                    <p style={{ 
                      margin: 0, 
                      padding: 0, 
                      whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                    </p>

                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.docx_file!);
                        }}
                        disabled={loading}
                        style={{
                          marginTop: "8px",
                          color: msg.role === "user" ? "#a5b4fc" : "#16a34a",
                          cursor: "pointer",
                          border: "none",
                          background: "none",
                          padding: 0,
                          fontSize: "14px",
                          textDecoration: "underline",
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

          {/* 底部输入区 */}
          <div style={{
            height: "72px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f9fafb",
            display: "flex",
            alignItems: "center"
          }}>
            <div style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{
                  width: "96px",
                  height: "40px",
                  padding: "0 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1f2937",
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
                  lineHeight: "40px",
                  color: "#1f2937",
                  backgroundColor: "white"
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
              <p style={{
                position: "absolute",
                bottom: "8px",
                left: `${sidebarWidth + 16}px`,
                fontSize: "12px",
                color: "#2563eb",
                margin: 0
              }}>
                ✅ 已选择模板作为参考
                <button
                  onClick={() => setSelectedTemplate(null)}
                  style={{
                    marginLeft: "8px",
                    color: "#dc2626",
                    textDecoration: "underline",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0
                  }}
                >
                  取消
                </button>
              </p>
            )}
          </div>
        </div>

        {/* 拖拽调整手柄 - 使用fixed定位确保能被鼠标捕获 */}
        <div
          ref={resizeHandleRef}
          onMouseDown={handleResizeStart}
          style={{
            position: "fixed",
            top: 0,
            width: "6px",
            cursor: "col-resize",
            backgroundColor: "transparent",
            zIndex: 10,
            transition: "background-color 0.2s ease"
          }}
          className="resize-handle"
        >
          {/* 手柄视觉提示 */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "8px",
            height: "24px",
            borderLeft: "2px dashed #94a3b8",
            borderRight: "2px dashed #94a3b8"
          }} />
        </div>

        {/* 右侧栏 */}
        <div
          ref={rightPanelRef}
          style={{ 
            flex: 1, 
            height: "100vh", 
            minWidth: "300px",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb",
            zIndex: 1
          }}
        >
          {/* 顶部预览标题栏 */}
          <div style={{
            height: "48px",
            margin: 0,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            backgroundColor: "#f9fafb",
          }}>
            <h3 style={{
              margin: 0,
              padding: 0,
              lineHeight: "48px",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
            }}>公文预览</h3>
          </div>

          {/* 预览区 */}
          <div
            className="right-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1f2937",
              }}
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse("暂无内容") }}
            />
          </div>

          {/* 底部模板库 */}
          <div style={{
            height: "160px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              margin: "8px 0",
              gap: "8px",
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: "600",
                color: "#1f2937",
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
                  fontSize: "12px",
                  color: "#1f2937",
                  backgroundColor: "white",
                }}
              />
            </div>
            <ul style={{
              flex: 1,
              fontSize: "12px",
              color: "#374151",
              margin: 0,
              padding: 0,
              listStyle: "none",
              overflowY: "auto",
            }}>
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => (
                  <li
                    key={t.id}
                    title={t.original_name}
                    onClick={() => handleTemplateSelect(t.filename)}
                    style={{
                      padding: "4px 8px",
                      marginBottom: "4px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    onMouseOver={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = "#e5e7eb"}
                    onMouseOut={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li style={{
                  padding: "4px 8px",
                  color: "#9ca3af",
                }}>没有找到模板</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* 全局样式 - 拖拽时的视觉反馈 */}
      <style jsx global>{`
        .resize-handle {
          transition: background-color 0.2s ease;
        }
        .resize-handle:hover {
          background-color: rgba(148, 163, 184, 0.2);
        }
        .resize-handle.resizing {
          background-color: rgba(148, 163, 184, 0.4);
        }
      `}</style>
    </div>
  );
}
    