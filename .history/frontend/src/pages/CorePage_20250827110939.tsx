import React, { useState, useRef, useEffect, useCallback,setDebugInfo } from "react";
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
  const [startX, setStartX] = useState(0); // 新增：记录拖拽开始时的X坐标
  const [sidebarWidth, setSidebarWidth] = useState(240); // 侧边栏固定宽度

  // 关键Ref（所有容器精确控制）
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // 拖拽逻辑（重点修复宽度计算）
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log("拖拽开始");
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setStartX(e.clientX);
    // 记录初始宽度用于调试
    if (mainContainerRef.current) {
      const mainWidth = mainContainerRef.current.offsetWidth;
      setDebugInfo(`初始主容器宽度: ${mainWidth}px, 初始中间栏宽度: ${middleWidth}px`);
    }
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('mouseleave', handleResizeEnd);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !mainContainerRef.current) return;
    
    // 1. 计算鼠标移动距离（增加敏感度，移除微小移动限制）
    const deltaX = e.clientX - startX;
    
    // 2. 获取主容器实际可用宽度（修复核心：确保主容器宽度正确）
    const mainRect = mainContainerRef.current.getBoundingClientRect();
    const mainWidth = mainRect.width; // 使用getBoundingClientRect更可靠
    
    // 3. 重新计算最大宽度（关键修复：右侧面板最小宽度设为200px，扩大可调整范围）
    const rightMinWidth = 200; // 右侧面板最小宽度（之前300px过宽，导致可调整范围小）
    const maxWidth = mainWidth - rightMinWidth;
    
    // 4. 计算新宽度（基于当前宽度+移动距离，扩大调整范围）
    let newWidth = middleWidth + deltaX;
    
    // 5. 限制宽度范围（确保有足够调整空间）
    const minWidth = 300; // 中间栏最小宽度（之前400px过宽）
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    
    // 6. 更新状态（强制同步，避免累积误差）
    setMiddleWidth(newWidth);
    setStartX(e.clientX);
    
    // 输出调试信息（关键：观察限制范围是否合理）
    console.log(`
      移动距离: ${deltaX}px, 
      主容器宽度: ${mainWidth}px, 
      限制范围: ${minWidth}px ~ ${maxWidth}px, 
      新宽度: ${newWidth}px
    `);
    setDebugInfo(`移动: ${deltaX}px | 范围: ${minWidth}-${maxWidth}px | 当前: ${newWidth}px`);
  }, [isResizing, middleWidth, startX]);

  const handleResizeEnd = useCallback((e: MouseEvent) => {
    console.log("拖拽结束");
    setIsResizing(false);
    
    // 清理事件监听
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('mouseleave', handleResizeEnd);
  }, [handleResizeMove]);

  // 高度对齐修复（解决顶部/底部错位）
  const syncAllHeights = () => {
    if (!pageRef.current || !middlePanelRef.current || !rightPanelRef.current) return;
    
    // 1. 基础高度：页面总高度（100vh）
    const pageHeight = pageRef.current.offsetHeight;
    
    // 2. 固定区域高度（像素级统一）
    const headerHeight = 48; // 顶部标题栏高度
    const inputAreaHeight = 72; // 中间输入区高度
    const templateAreaHeight = 160; // 右侧模板库高度
    
    // 3. 中间栏高度同步
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageHeight}px`;
      const middleContentArea = middlePanelRef.current.querySelector('.middle-content-area');
      if (middleContentArea) {
        middleContentArea.style.height = `${pageHeight - headerHeight - inputAreaHeight}px`;
      }
    }
    
    // 4. 右侧栏高度同步
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageHeight}px`;
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
    // 初始化侧边栏宽度
    setSidebarWidth(240);
    
    // 初始化中间栏宽度（主容器50%）
    if (mainContainerRef.current) {
      setMiddleWidth(Math.floor(mainContainerRef.current.offsetWidth * 0.5));
    }
    
    // 同步高度和手柄位置
    syncAllHeights();
    
    // 窗口变化时重新同步
    const handleWindowResize = () => {
      syncAllHeights();
    };
    window.addEventListener('resize', handleWindowResize);
    
    // 组件卸载清理
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('mouseleave', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  // 中间栏宽度变化时的额外处理
  useEffect(() => {
    // 可以在这里添加宽度变化后的额外逻辑
    console.log(`中间栏宽度已更新: ${middleWidth}px`);
  }, [middleWidth]);

  // 原有业务逻辑保留
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

  return (
    <div 
      ref={pageRef}
      style={{ display: "flex", height: "100vh", backgroundColor: "white", overflow: "hidden", position: "relative" }}
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
        style={{ display: "flex", flex: 1, overflow: "hidden", height: "100vh", margin: 0, padding: 0 }}
      >
        {/* 中间栏：固定宽度，100%高度 */}
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
            transition: "width 0.1s ease-out" // 添加过渡效果，使拖拽更平滑
          }}
        >
          {/* 顶部标题栏：固定48px高度，像素级对齐 */}
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

          {/* 消息区：固定高度计算，overflow-auto */}
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

          {/* 底部输入区：固定72px高度，与右侧模板库底部对齐 */}
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

          {/* 拖拽手柄：紧贴在中间栏右侧 */}
          <div
            ref={resizeHandleRef}
            style={{
              width: "6px", // 稍宽一点，方便拖拽
              cursor: "col-resize",
              backgroundColor: isResizing ? "#2563eb" : "#e2e8f0",
              opacity: isResizing ? 1 : 0.7,
              flexShrink: 0,
              transition: "background-color 0.2s ease", // 增加过渡效果
              zIndex: 10, // 确保在其他元素上方
            }}
            onMouseDown={handleResizeStart}
            aria-label="调整面板宽度"
          />

        {/* 右侧栏：剩余宽度，100%高度 */}
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
          }}
        >
          {/* 顶部预览标题栏：固定48px高度，与中间栏标题栏对齐 */}
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

          {/* 预览区：固定高度计算 */}
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

          {/* 底部模板库：固定160px高度 */}
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
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e5e7eb"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
    </div>
  );
}
