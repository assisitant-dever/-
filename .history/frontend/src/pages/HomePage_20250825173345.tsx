// HomePage.tsx（
import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// 1. 引入改造后的 ApiKeyManager 组件
import ApiKeyManager from "../components/ApiKeyManager"; // 路径需按你的实际目录调整

export default function HomePage() {
  const [documents, setDocuments] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<"docs" | "templates" | "profile" | "api-keys">("docs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const { state, dispatch } = useApp();
  //修改状态类型：存储模板完整信息
  interface Template {
    id: number;          // 后端返回的模板ID（关键）
    filename: string;    // 服务器存储的文件名
    original_name: string; // 用户上传时的原始文件名（前端展示用）
    uploaded_at: string; // 上传时间
  }
  const [templates, setTemplates] = useState<Template[]>([]);


  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/api/history");
      setDocuments(res.data.map((d: any) => d.filename));
    } catch (err) {
      console.error("获取历史公文失败:", err);
      toast.error("获取历史公文失败");
    } finally {
      setLoadingDocs(false);
    }
  };

  // 修改 fetchTemplates：获取完整模板信息
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get("/api/templates");
      // 直接存储后端返回的完整模板数组（含id）
      setTemplates(res.data as Template[]);
    } catch (err) {
      console.error("获取模板列表失败:", err);
      toast.error("获取模板列表失败");
    } finally {
      setLoadingTemplates(false);
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
      toast.success("模板上传成功");
    } catch (err) {
      console.error("上传模板失败", err);
      toast.error("上传模板失败");
    }
  };

  // 用模板id调用删除接口
  const deleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`确认删除模板 ${templateName} ?`)) return;
    try {
      // 调用后端接口：/api/templates/{templateId}
      await api.delete(`/api/templates/${templateId}`);
      fetchTemplates();
      toast.success("模板删除成功");
    } catch (err) {
      console.error("删除模板失败:", err);
      toast.error("删除模板失败");
    }
  };

  // ---------------- 页面加载（删除 fetchApiKeys 调用） ----------------
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
    // 移除：fetchApiKeys();
  }, []);

  // ---------------- 渲染（API Keys 标签页直接用 ApiKeyManager） ----------------
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} />

      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换（无改动） */}
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

        {/* Tab 内容（仅修改 api-keys 标签页） */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {/* 历史公文（无改动） */}
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

          {/* 模板管理（无改动） */}
          {selectedTab === "templates" && (
          <>
            <label className="mb-2 px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer inline-block">
              上传模板
              <input
                type="file"
                className="hidden"
                onChange={handleUploadTemplate}
                accept=".docx" // 限制仅上传docx文件（可选，优化体验）
              />
            </label>
            {loadingTemplates ? (
              <p>加载中...</p>
            ) : templates.length === 0 ? (
              <p>暂无模板</p>
            ) : (
              <ul className="space-y-2">
                {templates.map((template) => (
                  <li
                    key={template.id} // 用id作为key（唯一标识）
                    className="flex justify-between items-center p-2 border rounded-lg"
                  >
                    {/* 展示用户上传的原始文件名（更友好），而非服务器文件名 */}
                    <span>{template.original_name}</span>
                    <button
                      className="text-red-500"
                      // 传模板id和原始文件名（确认弹窗用）
                      onClick={() => deleteTemplate(template.id, template.original_name)}
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

          {/* 2. API Keys 管理：替换为 ApiKeyManager 组件 */}
          {selectedTab === "api-keys" && (
            <ApiKeyManager onConfigChange={() => {
      console.log("API 配置已更新");}}
      /> 
          )}

          {/* 个人信息（无改动） */}
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

      <ToastContainer />
    </div>
  );
}