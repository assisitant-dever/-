import React, { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { Button } from "../components/ui/button";

// 模拟对话消息的接口类型
interface Message {
  sender: "user" | "ai";
  content: string;
}

export default function CorePage() {
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(
    state.currentConversation
  );

  // 获取对话内容
  const fetchMessages = async () => {
    if (!selectedConversation) return;

    try {
      const res = await api.get(`/api/conversations/${selectedConversation.id}`);
      setMessages(res.data.messages);
    } catch (err) {
      console.error("获取对话内容失败:", err);
      alert("获取对话内容失败");
    }
  };

  // 发送新消息
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    setIsSending(true);
    const newMessage: Message = { sender: "user", content: inputMessage };

    // 更新当前对话中的消息
    setMessages((prevMessages) => [...prevMessages, newMessage]);

    try {
      await api.post(`/api/conversations/${selectedConversation.id}/messages`, {
        content: inputMessage,
      });
      setInputMessage(""); // 清空输入框
      fetchMessages(); // 刷新对话内容
    } catch (err) {
      console.error("发送消息失败:", err);
      alert("发送消息失败");
    } finally {
      setIsSending(false);
    }
  };

  // 文件下载
  const downloadDocument = async (filename: string) => {
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

  // 初始化时加载对话内容
  useEffect(() => {
    fetchMessages();
  }, [selectedConversation]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* 左侧 Sidebar */}
      <Sidebar onSelect={(conversation) => setSelectedConversation(conversation)} />

      {/* 中间对话区域 */}
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          {selectedConversation ? selectedConversation.title : "选择一个对话"}
        </h1>

        {/* 对话内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {messages.length === 0 ? (
            <p>暂无对话记录</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={message.sender === "user" ? "text-left" : "text-right"}>
                  <div
                    className={`inline-block max-w-[70%] p-2 rounded-lg ${
                      message.sender === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-black"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div className="mt-4">
          <input
            type="text"
            className="w-full p-2 border rounded-lg dark:bg-slate-700"
            placeholder="请输入消息"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
          />
          <Button
            onClick={sendMessage}
            disabled={isSending}
            className="mt-2 w-full bg-blue-600 text-white"
          >
            {isSending ? "发送中..." : "发送"}
          </Button>
        </div>
      </div>

      {/* 右侧公文展示区 */}
      <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
        <h2 className="text-xl font-semibold mb-4">公文管理</h2>

        {/* 公文展示内容 */}
        <div className="space-y-4">
          {state.documents && state.documents.length > 0 ? (
            state.documents.map((doc) => (
              <div key={doc} className="flex justify-between items-center p-2 border rounded-lg">
                <span>{doc}</span>
                <button
                  className="text-blue-500 hover:underline"
                  onClick={() => downloadDocument(doc)}
                >
                  下载
                </button>
              </div>
            ))
          ) : (
            <p>暂无公文文件</p>
          )}
        </div>
      </div>
    </div>
  );
}
