import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import api from '../api';
import { saveAs } from 'file-saver';
import { marked } from 'marked';
import { Button } from './ui/Button';
import Sidebar from '../components/Sidebar';
// 导入新组件
import StreamingMessage from '../components/StreamingMessage';

export default function CorePage() {
  // 路由参数和导航（不变）
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 状态管理
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState<Array<{
    id?: number;
    role: 'user' | 'assistant';
    content: string;
    docx_file?: string;
  }>>([]);
  const [currentConv, setCurrentConv] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState('请开始输入您的公文需求，系统将为您生成相应内容。');
  const [previewHTML, setPreviewHTML] = useState('');
  const [docType, setDocType] = useState('通知');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  
  // 模板相关状态（不变）
  const [templates, setTemplates] = useState<Array<{
    id: number;
    original_name: string;
    filename: string;
    uploaded_at: string;
    content_preview: string;
  }>>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
  });

  // 元素引用（不变）
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 布局相关常量和方法（不变）
  const sidebarWidth = 260;
  const middleMinWidth = 300;
  const rightMinWidth = 300;

  const syncAllHeights = useCallback(() => {
    const pageHeight = pageRef.current?.offsetHeight || 0;
    const headerHeight = 48;
    const templateAreaHeight = 160;
    
    const middleContentArea = middlePanelRef.current?.querySelector('.middle-content-area');
    const rightContentArea = rightPanelRef.current?.querySelector('.right-content-area');

    if (middleContentArea) {
      (middleContentArea as HTMLElement).style.height = 
        `${pageHeight - 72}px`;
    }

    if (rightContentArea) {
      (rightContentArea as HTMLElement).style.height = 
        `${pageHeight - headerHeight - templateAreaHeight}px`;
    }
  }, []);

  // 初始化高度同步和窗口resize适配（不变）
  useEffect(() => {
    syncAllHeights();
    
    const handleWindowResize = () => syncAllHeights();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [syncAllHeights]);

  // 消息自动滚动到底部（优化）
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isStreaming) scrollToBottom();
  }, [messages, isStreaming]);

  // 加载对话（不变）
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
          const lastMsg = res.data.messages[res.data.messages.length - 1];
          setPreviewContent(lastMsg.content || "暂无公文内容");
        } else {
          setMessages([{ role: "assistant", content: "欢迎，请输入您的公文需求。" }]);
          setPreviewContent("请输入公文需求，系统将为您生成预览内容");
        }
      } catch (err) {
        console.error("加载对话失败:", err);
        alert("加载对话失败，请重试");
        navigate("/home");
        setPreviewContent("对话加载失败，请重试");
      } finally {
        setLoading(false);
      }
    };

    if (id === "new") {
      setMessages([{ role: "assistant", content: "欢迎创建新对话，请输入您的公文需求。" }]);
      setCurrentConv(null);
      setPreviewContent("请开始输入您的公文需求，系统将为您生成相应内容。");
    } else {
      loadConversation();
    }

    inputRef.current?.focus();
  }, [id, dispatch, navigate]);

  // 监听流式内容变化（优化）
  useEffect(() => {
    if (isStreaming) {
      // 找到当前流式消息并更新预览
      const streamingMsg = messages.find(msg => msg.id === streamingMsgId);
      if (streamingMsg) {
        setPreviewContent(streamingMsg.content || '');
      }
    } else if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      setPreviewContent(lastMessage.content || "暂无内容");
    }
  }, [messages, isStreaming, streamingMsgId]);

  // 模板加载相关方法（不变）
  const loadTemplates = async (page = 1, pageSize = 10) => {
    try {
      const res = await api.get(`/api/templates?page=${page}&page_size=${pageSize}`);
      setTemplates(res.data.data);
      setPagination({
        total: res.data.total,
        page: res.data.page,
        pageSize: res.data.page_size,
      });
    } catch (err) {
      console.error("加载模板失败", err);
    }
  };

  useEffect(() => {
    loadTemplates(1, 10);
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.pageSize)) return;
    loadTemplates(newPage, pagination.pageSize);
  };

  const handleTemplateSelect = async (templateId: number, templateName: string) => {
    if (selectedTemplate === templateId) return;
    try {
      const res = await api.get(`/api/template-content/${templateId}`);
      setSelectedTemplate(templateId);
      alert(`✅ 已选中模板：${templateName}，将作为格式参考`);
    } catch (err) {
      console.error("加载模板内容失败:", err);
      alert("❌ 加载模板内容失败");
    }
  };

  // 下载文件方法（提取为单独方法供组件使用）
  const handleDownloadFile = (filename: string) => {
    if (!filename) return;
    try {
      api.get(`/api/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      }).then(res => {
        saveAs(res.data, filename);
      }).catch(err => {
        console.error("下载失败", err);
        alert("下载失败");
      });
    } catch (err) {
      console.error("下载失败", err);
      alert("下载失败");
    }
  };

  // 核心发送方法（优化流式更新逻辑）
  const handleSend = async () => {
    if (!input.trim() || loading || isStreaming) return;
    setLoading(true);
    const userInput = input;
    setInput("");
    
    // 1. 添加用户消息
    const userMsg = { role: "user" as const, content: userInput };
    setMessages(prev => [...prev, userMsg]);

    // 2. 初始化流式状态
    const tempMsgId = Date.now();
    setStreamingMsgId(tempMsgId);
    setIsStreaming(true);
    setPreviewContent('');

    // 3. 构建FormData
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("user_input", userInput);
    if (id && id !== "new") formData.append("conv_id", id);
    if (selectedTemplate) formData.append("template_id", selectedTemplate.toString());

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "请求失败" }));
        throw new Error(errorData.detail || "生成接口请求失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";
      let metadata: { filename?: string; conv_id?: string; doc_id?: string } = {};

      // 5. 添加AI消息占位符
      setMessages(prev => [...prev, {
        id: tempMsgId,
        role: "assistant" as const,
        content: "",
        docx_file: undefined
      }]);

      // 6. 处理流式响应（优化更新逻辑）
      let currentEvent = "message";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              
              if (currentEvent === "message" && data.chunk) {
                const validChunk = data.chunk.trim();
                if (validChunk) {
                  fullContent += data.chunk;
                  // 关键修复：直接更新消息数组中的对应消息
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === tempMsgId ? { ...msg, content: fullContent } : msg
                    )
                  );
                  console.log("中部内容更新:", fullContent); 

                }
              } else if (currentEvent === "metadata") {
                metadata = data;
              } else if (currentEvent === "error") {
                throw new Error(data.detail || "流式生成失败");
              }
            } catch (e) {
              console.warn("[解析警告]", e, "数据:", dataStr);
            }
          }
        }
      }

      // 7. 流式结束：更新最终消息
      if (!fullContent) throw new Error("生成内容为空");

      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMsgId 
            ? { ...msg, content: fullContent, docx_file: metadata.filename } 
            : msg
        )
      );

      // 8. 导航和状态更新
      if (id === "new" && metadata.conv_id) {
        navigate(`/conversations/${metadata.conv_id}`);
        setCurrentConv({ id: metadata.conv_id });
      }

      if (currentConv) {
        dispatch({ 
          type: "UPDATE_CONVERSATION", 
          payload: { 
            id: currentConv.id, 
            updated_at: new Date().toISOString(),
            last_message: fullContent.substring(0, 20) + "..."
          } 
        });
      } else if (metadata.conv_id) {
        dispatch({
          type: "ADD_CONVERSATION",
          payload: {
            id: metadata.conv_id,
            title: userInput.length > 20 ? userInput.slice(0, 20) + "..." : userInput,
            updated_at: new Date().toISOString(),
            messages: [userMsg, {
              id: tempMsgId,
              role: "assistant",
              content: fullContent,
              docx_file: metadata.filename
            }]
          }
        });
      }

      setSelectedTemplate(null);
    } catch (err: any) {
      const errorMsg = err.message || "生成失败，请重试";
      setMessages(prev => 
        prev.some(msg => msg.id === tempMsgId)
          ? prev.map(msg => 
              msg.id === tempMsgId 
                ? { ...msg, content: `❌ ${errorMsg}` } 
                : msg
            )
          : [...prev, {
              id: tempMsgId,
              role: "assistant" as const,
              content: `❌ ${errorMsg}`,
              docx_file: undefined
            }]
      );
    } finally {
      setIsStreaming(false);
      setLoading(false);
      setStreamingMsgId(null);
      inputRef.current?.focus();
    }
  };

  // 过滤模板和预览转换（不变）
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  useEffect(() => {
    setPreviewHTML(marked.parse(previewContent || "暂无内容"));
  }, [previewContent]);
  useEffect(() => {
  if (messages.length >= 2 && currentConv && !currentConv.title) {
    api.post(`/conversations/${currentConv.id}/generate_title`)
      .then(res => {
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: { id: currentConv.id, title: res.data.title }
        });
      })
      .catch(err => {
        console.error("生成标题失败:", err);
      });
  }
}, [messages, currentConv, dispatch]);

  return (
    <div 
      ref={pageRef}
      className="core-page"
      style={{ display: "flex", height: "100vh", backgroundColor: "white", overflow: "hidden" }}
    >
      {/* 左侧边栏（不变） */}
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
        style={{ display: "flex", flex: 1, overflow: "hidden", height: "100vh" }}
      >
        {/* 中间栏（消息区+输入区）- 使用新组件 */}
        <div
          ref={middlePanelRef}
          style={{ 
            display: "flex",
            flexDirection: "column",
            flex: 5.5,
            minWidth: `${middleMinWidth}px`,
            height: "100vh", 
            overflow: "hidden",
            backgroundColor: "white",
            borderRight: "1px solid #e2e8f0"
          }}
        >
          {/* 消息区 - 使用StreamingMessage组件 */}
          <div
            className="middle-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
              flex: 1
            }}
          >
            {loading && id !== "new" && messages.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                }}
              >
                加载对话中...
              </div>
            ) : messages.length === 0 ? (
              <p
                style={{
                  marginTop: "32px",
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                暂无消息
              </p>
            ) : (
              <>
                {messages.map((msg, index) => (
                  <StreamingMessage
                    key={msg.id ?? `msg-${index}`}
                    id={msg.id ?? index}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={isStreaming && streamingMsgId === msg.id}
                    docxFile={msg.docx_file}
                    onDownload={handleDownloadFile}
                  />
                ))}
                {/* ✅ 保持消息渲染，同时单独给出流式提示 */}
                {isStreaming && (
                  <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "8px" }}>
                    正在生成中...
                  </p>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入区（不变） */}
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
                disabled={isStreaming}
                style={{
                  width: "96px",
                  height: "40px",
                  padding: "0 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: isStreaming ? "#f3f4f6" : "white"
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
                onKeyUp={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="请输入您的公文需求（按 Enter 发送，Shift+Enter 换行）..."
                rows={1}
                disabled={loading || isStreaming}
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
                  backgroundColor: loading || isStreaming ? "#f3f4f6" : "white"
                }}
              />
              <Button 
                onClick={handleSend} 
                disabled={loading || isStreaming || !input.trim()}
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
                {loading ? "加载中..." : isStreaming ? "生成中..." : "发送"}
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
                  disabled={isStreaming}
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

        {/* 右侧栏（公文预览+模板库）（不变） */}
        <div
          ref={rightPanelRef}
          style={{ 
            flex: 4.5,
            minWidth: `${rightMinWidth}px`,
            height: "100vh", 
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb"
          }}
        >
          {/* 顶部预览标题栏 */}
          <div style={{
            height: "48px",
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
              flex: 1
            }}
          >
            {(loading && !isStreaming) ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
              }}>
                加载预览中...
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "white",
                  padding: "16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#1f2937",
                  minHeight: "200px"
                }}
                dangerouslySetInnerHTML={{ __html: previewHTML }}
              />
            )}
          </div>

          {/* 底部模板库（不变） */}
          <div style={{
            height: "180px",
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
                disabled={isStreaming}
                style={{
                  flex: 1,
                  height: "24px",
                  padding: "0 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#374151",
                  backgroundColor: isStreaming ? "#f3f4f6" : "white",
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
                    onClick={() => !isStreaming && handleTemplateSelect(t.id, t.original_name)}
                    style={{
                      padding: "4px 8px",
                      marginBottom: "4px",
                      borderRadius: "4px",
                      cursor: isStreaming ? "not-allowed" : "pointer",
                      backgroundColor: selectedTemplate === t.id ? "#dbeafe" : "transparent",
                      opacity: isStreaming ? 0.6 : 1
                    }}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li style={{ padding: "4px 8px", color: "#9ca3af" }}>没有找到模板</li>
              )}
            </ul>
            
            {/* 分页控件 */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "4px 0",
              gap: "8px",
              fontSize: "12px",
              borderTop: "1px solid #e2e8f0",
              marginTop: "4px"
            }}>
              <button
                onClick={() => !isStreaming && handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isStreaming}
                style={{
                  padding: "2px 6px",
                  border: "1px solid #d1d5db",
                  borderRadius: "2px",
                  backgroundColor: isStreaming ? "#f3f4f6" : "white",
                  cursor: isStreaming ? "not-allowed" : "pointer",
                }}
              >
                上一页
              </button>
              <span>
                第 {pagination.page} 页 / 共 {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <button
                onClick={() => !isStreaming && handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize) || isStreaming}
                style={{
                  padding: "2px 6px",
                  border: "1px solid #d1d5db",
                  borderRadius: "2px",
                  backgroundColor: isStreaming ? "#f3f4f6" : "white",
                  cursor: isStreaming ? "not-allowed" : "pointer",
                }}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 基础样式 */}
      <style>
      {`
        .core-page {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
      `}
      </style>
    </div>
  );
}
    