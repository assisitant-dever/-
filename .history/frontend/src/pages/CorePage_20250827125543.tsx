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

  // ---------------------- 业务状态（保持不变）----------------------
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

  // ---------------------- 布局状态（新增右侧栏拖拽相关）----------------------
  const [sidebarWidth, setSidebarWidth] = useState(240); // 左侧边栏固定宽度
  const [middleWidth, setMiddleWidth] = useState<number | null>(null); // 中间栏宽度
  const [rightWidth, setRightWidth] = useState<number | null>(null); // 右侧栏宽度（新增）
  const [isResizingMiddle, setIsResizingMiddle] = useState(false); // 中间栏拖拽状态
  const [isResizingRight, setIsResizingRight] = useState(false); // 右侧栏拖拽状态（新增）
  const [startX, setStartX] = useState(0);

  // ---------------------- 关键Ref（新增右侧栏拖拽手柄Ref）----------------------
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleMiddleRef = useRef<HTMLDivElement>(null); // 中间栏拖拽手柄
  const resizeHandleRightRef = useRef<HTMLDivElement>(null); // 右侧栏拖拽手柄（新增）
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---------------------- 1. 初始宽度计算（适配右侧栏）----------------------
  const calculateInitialWidths = () => {
    if (!mainContainerRef.current) return;
    
    const containerWidth = mainContainerRef.current.offsetWidth;
    // 初始比例：中间栏55% + 右侧栏45%，均设置最小宽度限制
    const calculatedMiddleWidth = Math.max(400, Math.floor(containerWidth * 0.55));
    const calculatedRightWidth = Math.max(300, Math.floor(containerWidth * 0.45));
    
    // 防止总宽度超出容器（因四舍五入可能偏差）
    const totalWidth = calculatedMiddleWidth + calculatedRightWidth;
    if (totalWidth > containerWidth) {
      const excess = totalWidth - containerWidth;
      setMiddleWidth(calculatedMiddleWidth - excess);
      setRightWidth(calculatedRightWidth);
    } else {
      setMiddleWidth(calculatedMiddleWidth);
      setRightWidth(calculatedRightWidth);
    }
  };

  // ---------------------- 2. 拖拽手柄位置更新（分别控制两个手柄）----------------------
  const updateResizeHandlePositions = () => {
    if (!pageRef.current || !middleWidth || !rightWidth) return;
    
    const pageRect = pageRef.current.getBoundingClientRect(); // 页面整体偏移（解决滚动/定位问题）
    const baseLeft = sidebarWidth + pageRect.left; // 左侧边栏宽度 + 页面左偏移（基准值）

    // 中间手柄（中间栏右侧）：基准值 + 中间栏宽度 - 手柄一半宽度（4px/2=2px）
    if (resizeHandleMiddleRef.current) {
      const middleHandleLeft = baseLeft + middleWidth - 2;
      resizeHandleMiddleRef.current.style.left = `${middleHandleLeft}px`;
    }

    // 右侧手柄（右侧栏右侧）：基准值 + 中间栏宽度 + 右侧栏宽度 - 手柄一半宽度
    if (resizeHandleRightRef.current) {
      const rightHandleLeft = baseLeft + middleWidth + rightWidth - 2;
      resizeHandleRightRef.current.style.left = `${rightHandleLeft}px`;
    }
  };

  // ---------------------- 3. 中间栏拖拽逻辑（保留并优化）----------------------
  const handleResizeMiddleStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!middleWidth || !mainContainerRef.current) return;
    
    setIsResizingMiddle(true);
    setStartX(e.clientX);
    // 全局监听，防止拖拽丢失
    document.addEventListener('mousemove', handleResizeMiddleMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('mouseleave', handleResizeEnd);
    // 视觉反馈
    resizeHandleMiddleRef.current?.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMiddleMove = (e: MouseEvent) => {
    if (!isResizingMiddle || !mainContainerRef.current || !middleWidth || !rightWidth) return;
    
    const containerRect = mainContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const pageRect = pageRef.current?.getBoundingClientRect() || { left: 0 };

    // 计算中间栏新宽度：鼠标X坐标 - 页面左偏移 - 左侧边栏宽度
    const newMiddleWidth = e.clientX - pageRect.left - sidebarWidth;
    // 限制中间栏范围：最小400px，最大=容器宽度-右侧栏最小宽度（300px）
    const validMiddleWidth = Math.max(400, Math.min(newMiddleWidth, containerWidth - 300));
    
    // 中间栏变化时，右侧栏宽度自动调整（保持总宽度=容器宽度）
    const newRightWidth = containerWidth - validMiddleWidth;
    setMiddleWidth(validMiddleWidth);
    setRightWidth(newRightWidth);
    
    setStartX(e.clientX);
    updateResizeHandlePositions();
  };

  // ---------------------- 4. 右侧栏拖拽逻辑（新增核心）----------------------
  const handleResizeRightStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rightWidth || !mainContainerRef.current) return;
    
    setIsResizingRight(true);
    setStartX(e.clientX);
    // 全局监听
    document.addEventListener('mousemove', handleResizeRightMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('mouseleave', handleResizeEnd);
    // 视觉反馈
    resizeHandleRightRef.current?.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeRightMove = (e: MouseEvent) => {
    if (!isResizingRight || !mainContainerRef.current || !middleWidth || !rightWidth) return;
    
    const containerRect = mainContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const pageRect = pageRef.current?.getBoundingClientRect() || { left: 0 };
    const baseLeft = sidebarWidth + pageRect.left; // 基准值

    // 计算右侧栏新宽度：鼠标X坐标 - 基准值 - 中间栏宽度
    const newRightWidth = e.clientX - baseLeft - middleWidth;
    // 限制右侧栏范围：最小300px，最大=容器宽度-中间栏最小宽度（400px）
    const validRightWidth = Math.max(300, Math.min(newRightWidth, containerWidth - 400));
    
    setRightWidth(validRightWidth);
    setStartX(e.clientX);
    updateResizeHandlePositions();
  };

  // ---------------------- 5. 拖拽结束（统一清理）----------------------
  const handleResizeEnd = () => {
    // 重置拖拽状态
    setIsResizingMiddle(false);
    setIsResizingRight(false);
    // 移除全局事件
    document.removeEventListener('mousemove', handleResizeMiddleMove);
    document.removeEventListener('mousemove', handleResizeRightMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('mouseleave', handleResizeEnd);
    // 重置样式
    resizeHandleMiddleRef.current?.classList.remove('resizing');
    resizeHandleRightRef.current?.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // ---------------------- 6. 高度同步（保持不变）----------------------
  const syncAllHeights = () => {
    if (!pageRef.current) return;
    
    const pageHeight = pageRef.current.offsetHeight;
    const headerHeight = 48;
    const inputAreaHeight = 72;
    const templateAreaHeight = 160;
    
    // 中间栏高度
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageHeight}px`;
      const middleContentArea = middlePanelRef.current.querySelector('.middle-content-area');
      if (middleContentArea) {
        (middleContentArea as HTMLElement).style.height = 
          `${pageHeight - headerHeight - inputAreaHeight}px`;
      }
    }
    
    // 右侧栏高度
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageHeight}px`;
      const rightContentArea = rightPanelRef.current.querySelector('.right-content-area');
      if (rightContentArea) {
        (rightContentArea as HTMLElement).style.height = 
          `${pageHeight - headerHeight - templateAreaHeight}px`;
      }
    }
    
    // 两个拖拽手柄高度
    if (resizeHandleMiddleRef.current) resizeHandleMiddleRef.current.style.height = `${pageHeight}px`;
    if (resizeHandleRightRef.current) resizeHandleRightRef.current.style.height = `${pageHeight}px`;
  };

  // ---------------------- 7. 初始化与窗口 resize 适配----------------------
  useEffect(() => {
    calculateInitialWidths();
    syncAllHeights();
    updateResizeHandlePositions();
    
    const handleWindowResize = () => {
      if (!mainContainerRef.current || !middleWidth || !rightWidth) return;
      
      const containerWidth = mainContainerRef.current.offsetWidth;
      // 窗口变化时保持原有宽度比例
      const middleRatio = middleWidth / (middleWidth + rightWidth);
      const rightRatio = rightWidth / (middleWidth + rightWidth);
      
      const newMiddleWidth = Math.max(400, Math.min(Math.floor(containerWidth * middleRatio), containerWidth - 300));
      const newRightWidth = containerWidth - newMiddleWidth;
      
      setMiddleWidth(newMiddleWidth);
      setRightWidth(newRightWidth);
      
      syncAllHeights();
      updateResizeHandlePositions();
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    // 组件卸载清理
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mousemove', handleResizeMiddleMove);
      document.removeEventListener('mousemove', handleResizeRightMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('mouseleave', handleResizeEnd);
    };
  }, [middleWidth, rightWidth]);

  // 宽度变化时更新手柄位置
  useEffect(() => {
    updateResizeHandlePositions();
  }, [middleWidth, rightWidth]);

  // ---------------------- 以下业务逻辑（保持不变）----------------------
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
  useEffect(() => {
    if (previewContent) setPreviewHTML(marked.parse(previewContent));
  }, [previewContent]);

  // ---------------------- 渲染（新增右侧拖拽手柄+右侧栏宽度控制）----------------------
  return (
    <div 
      ref={pageRef}
      style={{ display: "flex", height: "100vh", backgroundColor: "white", overflow: "hidden", position: "relative" }}
    >
      {/* 左侧边栏（固定宽度） */}
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
        {/* 中间栏（宽度由拖拽控制） */}
        <div
          ref={middlePanelRef}
          style={{ 
            display: "flex",
            flexDirection: "column",
            width: middleWidth ? `${middleWidth}px` : '55%', 
            height: "100vh", 
            margin: 0,
            padding: 0,
            overflow: "hidden",
            backgroundColor: "white",
            borderRight: "1px solid #e2e8f0",
            transition: "width 0.1s ease-out"
          }}
        >
          {/* 中间栏标题栏、消息区、输入区（保持不变） */}
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
                    <p style={{ margin: 0, padding: 0, whiteSpace: "pre-wrap" }}>
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

          <div style={{
            height: "72px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f9fafb",
            display: "flex",
            alignItems: "center"
          }}>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}>
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

        {/* 1. 中间栏拖拽手柄（原中间-右侧之间） */}
        <div
          ref={resizeHandleMiddleRef}
          onMouseDown={handleResizeMiddleStart}
          style={{
            position: "fixed", // fixed定位确保不被遮挡
            top: 0,
            width: "4px",
            height: "100vh",
            cursor: "col-resize",
            backgroundColor: "#e2e8f0",
            zIndex: 10,
            transition: "background-color 0.2s ease"
          }}
          className="resize-handle"
        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "8px",
            height: "16px",
            borderLeft: "2px dashed #94a3b8",
            borderRight: "2px dashed #94a3b8"
          }} />
        </div>

        {/* 右侧栏（宽度由拖拽控制） */}
        <div
          ref={rightPanelRef}
          style={{ 
            width: rightWidth ? `${rightWidth}px` : '45%', // 新增：右侧栏宽度控制
            height: "100vh", 
            minWidth: "300px",
            maxWidth: "calc(100% - 400px)", // 最大宽度=容器宽度-中间栏最小宽度
            margin: 0,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb",
            zIndex: 1
          }}
        >
          {/* 右侧栏标题栏、预览区、模板库（保持不变） */}
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

          <div style={{
            height: "160px",
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb",
          }}>
            <div style={{ display: "flex", alignItems: "center", margin: "8px 0", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#1f2937" }}>模板库</h3>
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
                <li style={{ padding: "4px 8px", color: "#9ca3af" }}>没有找到模板</li>
              )}
            </ul>
          </div>
        </div>

        {/* 2. 右侧栏拖拽手柄（新增：右侧栏最右侧） */}
        <div
          ref={resizeHandleRightRef}
          onMouseDown={handleResizeRightStart}
          style={{
            position: "fixed",
            top: 0,
            width: "4px",
            height: "100vh",
            cursor: "col-resize",
            backgroundColor: "#e2e8f0",
            zIndex: 10,
            transition: "background-color 0.2s ease"
          }}
          className="resize-handle"
        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "8px",
            height: "16px",
            borderLeft: "2px dashed #94a3b8",
            borderRight: "2px dashed #94a3b8"
          }} />
        </div>
      </div>

      {/* 拖拽手柄全局样式（两个手柄共用） */}
      <style jsx global>{`
        .resize-handle:hover {
          background-color: #94a3b8;
        }
        .resize-handle.resizing {
          background-color: #64748b;
          boxShadow: 0 0 0 2px rgba(100, 116, 139, 0.2);
        }
      `}</style>
    </div>
  );
}