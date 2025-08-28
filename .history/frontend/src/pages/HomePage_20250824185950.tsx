import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { ToastContainer, toast } from "react-toastify"; // 引入 Toast
import "react-toastify/dist/ReactToastify.css"; // 引入样式

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<string[]>([]); // 定义 apiKeys 状态
  const [selectedTab, setSelectedTab] = useState<"docs" | "templates" | "profile" | "api-keys">("docs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const { state, dispatch } = useApp();

  // ---------------- 数据请求 ----------------
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/api/history");
      setDocuments(res.data.map((d: any) => d.filename));
    } catch (err) {
      console.error("获取历史公文失败:", err);
      toast.error("获取历史公文失败"); // 显示错误提示
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get("/api/templates");
      setTemplates(res.data.map((t: any) => t.filename));
    } catch (err) {
      console.error("获取模板列表失败:", err);
      toast.error("获取模板列表失败");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchApiKeys = async () => {
    setLoadingApiKeys(true);
    try {
      const res = await api.get("/api/keys");
      setApiKeys(res.data.map((k: any) => k.key)); // 假设返回的格式是 key
    } catch (err) {
      console.error("获取 API Keys 失败:", err);
      toast.error("获取 API Keys 失败");
    } finally {
      setLoadingApiKeys(false);
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
      toast.error("下载失败");
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/api/upload-template", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchTemplates();
    } catch (err) {
      console.error("上传模板失败", err);
      toast.error("上传模板失败");
    }
  };

  const deleteTemplate = async (filename: string) => {
    if (!confirm(`确认删除模板 ${filename} ?`)) return;
    try {
      await api.delete(`/api/templates/${encodeURIComponent(filename)}`);
      fetchTemplates();
    } catch (err) {
      console.error("删除模板失败:", err);
      toast.error("删除模板失败");
    }
  };

  const handleApiKeyAdd = async () => {
    try {
      const response = await api.post("/api/keys");
      toast.success("API Key 添加成功");
      fetchApiKeys(); // 重新加载 API Keys
    } catch (err) {
      console.error("添加 API Key 失败:", err);
      toast.error("添加 API Key 失败");
    }
  };

  const handleApiKeyDelete = async (key: string) => {
    if (!confirm(`确认删除 API Key: ${key} ?`)) return;
    try {
      await api.delete(`/api/keys/${key}`);
      toast.success("API Key 删除成功");
      fetchApiKeys(); // 重新加载 API Keys
    } catch (err) {
      console.error("删除 API Key 失败:", err);
      toast.error("删除 API Key 失败");
    }
  };

  // ---------------- 页面加载 ----------------
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
    fetchApiKeys(); // 调用 API 获取 API Keys
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
          {["docs", "templates", "profile", "api-keys"].map((tab) => (
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
                : tab === "templates"
                ? "模板管理"
                : tab === "api-keys"
                ? "API Keys 管理"
                : "个人信息"}
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

          {/* API Keys 管理 */}
          {selectedTab === "api-keys" && (
            <div>
              <button
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                onClick={handleApiKeyAdd}
              >
                添加 API Key
              </button>
              {loadingApiKeys ? (
                <p>加载中...</p>
              ) : (
                <ul className="space-y-2">
                  {apiKeys.map((key) => (
                    <li key={key} className="flex justify-between items-center p-2 border rounded-lg">
                      <span>{key}</span>
                      <button
                        className="text-red-500"
                        onClick={() => handleApiKeyDelete(key)}
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 个人信息 */}
          {selectedTab === "profile" && (
            <div>
              <h2 className="text-xl font-semibold">个人信息</h2>
              <p>用户名: {state.user?.name || "未登录"}</p>
              <p>邮箱: {state.user?.email || "未提供"}</p>
              <p>注册时间: {state.user?.createdAt || "未知"}</p>

              <h2 className="text-xl font-semibold mt-4">设置</h2>
              <button
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                onClick={() => alert("修改设置")}
              >
                修改设置
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast 提示容器 */}
      <ToastContainer />
    </div>
  );
}
