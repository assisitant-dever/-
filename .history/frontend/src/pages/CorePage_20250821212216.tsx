import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useApp } from "../store/app";
import api from "../api";
import { saveAs } from "file-saver";

export default function CorePage() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  // 拉取对话列表
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
      if (res.data.length > 0 && !state.currentConv) {
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data[0] });
      }
    } catch (err) {
      console.error("获取对话历史失败", err);
    } finally {
      setLoading(false);
    }
  };

  // 向对话中添加消息
  const addMessageToConversation = async (role: string, content: string, convId: number) => {
    try {
      const res = await api.post(`/api/conversations/${convId}/messages`, {
        role,
        content,
      });
      setMessages((prevMessages) => [...prevMessages, res.data]);
    } catch (err) {
      console.error("发送消息失败", err);
    }
  };

  // 生成公文
  const generateDocument = async () => {
    try {
      const res = await api.post("/api/generate", {
        doc_type: "通知",
        user_input: userInput,
        conv_id: state.currentConv.id,
      });
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: res.data.text },
      ]);
      // 显示生成的文件
      saveAs(res.data.filename, res.data.filename);
    } catch (err) {
      console.error("生成公文失败", err);
    }
  };

  // 发送用户消息
  const handleSendMessage = async () => {
    if (userInput.trim() === "") return;

    // 发送用户输入的消息
    await addMessageToConversation("user", userInput, state.currentConv.id);

    // 清空输入框并生成 AI 回复
    setUserInput("");
    await generateDocument();
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* 左侧 Sidebar */}
      <Sidebar
        conversations={state.conversations}
        onSelect={(conv) => dispatch({ type: "SET_CURRENT_CONV", payload: conv })}
        loading={loading}
      />
      {/* 中间区域：对话显示和输入框 */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className="p-2 rounded-lg bg-gray-200">
                <p><strong>{msg.role === "user" ? "你：" : "AI："}</strong></p>
                <p>{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex">
          <textarea
            className="w-full p-2 rounded-lg"
            placeholder="请输入内容..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
          />
          <button
            className="ml-2 bg-blue-600 text-white py-2 px-4 rounded-lg"
            onClick={handleSendMessage}
          >
            发送
          </button>
        </div>
      </div>
      {/* 右侧：公文显示 */}
      <div className="w-96 p-4 bg-slate-100 dark:bg-slate-800">
        <h3 className="text-xl font-bold mb-4">生成的公文</h3>
        {messages
          .filter((msg) => msg.role === "assistant")
          .map((msg, index) => (
            <div key={index}>
              <pre className="bg-gray-200 p-4 rounded-lg">{msg.content}</pre>
              <a
                href={`/api/download/${msg.docx_file}`}
                target="_blank"
                className="text-blue-500 mt-2 block"
              >
                下载公文
              </a>
            </div>
          ))}
      </div>
    </div>
  );
}
