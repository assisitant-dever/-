import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { saveAs } from "file-saver";

export default function Editor() {
  // 当前公文生成状态
  const [editorContent, setEditorContent] = useState("");
  const [userInput, setUserInput] = useState("");
  const [selectedType, setSelectedType] = useState("通知");
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [generatedFile, setGeneratedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 对话功能
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConv, setCurrentConv] = useState<any | null>(null);
  const [inputText, setInputText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 本地缓存 editorContent
  useEffect(() => {
    const saved = localStorage.getItem("editorContent");
    if (saved) setEditorContent(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("editorContent", editorContent);
  }, [editorContent]);

  // 上传模板
  const handleTemplateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedTemplate(file);
    toast.info(`已选择模板: ${file.name}`);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://127.0.0.1:8000/upload-template", formData);
      toast.success(`模板 "${res.data.filename}" 上传成功`);
    } catch (err) {
      console.error(err);
      toast.error("模板上传失败");
    }
  };

  // 公文生成
  const handleGeneratePreview = async () => {
    if (!userInput.trim()) {
      toast.error("请输入生成公文的要求！");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("doc_type", selectedType);
      formData.append("user_input", userInput);
      if (selectedTemplate) formData.append("template_filename", selectedTemplate.name);

      const response = await axios.post("http://127.0.0.1:8000/api/generate", formData);
      setEditorContent(response.data.text || "");
      setGeneratedFile(response.data.filename); 
      toast.success("生成预览成功！");
    } catch (err) {
      console.error(err);
      toast.error("生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 下载 DOCX
  const handleDownload = async (filename?: string) => {
    const fileToDownload = filename || generatedFile;
    if (!fileToDownload) return;
    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/api/download/${encodeURIComponent(fileToDownload)}`,
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      saveAs(blob, fileToDownload);
    } catch (err) {
      console.error("下载失败", err);
    }
  };

  // -------------------- 对话功能 --------------------
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/conversations/");
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("获取对话失败");
    }
  };

  const createNewConversation = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/conversations/", { title: "新对话" });
      setConversations([...conversations, res.data]);
      setCurrentConv(res.data);
    } catch (err) {
      console.error(err);
      toast.error("新建对话失败");
    }
  };

  const selectConversation = async (conv: any) => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/conversations/${conv.id}`);
      setCurrentConv(res.data);
    } catch (err) {
      console.error(err);
      toast.error("获取对话失败");
    }
  };
  const sendMessage = async () => {
    if (!userInput.trim()) return;

    // 添加用户消息到对话
    const userMessage = {
      role: "user",
      content: userInput,
      timestamp: Date.now(),
    };

    setCurrentConv((prev: any) => {
      if (!prev) return { messages: [userMessage] };
      return { ...prev, messages: [...prev.messages, userMessage] };
    });

    // 清空输入框
    setUserInput("");

    // 调用 AI 接口
    await generateAIResponse(userInput, selectedTemplate|| undefined);
  };


  // 发送消息给 AI
  const generateAIResponse = async (inputText: string, templateFile?: File) => {
    if (!inputText.trim()) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("doc_type", selectedType);           // 必填，与后端一致
      formData.append("user_input", inputText);            // 必填
      if (templateFile) formData.append("template_filename", templateFile.name);

      const response = await axios.post(
        "http://127.0.0.1:8000/api/generate",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      // 假设 currentConv 是当前对话对象
      const newMessage = {
        role: "ai",
        content: response.data.text,
        filename: response.data.filename || null,  // 返回的 docx 文件名
        timestamp: Date.now(),
      };

      // 更新当前对话记录
      setCurrentConv((prev: any) => {
        if (!prev) return { messages: [newMessage] };
        return { ...prev, messages: [...prev.messages, newMessage] };
      });

    } catch (err) {
      console.error("生成失败", err);
      toast.error("生成失败，请检查输入或模板");
    } finally {
      setLoading(false);
    }
  };


  // -------------------- 渲染 --------------------
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 左侧 Sidebar */}
      <div className="w-64 border-r border-slate-300 dark:border-slate-700 flex flex-col p-2">
        <button
          onClick={createNewConversation}
          className="bg-blue-500 text-white rounded-lg py-1 px-2 mb-2"
        >
          新建对话
        </button>
        <div className="flex-1 overflow-auto">
          {Array.isArray(conversations) &&
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-2 rounded cursor-pointer mb-1 ${
                  currentConv?.id === conv.id ? "bg-blue-200 dark:bg-blue-600" : "hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {conv.title}
              </div>
            ))}
        </div>
      </div>

      {/* 右侧主区域 */}
      <div className="flex-1 p-4 md:p-6 flex flex-col">
        {currentConv ? (
          // 聊天式对话窗口
          <div className="flex flex-col flex-1 bg-white dark:bg-slate-800 rounded-lg shadow p-4 overflow-auto">
            <div className="flex-1 space-y-2 overflow-auto">
              {currentConv.messages.map((msg: any) => (
                <div key={msg.id} className="flex flex-col">
                  <div className={`p-2 rounded-lg max-w-[70%] ${
                    msg.role === "user" ? "bg-blue-100 self-end" : "bg-slate-200 dark:bg-slate-700 self-start"
                  }`}>
                    {msg.content}
                    {msg.docx_file && (
                      <div className="mt-1 text-sm text-blue-600 cursor-pointer">
                        <a href={`http://127.0.0.1:8000/api/download/${msg.docx_file}`} target="_blank" rel="noreferrer">
                          下载 DOCX
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* 输入框 */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="输入消息..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 border rounded-lg p-2"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white rounded-lg py-2 px-4"
                disabled={loading}
              >
                {loading ? "生成中..." : "发送"}
              </button>
            </div>

            {/* 公文类型 + 模板 */}
            <div className="mt-2 flex gap-2">
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="通知">通知</option>
                <option value="请示">请示</option>
                <option value="会议纪要">会议纪要</option>
              </select>
              <input type="file" onChange={handleTemplateChange} className="border p-2 rounded-lg" />
            </div>
          </div>
        ) : (
          // 默认公文生成界面
          <div className="min-h-screen flex flex-col items-center w-full max-w-6xl mx-auto">
            <div className="w-full mb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300 mb-2">
                公文写作助手
              </h1>
              <p className="text-slate-600 dark:text-slate-300">快速生成各类公文，提高办公效率</p>
            </div>

            <div className="w-full flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5">
              {/* 左侧输入 */}
              <div className="md:w-1/3 flex flex-col gap-4">
                <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="px-3 py-2 border rounded-lg">
                  <option value="通知">通知</option>
                  <option value="请示">请示</option>
                  <option value="会议纪要">会议纪要</option>
                </select>

                <input type="file" onChange={handleTemplateChange} className="border p-2 rounded-lg" />

                <textarea
                  placeholder="请描述公文要求..."
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  className="border p-2 rounded-lg h-40 resize-none"
                />

                <button
                  onClick={handleGeneratePreview}
                  disabled={loading}
                  className="bg-blue-600 text-white rounded-lg py-2 mt-2"
                >
                  {loading ? "生成中..." : "生成预览"}
                </button>

                <button
                  onClick={() => handleDownload()}
                  disabled={!editorContent}
                  className="bg-green-600 text-white rounded-lg py-2 mt-2"
                >
                  下载 DOCX
                </button>
              </div>

              {/* 右侧渲染 */}
              <div className="md:w-2/3 border rounded-lg p-4 overflow-auto max-h-[600px]">
                {editorContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editorContent}</ReactMarkdown>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-center">生成结果将显示在这里</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
