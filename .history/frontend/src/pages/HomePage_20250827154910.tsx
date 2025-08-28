import { useEffect, useState, useRef } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ApiKeyManager from "../components/ApiKeyManager";

// 新增：自定义确认弹窗组件（支持基于触发元素定位）
const CustomConfirmModal = ({
  isOpen,
  title,
  content,
  onConfirm,
  onCancel,
  triggerRect // 触发元素的坐标信息
}: {
  isOpen: boolean;
  title: string;
  content: string;
  onConfirm: () => void;
  onCancel: () => void;
  triggerRect?: DOMRect | null;
}) => {
  if (!isOpen) return null;

  // 计算弹窗位置：基于触发元素右下方，距离10px，避免超出视口
  const calculateModalPosition = () => {
    if (!triggerRect) {
      // 无触发元素信息时，默认居中（降级处理）
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    const modalWidth = 360; // 弹窗宽度（固定，可根据需求调整）
    const modalHeight = 180; // 弹窗高度（固定）
    const offset = 10; // 弹窗与触发元素的间距

    // 基础位置：触发元素右下角 + 10px 偏移
    let top = triggerRect.bottom + offset;
    let left = triggerRect.left;

    // 避免弹窗超出视口右侧
    const viewportWidth = window.innerWidth;
    if (left + modalWidth > viewportWidth) {
      left = viewportWidth - modalWidth - 20; // 右移至视口内，留20px边距
    }

    // 避免弹窗超出视口底部（如需滚动，可调整为固定定位+滚动跟随）
    const viewportHeight = window.innerHeight;
    if (top + modalHeight > viewportHeight) {
      // 底部超出时，改为在触发元素上方显示
      top = triggerRect.top - modalHeight - offset;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: "none", // 取消居中偏移
      position: "fixed" // 固定定位，避免随页面滚动偏移
    };
  };

  const modalStyle = calculateModalPosition();

  return (
    // 半透明背景层（全屏）
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start"
      }}
      onClick={onCancel} // 点击背景关闭弹窗
    >
      {/* 弹窗主体（基于触发元素定位） */}
      <div
        style={{
          ...modalStyle,
          width: "360px",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          padding: "20px",
          zIndex: 1001,
          cursor: "default" // 取消鼠标指针变化
        }}
        onClick={(e) => e.stopPropagation()} // 阻止事件冒泡到背景层
      >
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#1f2937" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6b7280" }}>{content}</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              color: "#6b7280",
              backgroundColor: "white",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#f9fafb"}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "white"}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 16px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              color: "white",
              backgroundColor: "#dc2626",
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#b91c1c"}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#dc2626"}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [documents, setDocuments] = useState<Array<{
    id: number;
    filename: string;
    doc_type: string;
    used_template: string | null;
    created_at: string;
    content_preview: string;
  }>>([]); 
  const [selectedTab, setSelectedTab] = useState<"docs" | "templates" | "profile" | "api-keys">("docs");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const { state, dispatch } = useApp();

  // ---------------------- 新增：弹窗相关状态 ----------------------
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "delete-doc" as "delete-doc" | "delete-template", // 弹窗类型（公文删除/模板删除）
    data: null as { id: number; name: string; triggerRect: DOMRect | null } | null // 弹窗关联数据（含触发元素坐标）
  });

  // 用于存储模板查看弹窗的引用（方便定位）
  const templateModalRef = useRef<Window | null>(null);

  interface Template {
    id: number;
    filename: string;
    original_name: string;
    uploaded_at: string;
    content_preview: string;
  }
  const [templates, setTemplates] = useState<Template[]>([]);


  // 获取历史公文（未修改）
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get("/api/history");
      // 正确：提取响应中的 data 字段（数组），若不存在则设为空数组（兼容异常情况）
      const documentList = res.data?.data || []; 
      setDocuments(documentList as Array<{
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

  // 下载公文（未修改）
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

  // ---------------------- 优化：历史公文删除（使用自定义弹窗） ----------------------
  const handleDeleteDocClick = (e: React.MouseEvent<HTMLButtonElement>, docId: number, filename: string) => {
    // 获取触发按钮的坐标信息（关键：用于弹窗定位）
    const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
    
    // 打开自定义确认弹窗
    setConfirmModal({
      isOpen: true,
      type: "delete-doc",
      data: { id: docId, name: filename, triggerRect }
    });
  };

  // 确认删除公文（弹窗确认后的实际删除逻辑）
  const confirmDeleteDoc = async () => {
    if (!confirmModal.data) return;
    const { id: docId, name: filename } = confirmModal.data;

    // 标记删除状态
    setDeletingDocId(docId);
    // 关闭弹窗
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      await api.delete(`/api/history/${docId}`);
      // 同步前端状态
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      toast.success(`公文「${filename}」删除成功`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "删除失败，请重试";
      console.error("删除历史公文失败:", errorMsg);
      toast.error(`删除失败：${errorMsg}`);
    } finally {
      setDeletingDocId(null);
    }
  };

  // ---------------------- 优化：模板删除（使用自定义弹窗） ----------------------
  const handleDeleteTemplateClick = (e: React.MouseEvent<HTMLButtonElement>, templateId: number, templateName: string) => {
    // 获取触发按钮的坐标信息
    const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
    
    // 打开自定义确认弹窗
    setConfirmModal({
      isOpen: true,
      type: "delete-template",
      data: { id: templateId, name: templateName, triggerRect }
    });
  };

  // 确认删除模板（弹窗确认后的实际删除逻辑）
  const confirmDeleteTemplate = async () => {
    if (!confirmModal.data) return;
    const { id: templateId, name: templateName } = confirmModal.data;

    // 关闭弹窗
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      await api.delete(`/api/templates/${templateId}`);
      // 同步前端状态
      setTemplates(prevTemplates => prevTemplates.filter(tpl => tpl.id !== templateId));
      toast.success(`模板「${templateName}」删除成功`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "删除失败，请重试";
      console.error("删除模板失败:", errorMsg);
      toast.error(`删除失败：${errorMsg}`);
    }
  };

  // 模板相关功能（优化：模板预览弹窗定位）
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

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  // ---------------------- 优化：模板预览弹窗（基于触发按钮定位） ----------------------
  const viewTemplateContent = async (e: React.MouseEvent<HTMLButtonElement>, templateId: number) => {
    try {
      const res = await api.get(`/api/template-content/${templateId}`);
      const content = res.data.content;
      const template = templates.find(t => t.id === templateId);
      const templateName = template?.original_name || "模板内容预览";

      // 获取触发按钮的坐标信息
      const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
      // 计算弹窗位置：触发按钮右下方，距离10px，宽800px，高600px
      const modalWidth = 800;
      const modalHeight = 600;
      const offset = 10;

      // 基础位置：触发元素右下角 + 10px 偏移
      let left = triggerRect.right + offset;
      let top = triggerRect.top;

      // 避免弹窗超出视口右侧（超出则改为左侧显示）
      const viewportWidth = window.innerWidth;
      if (left + modalWidth > viewportWidth) {
        left = triggerRect.left - modalWidth - offset;
      }

      // 避免弹窗超出视口底部（超出则置顶显示）
      const viewportHeight = window.innerHeight;
      if (top + modalHeight > viewportHeight) {
        top = 20; // 顶部留20px边距
      }

      // 打开预览弹窗并定位
      const modal = window.open(
        "", 
        "_blank", 
        `width=${modalWidth},height=${modalHeight},left=${Math.max(0, left)},top=${Math.max(0, top)}`
      );
      templateModalRef.current = modal;

      if (modal) {
        modal.document.write(`
          <html>
            <head>
              <title>${templateName}</title>
              <style>
                body { padding: 20px; font-family: sans-serif; line-height: 1.6; margin: 0; }
                h1 { color: #1e40af; margin: 0 0 20px; font-size: 18px; }
                .content { white-space: pre-wrap; word-break: break-all; font-size: 14px; color: #374151; }
                .close-btn { 
                  position: fixed; top: 10px; right: 10px; 
                  padding: 4px 8px; border: none; border-radius: 4px;
                  background: #dc2626; color: white; cursor: pointer;
                }
              </style>
            </head>
            <body>
              <button class="close-btn" onclick="window.close()">× 关闭</button>
              <h1>${templateName}</h1>
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

  // 初始化加载数据（未修改）
  useEffect(() => {
    fetchDocuments();
    fetchTemplates();

    // 组件卸载时关闭模板预览弹窗
    return () => {
      if (templateModalRef.current) {
        templateModalRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar onSelect={() => {}} />

      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-300">
          个人主页
        </h1>

        {/* Tab 切换（未修改） */}
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
          {/* 历史公文（使用自定义删除弹窗） */}
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
                          <td className="px-4 py-3 whitespace-nowrap flex gap-3">
                            <button
                              onClick={() => downloadDocument(doc.filename)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                              disabled={deletingDocId === doc.id}
                            >
                              下载
                            </button>
                            {/* 优化：点击删除按钮时传递事件对象，用于获取坐标 */}
                            <button
                              onClick={(e) => handleDeleteDocClick(e, doc.id, doc.filename)}
                              className={`text-sm transition-colors ${
                                deletingDocId === doc.id 
                                  ? "text-slate-400 cursor-not-allowed" 
                                  : "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              }`}
                              disabled={deletingDocId === doc.id}
                            >
                              {deletingDocId === doc.id ? "删除中..." : "删除"}
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

          {/* 模板管理（使用自定义删除弹窗 + 优化预览弹窗） */}
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
                      {/* 优化：点击删除按钮时传递事件对象，用于获取坐标 */}
                      <button
                        onClick={(e) => handleDeleteTemplateClick(e, template.id, template.original_name)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        style={{ padding: "2px 4px" }}
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
                    {/* 优化：点击查看按钮时传递事件对象，用于获取坐标 */}
                    <button
                      onClick={(e) => viewTemplateContent(e, template.id)}
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

          {/* API Keys 管理（未修改） */}
          {selectedTab === "api-keys" && (
            <ApiKeyManager 
              onConfigChange={() => {
                toast.success("API 配置已更新");
                console.log("API 配置已更新");
              }}
            /> 
          )}

          {/* 个人信息（未修改） */}
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

      {/* ---------------------- 新增：自定义确认弹窗（全局唯一） ---------------------- */}
      <CustomConfirmModal
        isOpen={confirmModal.isOpen}
        title={
          confirmModal.type === "delete-doc" 
            ? "确认删除公文" 
            : "确认删除模板"
        }
        content={
          confirmModal.type === "delete-doc" 
            ? `确认删除历史公文「${confirmModal.data?.name}」？\n删除后文件将无法恢复，且关联记录会同步删除`
            : `确认删除模板「${confirmModal.data?.name}」？\n删除后所有使用该模板的公文生成将受影响，且无法恢复`
        }
        onConfirm={
          confirmModal.type === "delete-doc" 
            ? confirmDeleteDoc 
            : confirmDeleteTemplate
        }
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        triggerRect={confirmModal.data?.triggerRect || null}
      />

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