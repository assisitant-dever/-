// HomePage.tsx
import { useEffect, useState } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ApiKeyManager from "../components/ApiKeyManager";

export default function HomePage() {
  const [documents, setDocuments] = useState<Array<{
    id: number;
    filename: string;
    doc_type: string;
    used_template: string | null;
    created_at: string;
    content_preview: string;
  }>>([]); // 完善文档类型定义
  const [selectedTab, setSelectedTab] = useState<"docs" | "templates" | "profile" | "api-keys">("docs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const { state, dispatch } = useApp();

  // 完善模板类型定义（匹配后端返回字段）
  interface Template {
    id: number;
    filename: string;
    original_name: string;
    uploaded_at: string;
    content_preview: string; // 后端返回的模板内容预览
  }
  const [templates, setTemplates] = useState<Template[]>([]);


  // 调整：获取完整公文历史（含类型、模板关联等信息）
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/api/history");
      // 存储完整文档信息，而非仅文件名
      setDocuments(res.data as Array<{
        id: number;
        filename: string;
        doc_type: string;
        used_template: string | null;
        created_at: string;
        content_preview: string;
      }>);
    } catch (err) {
      console.error("获取历史公文失败:", err);
      toast.error("获取历史公文失败");
    } finally {
      setLoadingDocs(false);
    }
  };

  // 调整：匹配后端 /api/templates 接口返回格式
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get("/api/templates");
      setTemplates(res.data as Template[]);
    } catch (err) {
      console.error("获取模板列表失败:", err);
      toast.error("获取模板列表失败");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 调整：下载接口路径匹配后端 /api/download/{filename}
  const downloadDocument = async (filename: string) => {
    try {
      const res = await api.get(`/api/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      });
      saveAs(res.data, filename);
      toast.success("下载成功");
    } catch (err) {
      console.error("下载失败", err);
      toast.error("下载失败：文件不存在或无权访问");
    }
  };

  // 调整：上传模板接口路径匹配后端 /api/upload-template
  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 校验文件类型（仅允许docx）
    if (file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && !file.name.endsWith(".docx")) {
      toast.error("请上传docx格式的模板文件");
      return;
    }
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
      toast.error("上传模板失败：服务器错误或文件过大");
    }
  };

  // 新增：删除模板接口（后端需补充 /api/templates/{templateId} 删除接口）
  const deleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`确认删除模板「${templateName}」？删除后不可恢复`)) return;
    try {
      await api.delete(`/api/templates/${templateId}`);
      fetchTemplates();
      toast.success("模板删除成功");
    } catch (err) {
      console.error("删除模板失败:", err);
      toast.error("删除模板失败：模板不存在或已被使用");
    }
  };

  // 新增：查看模板详情（调用后端 /api/template-content/{templateId} 接口）
  const viewTemplateContent = async (templateId: number) => {
    try {
      const res = await api.get(`/api/template-content/${templateId}`);
      // 弹窗展示模板内容
      const content = res.data.content;
      const modal = window.open("", "_blank", "width=800,height=600");
      if (modal) {
        modal.document.write(`
          <html>
            <head>
              <title>模板内容预览</title>
              <style>
                body { padding: 20px; font-family: sans-serif; line-height: 1.6; }
                h1 { color: #1e40af; margin-bottom: 20px; }
                .content { white-space: pre-wrap; word-break: break-all; }
              </style>
            </head>
            <body>
              <h1>模板内容预览</h1>
              <div class="content">${content}</div>
            </body>
          </html>
        `);
        modal.document.close();
      }
    } catch (err) {
      console.error("查看模板内容失败:", err);
      toast.error("查看模板内容失败：模板不存在或无权访问");
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchTemplates();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} />

      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换 */}
        <div className="flex gap-4 mb-4 flex-wrap">
          {[
            { key: "docs", label: "历史公文" },
            { key: "templates", label: "模板管理" },
            { key: "profile", label: "个人信息" },
            { key: "api-keys", label: "API Keys 管理" }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedTab(key as any)}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedTab === key
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow space-y-4 max-h-[70vh] overflow-auto">
          {/* 历史公文：展示完整信息（类型、时间、模板、预览） */}
          {selectedTab === "docs" && (
            <>
              {loadingDocs ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-slate-500">加载历史公文中...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <p>暂无历史公文记录</p>
                  <p className="text-sm mt-2">可前往公文生成页面创建新公文</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          公文类型
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          文件名
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          使用模板
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          生成时间
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          内容预览
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                              {doc.doc_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{doc.filename}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {doc.used_template || <span className="text-slate-400">无</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                            {doc.created_at}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {doc.content_preview}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => downloadDocument(doc.filename)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                            >
                              下载
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 模板管理：展示预览+查看/删除操作 */}
          {selectedTab === "templates" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">模板管理</h2>
              <label className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer inline-block hover:bg-green-700 transition-colors">
                上传模板
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadTemplate}
                  accept=".docx"
                />
              </label>
            </div>
            
            {loadingTemplates ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-slate-500">加载模板列表中...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <p>暂无模板记录</p>
                <p className="text-sm mt-2">点击上方「上传模板」添加公文模板</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div 
                    key={template.id} 
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow dark:border-slate-700"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {template.original_name}
                      </h3>
                      <button
                        onClick={() => deleteTemplate(template.id, template.original_name)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      上传时间：{template.uploaded_at}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                      内容预览：{template.content_preview}
                    </p>
                    <button
                      onClick={() => viewTemplateContent(template.id)}
                      className="w-full py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      查看完整内容
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

          {/* API Keys 管理：使用改造后的组件 */}
          {selectedTab === "api-keys" && (
            <ApiKeyManager 
              onConfigChange={() => {
                toast.success("API 配置已更新");
                console.log("API 配置已更新");
              }}
            /> 
          )}

          {/* 个人信息：补充用户信息展示 */}
          {selectedTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">个人信息</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">用户名</p>
                    <p className="font-medium">{state.user?.name || "未登录"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">邮箱</p>
                    <p className="font-medium">{state.user?.email || "未提供"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">角色</p>
                    <p className="font-medium">{state.user?.role || "普通用户"}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">注册时间</p>
                    <p className="font-medium">{state.user?.createdAt || "未知"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">账户设置</h2>
                <div className="space-y-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => alert("修改密码功能开发中")}
                  >
                    修改密码
                  </button>
                  <button
                    className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    onClick={() => {
                      if (confirm("确认退出登录？")) {
                        dispatch({ type: "LOGOUT" });
                        window.location.href = "/login";
                      }
                    }}
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}