import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import api from '../api';
import { saveAs } from 'file-saver';
import { marked } from 'marked';
import { Button } from './ui/button';
import Sidebar from '../components/Sidebar';
import StreamingMessage from '../components/StreamingMessage';
import Toast from '../components/Toast'; // 新增Toast组件
import Skeleton from '../components/Skeleton'; // 新增骨架屏组件
import Drawer from '../components/Drawer'; // 新增抽屉组件

// 类型定义提取到顶部，提升可维护性
interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  docx_file?: string;
}

interface Template {
  id: number;
  original_name: string;
  filename: string;
  uploaded_at: string;
  content_preview: string;
}

interface Pagination {
  total: 0;
  page: number;
  pageSize: number;
}

export default function CorePage() {
  // 路由参数和导航
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 状态管理
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
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
  
  // 新增响应式状态
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showToast, setShowToast] = useState<{visible: boolean; message: string; type: 'success' | 'error' | 'info'}>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  // 模板相关状态
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
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

  // 检测屏幕尺寸，更新响应式状态
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      // 在移动设备上默认关闭侧边栏和预览
      if (isMobileDevice) {
        setSidebarOpen(false);
        setPreviewOpen(false);
      } else {
        setSidebarOpen(true);
        setPreviewOpen(true);
      }
    };

    // 初始化检测
    checkMobile();
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 显示提示消息
  const showMessage = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setShowToast({ visible: true, message, type });
    setTimeout(() => {
      setShowToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  // 消息自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isStreaming) scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

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
          const lastMsg = res.data.messages[res.data.messages.length - 1];
          setPreviewContent(lastMsg.content || "暂无公文内容");
        } else {
          setMessages([{ role: "assistant", content: "欢迎，请输入您的公文需求。" }]);
          setPreviewContent("请输入公文需求，系统将为您生成预览内容");
        }
      } catch (err) {
        console.error("加载对话失败:", err);
        showMessage("加载对话失败，请重试", "error");
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
  }, [id, dispatch, navigate, showMessage]);

  // 监听流式内容变化
  useEffect(() => {
    if (isStreaming) {
      const streamingMsg = messages.find(msg => msg.id === streamingMsgId);
      if (streamingMsg) {
        setPreviewContent(streamingMsg.content || '');
      }
    } else if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      setPreviewContent(lastMessage.content || "暂无内容");
    }
  }, [messages, isStreaming, streamingMsgId]);

  // 模板加载相关方法
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
      showMessage("加载模板失败", "error");
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
      showMessage(`已选中模板：${templateName}，将作为格式参考`, "success");
    } catch (err) {
      console.error("加载模板内容失败:", err);
      showMessage("加载模板内容失败", "error");
    }
  };

  // 下载文件方法
  const handleDownloadFile = (filename: string) => {
    if (!filename) return;
    try {
      api.get(`/api/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      }).then(res => {
        saveAs(res.data, filename);
        showMessage("文件下载成功", "success");
      }).catch(err => {
        console.error("下载失败", err);
        showMessage("下载失败", "error");
      });
    } catch (err) {
      console.error("下载失败", err);
      showMessage("下载失败", "error");
    }
  };

  // 核心发送方法
  const handleSend = async () => {
    if (!input.trim() || loading || isStreaming) return;
    setLoading(true);
    const userInput = input;
    setInput("");
    
    // 添加用户消息
    const userMsg = { role: "user" as const, content: userInput };
    setMessages(prev => [...prev, userMsg]);

    // 初始化流式状态
    const tempMsgId = Date.now();
    setStreamingMsgId(tempMsgId);
    setIsStreaming(true);
    setPreviewContent('');

    // 构建FormData
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

      // 添加AI消息占位符
      setMessages(prev => [...prev, {
        id: tempMsgId,
        role: "assistant" as const,
        content: "",
        docx_file: undefined
      }]);

      // 处理流式响应
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
                  // 更新消息数组中的对应消息
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === tempMsgId ? { ...msg, content: fullContent } : msg
                    )
                  );
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

      // 流式结束：更新最终消息
      if (!fullContent) throw new Error("生成内容为空");

      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMsgId 
            ? { ...msg, content: fullContent, docx_file: metadata.filename } 
            : msg
        )
      );

      // 导航和状态更新
      if (id === "new" && metadata.conv_id) {
        navigate(`/conversations/${metadata.conv_id}`);
        setCurrentConv({ id: metadata.conv_id });
      }
      
      if (metadata.conv_id) {
        // 只在对话标题还是默认值时调用
        const conv = currentConv || { id: metadata.conv_id, title: "新对话" };
        if (conv.title === "新对话") {
          api.post(`/api/conversations/${conv.id}/generate_title`)
            .then(res => {
              const newTitle = res.data.title || "新对话";
              dispatch({
                type: "UPDATE_CONVERSATION",
                payload: { id: conv.id, title: newTitle }
              });
            })
            .catch(err => console.error("自动生成标题失败", err));
        }
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
      showMessage("内容生成成功", "success");
      
      // 在移动设备上自动打开预览
      if (isMobile) {
        setPreviewOpen(true);
      }
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
      showMessage(errorMsg, "error");
    } finally {
      setIsStreaming(false);
      setLoading(false);
      setStreamingMsgId(null);
      inputRef.current?.focus();
    }
  };

  // 过滤模板和预览转换
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  useEffect(() => {
    setPreviewHTML(marked.parse(previewContent || "暂无内容"));
  }, [previewContent]);

  // 移动端返回按钮处理
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div 
      ref={pageRef}
      className="core-page flex h-screen bg-white overflow-hidden box-sizing-border-box m-0 p-0"
    >
      {/* 移动端顶部导航栏 */}
      {isMobile && (
        <div className="mobile-header fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
          <button 
            onClick={handleBack}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-medium text-gray-800">公文生成</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setPreviewOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              预览
            </button>
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              ☰
            </button>
          </div>
        </div>
      )}

      {/* 侧边栏 - 桌面端常驻，移动端通过抽屉显示 */}
      {isMobile ? (
        <Drawer 
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          side="left"
          width="80%"
          className="z-40"
        >
          <Sidebar 
            onSelect={() => setSidebarOpen(false)} 
            style={{ 
              width: "100%", 
              height: "100%", 
              borderRight: "none"
            }} 
          />
        </Drawer>
      ) : (
        <Sidebar 
          onSelect={() => {}} 
          style={{ 
            width: "260px", 
            height: "100vh", 
            flexShrink: 0, 
            borderRight: "1px solid #e2e8f0",
            margin: 0,
            padding: 0,
            zIndex: 1
          }} 
        />
      )}

      {/* 主容器（中+右栏） */}
      <div 
        ref={mainContainerRef}
        className={`flex flex-1 overflow-hidden h-screen ${isMobile ? 'mt-12' : ''}`}
      >
        {/* 中间栏（消息区+输入区） */}
        <div
          ref={middlePanelRef}
          className={`flex flex-col flex-1 min-w-[300px] h-full overflow-hidden bg-white ${!isMobile ? 'border-r border-gray-200' : ''}`}
          style={{ flex: isMobile ? 1 : 5.5 }}
        >
          {/* 消息区 */}
          <div
            className="middle-content-area px-4 py-3 overflow-y-auto flex-1"
          >
            {loading && id !== "new" && messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <Skeleton type="message" count={3} />
              </div>
            ) : messages.length === 0 ? (
              <p className="mt-8 text-center text-gray-500">
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
                {isStreaming && (
                  <div className="typing-indicator text-gray-500 text-sm mt-2">
                    <span>生成中</span>
                    <span className="animate-pulse ml-1">●</span>
                    <span className="animate-pulse ml-1 delay-150">●</span>
                    <span className="animate-pulse ml-1 delay-300">●</span>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入区 */}
          <div className="input-area h-auto min-h-[72px] px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center">
            <div className="w-full flex items-center gap-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={isStreaming}
                className={`h-10 px-3 border rounded-md text-sm text-gray-800 ${
                  isStreaming ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
                style={{ width: isMobile ? '70px' : '96px' }}
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
                className={`flex-1 min-h-[40px] max-h-[120px] px-3 border rounded-md text-sm resize-none text-gray-800 overflow-auto ${
                  loading || isStreaming ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                }`}
              />
              
              <Button 
                onClick={handleSend} 
                disabled={loading || isStreaming || !input.trim()}
                className={`h-10 px-4 rounded-md text-sm font-medium transition-all ${
                  loading || isStreaming || !input.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-98'
                }`}
              >
                {loading ? "加载中..." : isStreaming ? "生成中..." : "发送"}
              </Button>
            </div>
            
            {selectedTemplate && (
              <p className="absolute bottom-2 left-[276px] text-xs text-blue-600 m-0 hidden md:block">
                ✅ 已选择模板作为参考
                <button
                  onClick={() => setSelectedTemplate(null)}
                  disabled={isStreaming}
                  className="ml-2 text-red-600 underline border-none bg-transparent cursor-pointer text-xs p-0"
                >
                  取消
                </button>
              </p>
            )}
          </div>
        </div>

        {/* 右侧栏（公文预览+模板库）- 移动端通过抽屉显示 */}
        {isMobile ? (
          <Drawer 
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            side="right"
            width="100%"
            className="z-40"
          >
            <div className="h-full flex flex-col bg-gray-50">
              {renderPreviewPanel()}
            </div>
          </Drawer>
        ) : (
          previewOpen && (
            <div
              ref={rightPanelRef}
              className="flex-1 min-w-[300px] h-screen overflow-hidden flex flex-col bg-gray-50"
              style={{ flex: 4.5 }}
            >
              {renderPreviewPanel()}
            </div>
          )
        )}
      </div>

      {/* 提示消息组件 */}
      <Toast
        visible={showToast.visible}
        message={showToast.message}
        type={showToast.type}
        onClose={() => setShowToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 全局样式 */}
      <style>
      {`
        .core-page {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        body {
          margin: 0;
          padding: 0;
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
        }
        
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .template-item {
          transition: all 0.2s ease;
        }
        
        .template-item:hover {
          background-color: #dbeafe;
          border-left: 3px solid #3b82f6;
        }
        
        .template-item.selected {
          background-color: #dbeafe;
          border-left: 3px solid #2563eb;
        }
        
        .btn {
          transition: all 0.2s ease;
        }
        
        .btn:active {
          transform: scale(0.98);
        }
      `}
      </style>
    </div>
  );

  // 提取预览面板为函数组件，减少代码冗余
  function renderPreviewPanel() {
    return (
      <>
        {/* 顶部预览标题栏 */}
        <div className="h-12 px-4 border-b border-gray-200 flex items-center bg-gray-50">
          <h3 className="m-0 p-0 line-height-12 text-base font-semibold text-gray-800">
            公文预览
          </h3>
          {isMobile && (
            <button 
              onClick={() => setPreviewOpen(false)}
              className="ml-auto p-2 rounded-full hover:bg-gray-200"
            >
              ×
            </button>
          )}
        </div>

        {/* 预览区 */}
        <div
          className="right-content-area px-4 py-3 overflow-y-auto flex-1"
        >
          {(loading && !isStreaming) ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <Skeleton type="preview" />
            </div>
          ) : (
            <div
              className="bg-white p-4 border border-gray-200 rounded-lg text-sm text-gray-800 min-h-[200px]"
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          )}
        </div>

        {/* 底部模板库 */}
        <div className="h-[180px] px-4 border-t border-gray-200 flex flex-col bg-gray-50">
          <div className="flex items-center my-2 gap-2">
            <h3 className="m-0 text-sm font-semibold text-gray-800">模板库</h3>
            <input
              type="text"
              placeholder="搜索模板..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isStreaming}
              className={`flex-1 h-6 px-2 border rounded text-xs text-gray-700 ${
                isStreaming ? 'bg-gray-100' : 'bg-white'
              }`}
            />
          </div>
          
          <ul className="flex-1 text-xs text-gray-700 m-0 p-0 list-none overflow-y-auto">
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((t) => (
                <li
                  key={t.id}
                  title={t.original_name}
                  onClick={() => !isStreaming && handleTemplateSelect(t.id, t.original_name)}
                  className={`template-item px-2 py-1 mb-1 rounded ${
                    selectedTemplate === t.id ? 'selected' : ''
                  } cursor-${isStreaming ? 'not-allowed' : 'pointer'} opacity-${isStreaming ? '60' : '100'}`}
                >
                  📄 {t.original_name}
                </li>
              ))
            ) : (
              <li className="px-2 py-1 text-gray-400">没有找到模板</li>
            )}
          </ul>
          
          {/* 分页控件 */}
          <div className="flex justify-center items-center py-1 gap-2 text-xs border-t border-gray-200 mt-1">
            <button
              onClick={() => !isStreaming && handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isStreaming}
              className="px-2 py-0.5 border border-gray-300 rounded bg-white btn"
            >
              上一页
            </button>
            <span>
              第 {pagination.page} 页 / 共 {Math.ceil(pagination.total / pagination.pageSize)} 页
            </span>
            <button
              onClick={() => !isStreaming && handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize) || isStreaming}
              className="px-2 py-0.5 border border-gray-300 rounded bg-white btn"
            >
              下一页
            </button>
          </div>
        </div>
      </>
    );
  }
}
