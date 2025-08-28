import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import api from '../utils/api';
import { saveAs } from 'file-saver';
import marked from 'marked';
import { Button } from '../components/Button';
import Sidebar from '../components/Sidebar';

export default function CorePage() {
  // 路由参数和导航
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 状态管理
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState<Array<{
    id?: number;
    role: string;
    content: string;
    docx_file?: string;
  }>>([]);
  const [currentConv, setCurrentConv] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('请开始输入您的公文需求，系统将为您生成相应内容。');
  const [previewHTML, setPreviewHTML] = useState('');
  const [docType, setDocType] = useState('通知');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null); // 修改为存储template_id
  const [search, setSearch] = useState('');
  
  // 模板相关状态（支持分页）
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

  // 元素引用
  const pageRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 布局相关常量
  const sidebarWidth = 260;
  const middleMinWidth = 300;
  const rightMinWidth = 300;

  // 同步高度逻辑
  const syncAllHeights = useCallback(() => {
    const pageHeight = pageRef.current?.offsetHeight || 0;
    const headerHeight = 48; // 预览区标题栏高度
    const templateAreaHeight = 160; // 模板库高度
    
    const middleContentArea = middlePanelRef.current?.querySelector('.middle-content-area');
    const rightContentArea = rightPanelRef.current?.querySelector('.right-content-area');

    if (middleContentArea) {
      (middleContentArea as HTMLElement).style.height = 
        `${pageHeight - 72}px`; // 减去输入区高度
    }

    if (rightContentArea) {
      (rightContentArea as HTMLElement).style.height = 
        `${pageHeight - headerHeight - templateAreaHeight}px`;
    }
  }, []);

  // 初始化高度同步
  useEffect(() => {
    syncAllHeights();
  }, [syncAllHeights]);

  // 窗口resize适配
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

  // 消息自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载对话+监听消息变化，同步预览
  useEffect(() => {
    const loadConversation = async () => {
      if (!id || id === "new") return;
      setLoading(true);
      try {
        const res = await api.get(`/api/conversations/${id}`);
        setCurrentConv(res.data);
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data });
        
        // 加载对话时同步消息和预览
        if (Array.isArray(res.data.messages) && res.data.messages.length > 0) {
          setMessages(res.data.messages);
          // 取最后一条消息作为预览
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

    // 新对话初始化
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

  // 监听messages变化，实时更新预览
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 始终取最后一条消息作为预览
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" || lastMessage.role === "user") {
      setPreviewContent(lastMessage.content || "暂无内容");
    }
  }, [messages]);

  // 加载模板（支持分页）
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

  // 初始化加载模板
  useEffect(() => {
    loadTemplates(1, 10);
  }, []);

  // 分页控制
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.pageSize)) return;
    loadTemplates(newPage, pagination.pageSize);
  };

  // 选择模板（修改为使用template_id）
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
      if (selectedTemplate) formData.append("template_id", selectedTemplate.toString()); // 传递template_id

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
      const errorMsgObj = { role: "assistant", content: `❌ ${errorMsg}` };
      setMessages((prev) => [...prev, errorMsgObj]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  // 过滤模板
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  // 预览HTML转换
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
      {/* 左侧边栏 */}
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
        {/* 中间栏 */}
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
          {/* 消息区 */}
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

        {/* 右侧栏（公文预览+模板库） */}
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
            {loading ? (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
              }}>
                生成预览中...
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

          {/* 底部模板库（带分页） */}
          <div style={{
            height: "180px", // 增加高度容纳分页
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
                  color: "#374151",
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
                    onClick={() => handleTemplateSelect(t.id, t.original_name)} // 传递template_id和名称
                    style={{
                      padding: "4px 8px",
                      marginBottom: "4px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: selectedTemplate === t.id ? "#dbeafe" : "transparent" // 选中状态
                    }}
                    onMouseOver={(e) => {
                      if (selectedTemplate !== t.id) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#e5e7eb";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedTemplate !== t.id) {
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
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{
                  padding: "2px 6px",
                  border: "1px solid #d1d5db",
                  borderRadius: "2px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                上一页
              </button>
              <span>
                第 {pagination.page} 页 / 共 {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                style={{
                  padding: "2px 6px",
                  border: "1px solid #d1d5db",
                  borderRadius: "2px",
                  backgroundColor: "white",
                  cursor: "pointer",
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