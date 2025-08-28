import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import api from '../api';
import { saveAs } from 'file-saver';
import { marked } from 'marked';
import { Button } from './ui/Button';
import Sidebar from '../components/Sidebar';

export default function CorePage() {
  // 路由参数和导航
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 状态管理 - 新增流式相关状态
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState<Array<{
    id?: number;
    role: string;
    content: string;
    docx_file?: string;
  }>>([]);
  const [currentConv, setCurrentConv] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false); // 控制按钮禁用
  const [isStreaming, setIsStreaming] = useState(false); // 标记是否正在流式传输
  const [streamingContent, setStreamingContent] = useState(''); // 暂存流式片段
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null); // 流式消息的临时ID
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

  // 布局相关常量（不变）
  const sidebarWidth = 260;
  const middleMinWidth = 300;
  const rightMinWidth = 300;

  // 同步高度逻辑（不变）
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

  // 初始化高度同步（不变）
  useEffect(() => {
    syncAllHeights();
  }, [syncAllHeights]);

  // 窗口resize适配（不变）
  useEffect(() => {
    syncAllHeights();
    
    const handleWindowResize = () => {
      syncAllHeights();
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [syncAllHeights]);

  // 消息自动滚动到底部（不变）
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载对话+监听消息变化（不变）
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

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [id, dispatch, navigate]);

  // 监听流式内容变化，实时更新预览（新增：流式片段同步预览）
  useEffect(() => {
    if (isStreaming && streamingContent) {
      setPreviewContent(streamingContent); // 流式片段实时更新预览
    } else if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      setPreviewContent(lastMessage.content || "暂无内容");
    }
  }, [messages, isStreaming, streamingContent]);

  // 加载模板（不变）
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

  // 初始化加载模板（不变）
  useEffect(() => {
    loadTemplates(1, 10);
  }, []);

  // 分页控制（不变）
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.pageSize)) return;
    loadTemplates(newPage, pagination.pageSize);
  };

  // 选择模板（不变）
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

  // 下载文件（不变）
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
  if (!input.trim() || loading || isStreaming) return;
  setLoading(true);
  setInput("");
  
  // 1. 添加用户消息
  const userMsg = { role: "user", content: input };
  setMessages((prev) => [...prev, userMsg]);

  // 2. 初始化流式状态
  const tempMsgId = Date.now();
  setStreamingMsgId(tempMsgId);
  setStreamingContent('');
  setIsStreaming(true);
  setPreviewContent('');

  // 3. 构建FormData
  const formData = new FormData();
  formData.append("doc_type", docType);
  formData.append("user_input", input);
  if (id && id !== "new") formData.append("conv_id", id);
  if (selectedTemplate) formData.append("template_id", selectedTemplate.toString());

  try {
    // 4. 发起请求并获取reader（仅声明1次！）
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

    // ✅ 仅声明1次 reader（删除重复的第2处声明）
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = ""; // 收集完整内容
    let metadata: { filename?: string; conv_id?: string; doc_id?: string } = {};

    // 5. 添加AI消息占位符（docx_file用undefined，与类型定义匹配）
    setMessages(prev => [...prev, {
      id: tempMsgId,
      role: "assistant",
      content: "",
      docx_file: undefined // ✅ 替换 null 为 undefined
    }]);

    // 6. 处理流式响应（与第1处逻辑完全一致，删除冗余的第2处处理）
    while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split("\n").filter(line => line.trim() !== "");

          for (const line of lines) {
        // 处理文本片段（data: ...）
        if (line.startsWith("data: ")) {
            try {
                const dataStr = line.slice(6); // 截取 "data: " 后的内容
                // ✅ 过滤空的data（避免JSON.parse("")报错）
                if (!dataStr.trim()) {
                    console.warn("跳过空的data片段");
                    continue;
                }
                
                const data = JSON.parse(dataStr);
                // ✅ 过滤空的chunk（避免拼接空字符串）
                if (data.chunk && data.chunk.trim()) {
                    fullContent += data.chunk;
                    // 更新消息列表和预览（仅在chunk有效时更新）
                    setMessages(prev => 
                        prev.map(msg => 
                            msg.id === tempMsgId ? { ...msg, content: fullContent } : msg
                        )
                    );
                    setPreviewContent(fullContent);
                } else if (data.chunk && !data.chunk.trim()) {
                    console.warn("跳过空的chunk片段");
                }
            } catch (e) {
                // ✅ 仅打印警告，不中断流式（避免单个片段错误导致整体失败）
                console.warn("解析流式片段失败，继续处理下一片段:", e, "片段内容:", line);
            }
        }

        // 处理metadata事件（不变，但需确保metaLine非空）
        else if (line.startsWith("event: metadata")) {
            const metaLine = lines.find(l => l.startsWith("data: ") && l.slice(6).trim());
            if (metaLine) {
                try {
                    const metadataStr = metaLine.slice(6);
                    if (metadataStr.trim()) {
                        metadata = JSON.parse(metadataStr);
                    }
                } catch (e) {
                    console.error("解析metadata失败:", e);
                }
            }
        }

        // 处理error事件（仅在此处中断流式）
        else if (line.startsWith("event: error")) {
            const errorLine = lines.find(l => l.startsWith("data: ") && l.slice(6).trim());
            if (errorLine) {
                try {
                    const errorData = JSON.parse(errorLine.slice(6));
                    throw new Error(errorData.detail || "流式生成失败");
                } catch (e) {
                    console.error("流式错误:", e);
                    // ✅ 仅在明确错误时中断，避免空片段误判
                    reader.cancel().catch(err => console.warn("取消reader失败:", err));
                }
            }
        }
    }
    }

    // 7. 流式结束：更新最终消息
    if (!fullContent) throw new Error("生成内容为空");

    const finalAiMsg = {
      id: tempMsgId,
      role: "assistant",
      content: fullContent,
      docx_file: metadata.filename // 直接使用metadata中的filename（可能为undefined，符合类型）
    };

    setMessages(prev => 
      prev.map(msg => msg.id === tempMsgId ? finalAiMsg : msg)
    );

    // 8. 导航和全局状态更新（不变）
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
          title: input.length > 20 ? input.slice(0, 20) + "..." : input,
          updated_at: new Date().toISOString(),
          messages: [userMsg, finalAiMsg]
        }
      });
    }

    setSelectedTemplate(null);
  } catch (err: any) {
    // 9. 错误处理
    const errorMsg = err.message || "生成失败，请重试";
    const errorMsgObj = { 
      id: tempMsgId || Date.now(),
      role: "assistant", 
      content: `❌ ${errorMsg}`,
      docx_file: undefined // 与类型定义匹配
    };

    setMessages((prev) => 
      prev.some(msg => msg.id === tempMsgId)
        ? prev.map(msg => msg.id === tempMsgId ? errorMsgObj : msg)
        : [...prev, errorMsgObj]
    );
  } finally {
    setIsStreaming(false);
    setLoading(false);
    setStreamingMsgId(null);
    if (inputRef.current) inputRef.current.focus();
  }
};

  // 过滤模板（不变）
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  // 预览HTML转换（不变）
  useEffect(() => {
    if (previewContent) {
      setPreviewHTML(marked.parse(previewContent));
    } else {
      setPreviewHTML(marked.parse("暂无内容"));
    }
  }, [previewContent]);

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

      {/* 主容器（中+右栏）（不变） */}
      <div 
        ref={mainContainerRef}
        style={{ display: "flex", flex: 1, overflow: "hidden", height: "100vh" }}
      >
        {/* 中间栏（消息区+输入区） */}
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
          {/* 消息区（不变，自动渲染流式更新的messages） */}
          <div
            className="middle-content-area"
            style={{
              padding: "12px 16px",
              margin: 0,
              overflowY: "auto",
              flex: 1
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

                    {/* 流式结束后显示下载按钮（自动出现） */}
                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.docx_file!);
                        }}
                        disabled={loading || isStreaming}
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

          {/* 底部输入区（修改：按钮文本适配流式） */}
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
                disabled={isStreaming} // 流式中禁止切换公文类型
                style={{
                  width: "96px",
                  height: "40px",
                  padding: "0 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1f2937",
                  backgroundColor: isStreaming ? "#f3f4f6" : "white" // 流式中灰化
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
                  if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="请输入您的公文需求（按 Enter 发送，Shift+Enter 换行）..."
                rows={1}
                disabled={loading || isStreaming} // 流式中禁止输入
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
                {/* 按钮文本适配状态：加载中/流式中/正常 */}
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
                  disabled={isStreaming} // 流式中禁止取消模板
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

        {/* 右侧栏（公文预览+模板库）（不变，预览自动同步流式内容） */}
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
          {/* 顶部预览标题栏（不变） */}
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

          {/* 预览区（自动渲染流式更新的previewHTML） */}
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
            ) : isStreaming ? (
              // 流式中显示“生成中”提示（可选）
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
              >
                <div style={{ color: "#6b7280", marginBottom: "8px" }}>📝 公文生成中...</div>
                <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
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

          {/* 底部模板库（带分页）（不变，流式中禁止操作） */}
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
                disabled={isStreaming} // 流式中禁止搜索
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
                    onClick={() => !isStreaming && handleTemplateSelect(t.id, t.original_name)} // 流式中禁止选择
                    style={{
                      padding: "4px 8px",
                      marginBottom: "4px",
                      borderRadius: "4px",
                      cursor: isStreaming ? "not-allowed" : "pointer",
                      backgroundColor: selectedTemplate === t.id ? "#dbeafe" : "transparent",
                      opacity: isStreaming ? 0.6 : 1 // 流式中半透明
                    }}
                    onMouseOver={(e) => {
                      if (selectedTemplate !== t.id && !isStreaming) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#e5e7eb";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedTemplate !== t.id && !isStreaming) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li style={{ padding: "4px 8px", color: "#9ca3af" }}>没有找到模板</li>
              )}
            </ul>
            
            {/* 分页控件（流式中禁止操作） */}
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

      {/* 基础样式（不变） */}
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