import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<"docs"|"convs"|"templates">("docs");

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/history"); // 去掉 /api
      setDocuments(res.data.documents);
    } catch (err) { console.error(err); }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get("/conversations"); // 去掉 /api
      setConversations(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates"); // 去掉 /api
      setTemplates(res.data.templates.map((t:any)=>t.filename));
    } catch (err) { console.error(err); }
  };



  useEffect(() => {
    fetchDocuments();
    fetchConversations();
    fetchTemplates();
  }, []);

  const deleteTemplate = async (filename: string) => {
    if (!confirm(`确认删除模板 ${filename} ?`)) return;
    try {
      await api.delete(`/templates/${filename}`); // 去掉 /api
      fetchTemplates();
    } catch (err) { console.error(err); }
  };


  // --- 渲染 ---
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} /> {/* 不操作对话选择 */}
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-4">
          <button onClick={() => setSelectedTab("docs")}
            className={`px-4 py-2 rounded-lg ${selectedTab==="docs"?"bg-blue-600 text-white":"bg-white dark:bg-slate-800"}`}>
            历史公文
          </button>
          <button onClick={() => setSelectedTab("convs")}
            className={`px-4 py-2 rounded-lg ${selectedTab==="convs"?"bg-blue-600 text-white":"bg-white dark:bg-slate-800"}`}>
            对话历史
          </button>
          <button onClick={() => setSelectedTab("templates")}
            className={`px-4 py-2 rounded-lg ${selectedTab==="templates"?"bg-blue-600 text-white":"bg-white dark:bg-slate-800"}`}>
            模板管理
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {selectedTab === "docs" && (
            <ul className="space-y-2">
              {documents.length === 0 ? <p>暂无历史公文</p> :
                documents.map(d => (
                  <li key={d}>
                    <a href={`http://127.0.0.1:8000/api/download/${encodeURIComponent(d)}`} 
                      target="_blank" rel="noreferrer"
                      className="text-blue-500 hover:underline">{d}</a>
                  </li>
                ))
              }
            </ul>
          )}

          {selectedTab === "convs" && (
            <ul className="space-y-2">
              {conversations.length === 0 ? <p>暂无对话记录</p> :
                conversations.map(c => (
                  <li key={c.id} className="p-2 border rounded-lg">
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {c.messages?.length} 条消息
                    </div>
                  </li>
                ))
              }
            </ul>
          )}

          {selectedTab === "templates" && (
            <ul className="space-y-2">
              {templates.length === 0 ? <p>暂无模板</p> :
                templates.map(t => (
                  <li key={t} className="flex justify-between items-center p-2 border rounded-lg">
                    <span>{t}</span>
                    <button className="text-red-500" onClick={() => deleteTemplate(t)}>删除</button>
                  </li>
                ))
              }
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
