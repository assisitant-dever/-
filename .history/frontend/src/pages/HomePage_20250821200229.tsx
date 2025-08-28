import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<"convs" | "docs">("convs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  // 数据请求
  const fetchConversations = async () => {
    setLoadingConvs(true);
    try {
      const res = await api.get("/api/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("获取对话历史失败:", err);
      alert("获取对话历史失败");
    } finally {
      setLoadingConvs(false);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/api/history");
      setDocuments(res.data.map((d: any) => d.filename));
    } catch (err) {
      console.error("获取历史公文失败:", err);
      alert("获取历史公文失败");
    } finally {
      setLoadingDocs(false);
    }
  };

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

  const sendMessage = async () => {
    // 发送消息（多轮对话）
    const currentConv = state.currentConv;
    if (!currentConv) {
      alert("请选择一个对话");
      return;
    }

    try {
      const res = await api.post(`/api/conversations/${currentConv.id}/messages`, { message: newMessage });
      dispatch({
        type: "SET_CURRENT_CONV",
        payload: { ...currentConv, messages: [...currentConv.messages, res.data] },
      });
      setNewMessage(""); // 清空输入框
    } catch (err) {
      console.error("发送消息失败", err);
      alert("发送消息失败");
    }
  };

  // 上传文件
  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/api/upload-template", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchDocuments(); // 上传后重新获取公文列表
    } catch (err) {
      console.error("上传模板失败", err);
      alert("上传模板失败");
    }
  };

  // 页面加载时获取对话和公文
  useEffect(() => {
    fetchConversations();
    fetchDocuments();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <Sidebar onSelect={() => {}} />
      {/* 中间区域 - 对话区域 */}
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          对话区
        </h1>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-4">
          {["convs", "docs"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`px-4 py-2 rounded-lg ${
                selectedTab === tab ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800"
              }`}
            >
              {tab === "convs" ? "对话历史" : "历史公文"}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {/* 对话历史 */}
          {selectedTab === "convs" && (
            <>
              <div className="space-y-2">
                {loadingConvs ? (
                  <p>加载中...</p>
                ) : conversations.length === 0 ? (
                  <p>暂无对话记录</p>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 border rounded-lg cursor-pointer"
                      onClick={() => {
                        dispatch({ type: "SET_CURRENT_CONV", payload: c });
                      }}
                    >
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {c.messages?.length} 条消息
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 输入框和发送按钮 */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="输入消息..."
                />
                <Button onClick={sendMessage}>发送</Button>
              </div>
            </>
          )}

          {/* 历史公文 */}
          {selectedTab === "docs" && (
            <>
              {loadingDocs ? (
                <p>加载中...</p>
              ) : documents.length === 0 ? (
                <p>暂无历史公文</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d} className="flex justify-between items-center">
                      <span>{d}</span>
                      <button
                        className="text-blue-500"
                        onClick={() => downloadDocument(d)}
                      >
                        下载
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧 - 公文格式与上传文件功能 */}
      <div className="w-96 bg-slate-100 dark:bg-slate-900 p-4">
        <h2 className="text-xl font-semibold mb-4">公文格式</h2>

        {/* 上传文件 */}
        <label className="mb-4 block text-sm text-blue-500 cursor-pointer">
          上传模板
          <input type="file" className="hidden" onChange={handleUploadTemplate} />
        </label>

        {/* 公文展示 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
            <h3 className="font-semibold">公文示例</h3>
            <p className="text-sm">此处显示公文内容...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
