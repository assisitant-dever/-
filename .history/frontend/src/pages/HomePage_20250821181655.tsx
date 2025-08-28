import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<"docs" | "convs" | "templates">("docs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);

  // ---------------- 数据请求 ----------------
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/history");
      setDocuments(res.data.map((d: any) => d.filename));
    } catch (err) {
      console.error("获取历史公文失败:", err);
      alert("获取历史公文失败");
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchConversations = async () => {
    setLoadingConvs(true);
    try {
      const res = await api.get("/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("获取对话历史失败:", err);
      alert("获取对话历史失败");
    } finally {
      setLoadingConvs(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get("/templates");
      setTemplates(res.data.map((t: any) => t.filename));
    } catch (err) {
      console.error("获取模板列表失败:", err);
      alert("获取模板列表失败");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const downloadDocument = async (filename: string) => {
    try {
      const res = await api.get(`/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      });
      saveAs(res.data, filename);
    } catch (err) {
      console.error("下载失败", err);
      alert("下载失败");
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/upload-template", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchTemplates();
    } catch (err) {
      console.error("上传模板失败", err);
      alert("上传模板失败");
    }
  };

  const deleteTemplate = async (filename: string) => {
    if (!confirm(`确认删除模板 ${filename} ?`)) return;
    try {
      await api.delete(`/templates/${encodeURIComponent(filename)}`);
      fetchTemplates();
    } catch (err) {
      console.error("删除模板失败:", err);
      alert("删除模板失败");
    }
  };

  const newConversation = async () => {
    try {
      await api.post("/conversations", { title: "新对话" });
      fetchConversations();
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  // ---------------- 页面加载 ----------------
  useEffect(() => {
    fetchDocuments();
    fetchConversations();
    fetchTemplates();
  }, []);

  // ---------------- 渲染 ----------------
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} />

      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-4">
          {["docs", "convs", "templates"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`px-4 py-2 rounded-lg ${
                selectedTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800"
              }`}
            >
              {tab === "docs"
                ? "历史公文"
                : tab === "convs"
                ? "对话历史"
                : "模板管理"}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
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
                    <li key={d}>
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => downloadDocument(d)}
                      >
                        {d}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* 对话历史 */}
          {selectedTab === "convs" && (
            <>
              <button
                className="mb-2 px-3 py-1 bg-green-500 text-white rounded-lg"
                onClick={newConversation}
              >
                新建对话
              </button>
              {loadingConvs ? (
                <p>加载中...</p>
              ) : conversations.length === 0 ? (
                <p>暂无对话记录</p>
              ) : (
                <ul className="space-y-2">
                  {conversations.map((c) => (
                    <li key={c.id} className="p-2 border rounded-lg">
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {c.messages?.length} 条消息
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* 模板管理 */}
          {selectedTab === "templates" && (
            <>
              <label className="mb-2 px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer inline-block">
                上传模板
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadTemplate}
                />
              </label>
              {loadingTemplates ? (
                <p>加载中...</p>
              ) : templates.length === 0 ? (
                <p>暂无模板</p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li
                      key={t}
                      className="flex justify-between items-center p-2 border rounded-lg"
                    >
                      <span>{t}</span>
                      <button
                        className="text-red-500"
                        onClick={() => deleteTemplate(t)}
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
