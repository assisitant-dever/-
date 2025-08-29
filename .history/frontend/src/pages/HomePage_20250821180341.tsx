import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<"docs" | "convs" | "templates">("docs");

  // --- 数据请求 ---
  const fetchDocuments = async () => {
    try {
      const res = await api.get("/history"); // 注意：不要重复 /api
      setDocuments(res.data.map((d: any) => d.filename));
    } catch (err) {
      console.error("获取历史公文失败:", err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get("/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("获取对话历史失败:", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates");
      setTemplates(res.data.map((t: any) => t.filename));
    } catch (err) {
      console.error("获取模板列表失败:", err);
    }
  };

  const deleteTemplate = async (filename: string) => {
    if (!confirm(`确认删除模板 ${filename} ?`)) return;
    try {
      await api.delete(`/templates/${filename}`);
      fetchTemplates();
    } catch (err) {
      console.error("删除模板失败:", err);
    }
  };

  // --- 页面加载时获取数据 ---
  useEffect(() => {
    fetchDocuments();
    fetchConversations();
    fetchTemplates();
  }, []);

  // --- 渲染 ---
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setSelectedTab("docs")}
            className={`px-4 py-2 rounded-lg ${selectedTab === "docs" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800"}`}
          >
            历史公文
          </button>
          <button
            onClick={() => setSelectedTab("convs")}
            className={`px-4 py-2 rounded-lg ${selectedTab === "convs" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800"}`}
          >
            对话历史
          </button>
          <button
            onClick={() => setSelectedTab("templates")}
            className={`px-4 py-2 rounded-lg ${selectedTab === "templates" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800"}`}
          >
            模板管理
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {selectedTab === "docs" && (
            <ul className="space-y-2">
              {documents.length === 0 ? (
                <p>暂无历史公文</p>
              ) : (
                documents.map((d) => (
                  <li key={d}>
                    <a
                      href={`/api/download/${encodeURIComponent(d)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {d}
                    </a>
                  </li>
                ))
              )}
            </ul>
          )}

          {selectedTab === "convs" && (
            <ul className="space-y-2">
              {conversations.length === 0 ? (
                <p>暂无对话记录</p>
              ) : (
                conversations.map((c) => (
                  <li key={c.id} className="p-2 border rounded-lg">
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {c.messages?.length} 条消息
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {selectedTab === "templates" && (
            <ul className="space-y-2">
              {templates.length === 0 ? (
                <p>暂无模板</p>
              ) : (
                templates.map((t) => (
                  <li key={t} className="flex justify-between items-center p-2 border rounded-lg">
                    <span>{t}</span>
                    <button className="text-red-500" onClick={() => deleteTemplate(t)}>
                      删除
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
