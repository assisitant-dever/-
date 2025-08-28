import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../store/app";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import api from "../api";
import { marked } from "marked";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver"; // 确保导入file-saver

export default function CorePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

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
  const [currentConv, setCurrentConv] = useState<any>(null); // 存储当前对话详情

  const [mainWidth, setMainWidth] = useState(50);
  const [resizeStart, setResizeStart] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --------------- 尺寸调整逻辑 ---------------
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart(e.clientX);
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!isResizing) return;
    const delta = e.clientX - resizeStart;
    const newWidth = (mainWidth * window.innerWidth - delta) / window.innerWidth * 100;
    setMainWidth(Math.max(30, Math.min(newWidth, 70)));
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // --------------- 自动滚动到底部 ---------------
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --------------- 关键修改：从API加载历史对话 ---------------
  useEffect(() => {
    // 加载指定对话的历史消息
    const loadConversation = async () => {
      if (!id || id === "new") return;

      setLoading(true);
      try {
        // 直接调用后端接口获取对话详情（包含消息）
        const res = await api.get(`/api/conversations/${id}`);
        setCurrentConv(res.data);
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data });
        
        // 加载消息列表
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

    // 初始化：如果是已有对话则加载，新对话则初始化
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

  // --------------- 加载模板列表 ---------------
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

  // --------------- 选择模板 ---------------
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

  // --------------- 下载文件 ---------------
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

  // --------------- 发送消息 ---------------
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
      // 新对话不传递conv_id，让后端自动创建
      if (id && id !== "new") {
        formData.append("conv_id", id);
      }
      if (selectedTemplate) {
        formData.append("template_id", selectedTemplate); // 假设后端接受模板ID
      }

      const response = await api.post("/api/generate", formData);
      const { text, filename, conv_id: newConvId } = response.data;

      // 如果是新对话，更新路由到新创建的对话ID
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
      
      // 更新全局状态中的对话
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
        // 新增对话到全局状态
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
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // --------------- 过滤模板 ---------------
  const filteredTemplates = templates.filter((t) =>
    t.original_name.includes(search) || t.filename.includes(search)
  );

  const [previewHTML, setPreviewHTML] = useState("");
  const [previewURL, setPreviewURL] = useState("");

  // --------------- 渲染Markdown预览 ---------------
  useEffect(() => {
    if (previewContent) {
      setPreviewHTML(marked.parse(previewContent));
    }
  }, [previewContent]);

  return (
    <div className="flex h-screen bg-white">
      <Sidebar onSelect={() => {}} />
      <div 
        className="flex h-screen flex-1"
        onMouseMove={handleResize}
        onMouseUp={handleResizeEnd}
      >
        {/* 左侧：对话内容 */}
        <div
          className="flex flex-col"
          style={{ flexBasis: `${mainWidth}%`, transition: "flex-basis 0.3s ease" }}
        >
          {/* 聊天区域标题 */}
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">
              {currentConv?.title || (id === "new" ? "新对话" : "公文生成")}
            </h2>
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {loading && id !== "new" ? (
              <div className="text-center py-8 text-gray-500">加载对话中...</div>
            ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center">暂无消息</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${
                      msg.role === "user" 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.docx_file && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(msg.docx_file!);
                        }}
                        className="text-sm mt-2 inline-block text-green-600 hover:underline cursor-pointer"
                        disabled={loading}
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

          {/* 输入区域 */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="px-3 py-2 border rounded text-sm"
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
                  className="flex-1 px-3 py-2 border rounded text-sm resize-none"
                  rows={3} // 增加默认行数，方便输入
                  disabled={loading}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
                  {loading ? "生成中..." : "发送"}
                </Button>
              </div>
              {selectedTemplate && (
                <p className="text-xs text-blue-600">
                  ✅ 已选择模板作为参考
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="ml-2 text-red-500 underline"
                  >
                    取消
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：预览和模板 */}
        <div
          className="flex flex-col border-l"
          style={{ flexBasis: `${100 - mainWidth}%`, transition: "flex-basis 0.3s ease" }}
        >
          {/* 预览区域 */}
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold">公文预览</h3>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <div
              className="bg-white p-4 border rounded text-sm"
              dangerouslySetInnerHTML={{ __html: previewHTML || marked.parse("暂无内容") }}
            />
          </div>

          {/* 模板库 */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center mb-2">
              <h3 className="font-bold text-sm">模板库</h3>
              <input
                type="text"
                placeholder="搜索模板..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-2 flex-1 px-2 py-1 text-xs border rounded"
              />
            </div>
            <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="p-1 hover:bg-gray-200 rounded truncate cursor-pointer"
                    title={t.original_name}
                    onClick={() => handleTemplateSelect(t.filename)}
                  >
                    📄 {t.original_name}
                  </li>
                ))
              ) : (
                <li className="p-1 text-gray-400">没有找到模板</li>
              )}
            </ul>
          </div>
        </div>

        {/*  resize 手柄 */}
        <div
          className="w-1 bg-gray-300 cursor-col-resize"
          onMouseDown={handleResizeStart}
          onMouseLeave={handleResizeEnd}
        />
      </div>
    </div>
  );
}
