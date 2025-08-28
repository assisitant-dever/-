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

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !mainContainerRef.current) return;

    const mainRect = mainContainerRef.current.getBoundingClientRect();
    let newWidth = e.clientX - mainRect.left - sidebarWidth;

    const minWidth = 400;
    const maxWidth = mainRect.width - 300;
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

    setMiddleWidth(newWidth);
  }, [isResizing, sidebarWidth]);



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
    
    // 窗口变化时重新同步
    const handleWindowResize = () => {
      syncAllHeights();
    };
    window.addEventListener('resize', handleWindowResize);
    
    // 组件卸载清理：修复事件监听重复清理问题
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('mouseleave', handleResizeEnd);
    };
  }, []);

  // 中间栏宽度变化时同步手柄位置
  useEffect(() => {
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

  // ----------------- 4. 布局渲染（修复样式重复定义语法错误） -----------------
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
            borderRight: "1px solid #e2e8f0"
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
              lineHeight: "48px", // 垂直居中
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
              // 加载状态（确保标签闭合）
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
              // 空消息状态（确保标签闭合）
              <p style={{
                marginTop: "32px",
                textAlign: "center",
                color: "#6b7280",
              }}>暂无消息</p>
            ) : (
              // 核心：messages.map 渲染（修复内部 JSX 结构）
              messages.map((msg, idx) => (
                // 1. 外层容器：确保 key 唯一，标签完整闭合
                <div
                  key={msg.id || idx} // 优先用 msg.id，无则用索引（避免警告）
                  style={{ 
                    display: "flex",
                    marginBottom: "16px",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  // 2. 消息气泡：修复样式属性逗号，确保标签闭合
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      // 根据角色切换背景色（避免三元表达式语法错误）
                      backgroundColor: msg.role === "user" ? "#2563eb" : "#f3f4f6",
                      color: msg.role === "user" ? "white" : "#1f2937",
                    }}
                  >
                    // 3. 消息内容：确保 whiteSpace 拼写正确（驼峰命名）
                    <p style={{ 
                      margin: 0, 
                      padding: 0, 
                      whiteSpace: "pre-wrap", // 关键：保留换行符，避免内容错乱
                    }}>
                      {msg.content}
                    </p>

                    // 4. 下载按钮：仅 AI 消息显示，确保条件判断完整
                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡
                          handleDownload(msg.docx_file!); // 非空断言（确保 docx_file 存在）
                        }}
                        disabled={loading}
                        style={{
                          marginTop: "8px",
                          color: msg.role === "user" ? "#a5b4fc" : "#16a34a", // 适配角色颜色
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
              )) // 确保 map 函数的箭头函数闭合
            )}
            // 滚动到底部的锚点
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
                left: `${sidebarWidth + 16}px`, // 侧边栏宽度+内边距
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
              width: "4px", // 稍微大点，方便拖拽
              cursor: "col-resize",
              backgroundColor: isResizing ? "#2563eb" : "#e2e8f0",
              opacity: isResizing ? 1 : 0.7,
              flexShrink: 0, // 不让它被压缩
            }}
            onMouseDown={handleResizeStart}
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

          {/* 预览区：固定高度计算，与中间消息区对齐（修复语法错误核心区域） */}
          <div
            className="right-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto", // 1. 补充逗号（关键修复点）
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1f2937", // 2. 补充逗号（关键修复点）
              }}
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse("暂无内容") }}
            />
          </div>

          {/* 底部模板库：固定160px高度，与中间输入区底部对齐 */}
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
              gap: "8px", // 补充逗号
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: "600",
                color: "#1f2937", // 补充逗号
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
                  backgroundColor: "white", // 补充逗号
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
              overflowY: "auto", // 补充逗号
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
                      cursor: "pointer", // 补充逗号
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
                  color: "#9ca3af", // 补充逗号
                }}>没有找到模板</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}