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
    console.log("获取会话列表:", res.data);
    if (res.data.length === 0) {
      // 🆕 没有会话？自动创建一个
      const newConv = await api.post("/api/conversations", { title: "我的第一份公文" });
      dispatch({ type: "SET_CONVS", payload: [newConv.data] });
      dispatch({ type: "SET_CURRENT_CONV", payload: newConv.data });
    } else {
      dispatch({ type: "SET_CONVS", payload: res.data });
      if (!state.currentConv) {
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data[0] });
      }
    }
  } catch (err) {
    console.error("获取或创建会话失败", err);
  } finally {
    setLoading(false);
  }
};

  // 向对话中添加消息
const addMessageToConversation = async (role: string, content: string, convId: number) => {
  const formData = new FormData();
  formData.append("role", role);
  formData.append("content", content);

  try {
    const res = await api.post(`/api/conversations/${convId}/messages`, formData);
    setMessages((prev) => [...prev, res.data]);
  } catch (err) {
    console.error("发送消息失败", err);
  }
};

  // 生成公文
const generateDocument = async () => {
  if (!state.currentConv) {
    alert("当前会话无效");
    return;
  }

  const formData = new FormData();
  formData.append("doc_type", "通知");
  formData.append("user_input", userInput);

  try {
    const res = await api.post("/api/generate", formData);
    
    // 手动把 AI 回复加入对话
    setMessages((prev) => [
      ...prev,
      { 
        role: "assistant", 
        content: res.data.text,
        docx_file: res.data.filename
      },
    ]);
  } catch (err) {
    console.error("生成失败", err);
    alert("生成失败");
  }
};

  // 发送用户消息
const handleSendMessage = async () => {
  if (userInput.trim() === "") return;

  // ✅ 安全检查
  if (!state.currentConv) {
    alert("当前没有选中的对话，请稍后再试");
    return;
  }

  // ✅ 现在可以安全使用 .id
  await addMessageToConversation("user", userInput, state.currentConv.id);

  setUserInput("");
  await generateDocument();
};
  useEffect(() => {
    console.log("当前会话:", state.currentConv); // 👈 加这行
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
            disabled={!state.currentConv || loading}  // 👈 禁用条件
          >
            {loading ? "加载中..." : "发送"}
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
