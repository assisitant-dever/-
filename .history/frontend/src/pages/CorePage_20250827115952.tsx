import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const [debugInfo, setDebugInfo] = useState<string>(""); // 调试信息（可选）
  const [initialMainWidth, setInitialMainWidth] = useState<number>(0);

  // -------------------------- 业务状态 --------------------------
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

  // -------------------------- 布局核心配置（参考豆包平台） --------------------------
  const LAYOUT = {
    sidebarWidth: 240,        // 侧边栏固定宽度
    middleMinWidth: 300,      // 中间栏最小宽度（避免挤压）
    rightMinWidth: 200,       // 右侧栏最小宽度（避免消失）
    handleWidth: 10,          // 拖拽手柄宽度（易点击）
    transition: "width 0.05s ease-out", // 平滑过渡（跟手不卡顿）
    headerHeight: 48,         // 标题栏高度
    inputHeight: 72,          // 输入区高度
    templateHeight: 160       // 模板库高度
  };

  // -------------------------- 布局状态与Ref --------------------------
  const [middleWidth, setMiddleWidth] = useState<number>(800); // 中间栏宽度
  const [isResizing, setIsResizing] = useState<boolean>(false); // 拖拽中标识
  const [startX, setStartX] = useState<number>(0); // 拖拽起始X坐标

  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null); // 中+右栏容器（核心）
  const middlePanelRef = useRef<HTMLDivElement>(null);   // 中间栏
  const rightPanelRef = useRef<HTMLDivElement>(null);    // 右侧栏
  const resizeHandleRef = useRef<HTMLDivElement>(null);  // 拖拽手柄
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // -------------------------- 拖拽核心逻辑（参考豆包事件流） --------------------------
  // 1. 拖拽开始：捕获初始状态，绑定全局事件
  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsResizing(true);
  setStartX(e.clientX);

  // 调试信息
  if (mainContainerRef.current) {
    const mainW = mainContainerRef.current.getBoundingClientRect().width;
    setDebugInfo(`初始：主容器${mainW}px | 中间栏${middleWidth}px`);
  }
}, [middleWidth]);
  // 2. 拖拽中：精准计算宽度，边界约束
  const handleResizeMove = useCallback((e: MouseEvent) => {
      if (!isResizing || !mainContainerRef.current) return;

      // 1. 增加灵敏度系数（核心修复）
      const sensitivity = 1; // 调整此值控制灵敏度（1.2-2.0较合适）
      const deltaX = (e.clientX - startX) * sensitivity;

      // 2. 获取主容器实时宽度
      const mainRect = mainContainerRef.current.getBoundingClientRect();
      const mainW = mainRect.width;

      // 3. 计算新宽度 + 边界约束（优化后）
      const maxW = mainW - LAYOUT.rightMinWidth; // 中间栏最大宽度
      let newW = middleWidth + deltaX;
      // 边界约束：确保不小于最小宽度，不大于最大宽度
      newW = Math.max(LAYOUT.middleMinWidth, Math.min(newW, maxW));
      console.log(`原始deltaX: ${e.clientX - startX}, 计算后deltaX: ${deltaX}, newW: ${newW}`);
      // 更新状态
      setMiddleWidth(newW);
      setStartX(e.clientX);

      // 调试信息（实时显示灵敏度效果）
      setDebugInfo(`移动：${deltaX.toFixed(1)}px（原始：${(deltaX/sensitivity).toFixed(1)}px）| 当前：${newW}px`);
      console.log(`拖拽中：新宽度=${newW}px，灵敏度系数=${sensitivity}`);
    }, [isResizing, middleWidth, startX]);
  // 3. 拖拽结束：清理事件，重置状态
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    console.log(`拖拽结束：最终宽度=${middleWidth}px`);
  }, [middleWidth, handleResizeMove]);
// 【新增此 useEffect，不要嵌套在其他 useEffect 内】
// 功能：isResizing 为 true 时绑定事件，为 false 时自动清理
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
  const handleMouseUp = () => handleResizeEnd();
  const handleMouseLeave = () => handleResizeEnd();

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
  }

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mouseleave', handleMouseLeave);
  };
}, [isResizing, handleResizeMove, handleResizeEnd]);
  // -------------------------- 高度同步（避免错位） --------------------------
  const syncAllHeights = useCallback(() => {
    if (!pageRef.current || !middlePanelRef.current || !rightPanelRef.current) return;

    const pageH = pageRef.current.offsetHeight; // 页面总高度

    // 中间栏高度同步
    if (middlePanelRef.current) {
      middlePanelRef.current.style.height = `${pageH}px`;
      const contentArea = middlePanelRef.current.querySelector('.middle-content-area');
      if (contentArea) {
        contentArea.style.height = `${pageH - LAYOUT.headerHeight - LAYOUT.inputHeight}px`;
      }
    }

    // 右侧栏高度同步
    if (rightPanelRef.current) {
      rightPanelRef.current.style.height = `${pageH}px`;
      const contentArea = rightPanelRef.current.querySelector('.right-content-area');
      if (contentArea) {
        contentArea.style.height = `${pageH - LAYOUT.headerHeight - LAYOUT.templateHeight}px`;
      }
    }

    // 拖拽手柄高度同步
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.height = `${pageH}px`;
    }
  }, []);

  // -------------------------- 初始化与窗口适配（参考豆包响应式） --------------------------
useEffect(() => {
  // 初始化：获取初始主容器宽度 + 中间栏宽度
  const initLayout = () => {
    if (mainContainerRef.current) {
      const mainW = mainContainerRef.current.getBoundingClientRect().width;
      setInitialMainWidth(mainW); // 保存初始主容器宽度
      const initW = Math.max(
        LAYOUT.middleMinWidth,
        Math.min(Math.floor(mainW * 0.5), mainW - LAYOUT.rightMinWidth)
      );
      setMiddleWidth(initW);
    }
    syncAllHeights();
  };

  // 移除 setTimeout，用 useLayoutEffect 确保DOM就绪（此处直接执行，依赖DOM挂载）
  if (mainContainerRef.current) {
    initLayout();
  } else {
    // 若DOM未就绪，监听Ref变化（可选，增强兼容性）
    const observer = new MutationObserver(() => {
      if (mainContainerRef.current) {
        initLayout();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  // 修复窗口resize逻辑：用初始主容器宽度计算比例
  const handleWindowResize = () => {
    syncAllHeights();
    if (mainContainerRef.current && initialMainWidth > 0) {
      const newMainW = mainContainerRef.current.getBoundingClientRect().width;
      // 正确：用户调整后的中间栏宽度 / 初始主容器宽度 = 保留用户调整的占比
      const ratio = middleWidth / initialMainWidth; 
      const newW = Math.max(
        LAYOUT.middleMinWidth,
        Math.min(Math.floor(newMainW * ratio), newMainW - LAYOUT.rightMinWidth)
      );
      setMiddleWidth(newW);
    }
  };
  window.addEventListener('resize', handleWindowResize);

  // 组件卸载清理
  return () => {
    window.removeEventListener('resize', handleWindowResize);
    // 兜底清理事件（避免残留）
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
}, [middleWidth, syncAllHeights, handleResizeMove, handleResizeEnd]);

  // -------------------------- 原有业务逻辑（保留并优化） --------------------------
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 加载对话
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
          setPreviewContent(res.data.messages.at(-1)?.content || "");
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

    // 新对话初始化
    if (id === "new") {
      setMessages([{ role: "assistant", content: "欢迎创建新对话，请输入您的公文需求。" }]);
      setCurrentConv(null);
    } else {
      loadConversation();
    }

    inputRef.current?.focus();
  }, [id, dispatch, navigate]);

  // 加载模板
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await api.get("/api/templates");
        setTemplates(res.data);
      } catch (err) {
        console.error("加载模板失败:", err);
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
      console.error("下载失败:", err);
      alert("下载失败");
    }
  };

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setInput("");

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);

    try {
      const formData = new FormData();
      formData.append("doc_type", docType);
      formData.append("user_input", input);
      if (id && id !== "new") formData.append("conv_id", id);
      if (selectedTemplate) formData.append("template_id", selectedTemplate);

      const res = await api.post("/api/generate", formData);
      const { text, filename, conv_id: newConvId } = res.data;

      // 新对话跳转
      if (id === "new" && newConvId) {
        navigate(`/conversations/${newConvId}`);
        setCurrentConv({ id: newConvId });
      }

      // 生成AI消息
      const aiMsg = {
        role: "assistant",
        content: text,
        docx_file: filename,
        id: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
      setPreviewContent(text);

      // 更新状态管理
      if (currentConv) {
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: {
            id: currentConv.id,
            updated_at: new Date().toISOString(),
            last_message: text.slice(0, 20) + "..."
          }
        });
      } else if (newConvId) {
        dispatch({
          type: "ADD_CONVERSATION",
          payload: {
            id: newConvId,
            title: input.slice(0, 20) + (input.length > 20 ? "..." : ""),
            updated_at: new Date().toISOString(),
            messages: [userMsg, aiMsg]
          }
        });
      }

      setSelectedTemplate(null);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "生成失败，请重试";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errMsg}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // 过滤模板
  const filteredTemplates = templates.filter(t =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  // 预览HTML转换
  const [previewHTML, setPreviewHTML] = useState("");
  useEffect(() => {
    setPreviewHTML(marked.parse(previewContent || "暂无内容"));
  }, [previewContent]);

  // -------------------------- 布局渲染（参考豆包样式优先级） --------------------------
  return (
    <div 
      ref={pageRef}
      style={{ 
        display: "flex", 
        height: "100vh", 
        backgroundColor: "white", 
        overflow: "hidden", 
        position: "relative" 
      }}
    >
      {/* 1. 侧边栏（固定宽度） */}
      <Sidebar 
        onSelect={() => {}} 
        style={{ 
          width: `${LAYOUT.sidebarWidth}px`, 
          height: "100vh", 
          flexShrink: 0, 
          borderRight: "1px solid #e2e8f0",
          margin: 0,
          padding: 0
        }} 
      />

      {/* 2. 主容器（中+右栏，flex核心） */}
      <div 
        ref={mainContainerRef}
        style={{ 
          display: "flex", 
          flex: 1, 
          overflow: "hidden", 
          height: "100vh", 
          margin: 0, 
          padding: 0 
        }}
      >
        {/* 3. 中间栏（宽度由state控制，禁止flex调整） */}
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
            transition: LAYOUT.transition, // 平滑过渡
            flexShrink: 0, // 关键：禁止压缩
            flexGrow: 0,  // 关键：禁止拉伸
            minWidth: `${LAYOUT.middleMinWidth}px`, // 双重约束
            maxWidth: `calc(100% - ${LAYOUT.rightMinWidth}px)` // 双重约束
          }}
        >
          {/* 中间栏标题栏 */}
          <div style={{
            height: `${LAYOUT.headerHeight}px`,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f9fafb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <h2 style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
              lineHeight: `${LAYOUT.headerHeight}px`
            }}>
              {currentConv?.title || (id === "new" ? "新对话" : "公文生成")}
            </h2>
            {/* 调试信息（可选，生产环境可删除） */}
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {debugInfo}
            </span>
          </div>

          {/* 中间栏消息区 */}
          <div
            className="middle-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
              flex: 1 // 占满剩余高度（替代固定高度计算）
            }}
          >
            {loading && id !== "new" ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280"
              }}>
                加载对话中...
              </div>
            ) : messages.length === 0 ? (
              <p style={{
                marginTop: "32px",
                textAlign: "center",
                color: "#6b7280"
              }}>暂无消息</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  style={{ 
                    display: "flex",
                    marginBottom: "16px",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      backgroundColor: msg.role === "user" ? "#2563eb" : "#f3f4f6",
                      color: msg.role === "user" ? "white" : "#1f2937"
                    }}
                  >
                    <p style={{ 
                      margin: 0, 
                      padding: 0, 
                      whiteSpace: "pre-wrap" 
                    }}>
                      {msg.content}
                    </p>

                    {/* 下载按钮 */}
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
                          textDecoration: "underline"
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

          {/* 中间栏输入区 */}
          <div style={{
            height: `${LAYOUT.inputHeight}px`,
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f9fafb",
            display: "flex",
            alignItems: "center",
            position: "relative"
          }}>
            <div style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px"
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
                  backgroundColor: "white"
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
                onKeyDown={(e) => {
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

            {/* 模板选择提示 */}
            {selectedTemplate && (
              <p style={{
                position: "absolute",
                bottom: "8px",
                left: "16px",
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

        {/* 4. 拖拽手柄（高优先级，避免事件拦截） */}
        <div
          ref={resizeHandleRef}
          style={{
            width: `${LAYOUT.handleWidth}px`,
            height: "100vh",
            cursor: "col-resize",
            backgroundColor: isResizing ? "#2563eb" : "transparent", // 拖拽时高亮
            opacity: isResizing ? 1 : 0.9,
            flexShrink: 0,
            flexGrow: 0,
            zIndex: 100, // 关键：高于所有元素
            userSelect: "none", // 禁止选中
            pointerEvents: "auto" // 强制响应事件
          }}
          onMouseDown={handleResizeStart}
          onMouseDownCapture={(e) => { // 捕获事件，避免拦截
            e.preventDefault();
            e.stopPropagation();
            handleResizeStart(e);
          }}
          aria-label="调整中间栏宽度"
        />

        {/* 5. 右侧栏（flex自适应，最小宽度约束） */}
        <div
          ref={rightPanelRef}
          style={{ 
            flex: 1, 
            height: "100vh", 
            minWidth: `${LAYOUT.rightMinWidth}px`, // 避免消失
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb"
          }}
        >
          {/* 右侧栏标题栏 */}
          <div style={{
            height: `${LAYOUT.headerHeight}px`,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            backgroundColor: "#f9fafb"
          }}>
            <h3 style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
              lineHeight: `${LAYOUT.headerHeight}px`
            }}>
              公文预览
            </h3>
          </div>

          {/* 右侧栏预览区 */}
          <div
            className="right-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
              flex: 1 // 占满剩余高度
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1f2937"
              }}
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          </div>

          {/* 右侧栏模板库 */}
          <div style={{
            height: `${LAYOUT.templateHeight}px`,
            padding: "0 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              margin: "8px 0",
              gap: "8px"
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: "600",
                color: "#1f2937"
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
                  backgroundColor: "white"
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
              overflowY: "auto"
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
                      cursor: "pointer"
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