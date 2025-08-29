import React, { useEffect, useState } from "react";
import axios from "axios";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  docx_file?: string;
  created_at: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
  created_at: string;
}

export default function ChatWindow({ conversation }: { conversation: Conversation }) {
  const [messages, setMessages] = useState<Message[]>(conversation.messages || []);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setMessages(conversation.messages || []);
  }, [conversation]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // 先保存 user 消息
    await axios.post(`http://127.0.0.1:8000/api/conversations/${conversation.id}/messages`, {
      role: "user",
      content: input
    }, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    // 调后端生成 AI 回复
    const formData = new FormData();
    formData.append("doc_type", "通知"); // 可以从选择器取值
    formData.append("user_input", input);
    if (file) formData.append("file", file);

    const res = await axios.post("http://127.0.0.1:8000/api/generate", formData);
    const aiText = res.data.text;
    const docxFile = res.data.filename;

    // 保存 assistant 消息
    const aiMsg = await axios.post(`http://127.0.0.1:8000/api/conversations/${conversation.id}/messages`, {
      role: "assistant",
      content: aiText,
      docx_file: docxFile
    }, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    setMessages(prev => [...prev, { ...aiMsg.data }]);
    setInput("");
    setFile(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        {messages.map(m => (
          <div key={m.id} className={`p-3 rounded-xl max-w-lg ${m.role === "user" ? "ml-auto bg-blue-600 text-white" : "mr-auto bg-white dark:bg-slate-700 text-black dark:text-white"}`}>
            <div>{m.content}</div>
            {m.docx_file && (
              <a
                className="text-sm text-blue-400 underline block mt-1"
                href={`http://127.0.0.1:8000/api/download/${encodeURIComponent(m.docx_file)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ⬇ 下载此回复 DOCX
              </a>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t flex items-center gap-2">
        <input
          type="text"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2"
        />
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          发送
        </button>
      </div>
    </div>
  );
}
