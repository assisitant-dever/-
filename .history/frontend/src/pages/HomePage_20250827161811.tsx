import { useEffect, useState, useRef } from "react";
import api from "../api";
import Sidebar from "../components/Sidebar";
import { saveAs } from "file-saver";
import { useApp } from "../store/app";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ApiKeyManager from "../components/ApiKeyManager";

// 通用分页组件
interface PaginationProps {
  currentPage: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const Pagination = ({ 
  currentPage, 
  total, 
  pageSize, 
  onPageChange,
  onPageSizeChange
}: PaginationProps) => {
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
      <div className="text-sm text-slate-500">
        共 {total} 条，{totalPages} 页，当前第 {currentPage} 页
      </div>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm">每页显示：</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={5}>5条</option>
              <option value={10}>10条</option>
              <option value={20}>20条</option>
              <option value={50}>50条</option>
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <button
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

// 自定义确认弹窗组件（支持基于触发元素定位）
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
  
  // 分页状态 - 模板
  const [templatePage, setTemplatePage] = useState(1);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatePageSize, setTemplatePageSize] = useState(10);
  
  // 分页状态 - 公文
  const [docPage, setDocPage] = useState(1);
  const [docTotal, setDocTotal] = useState(0);
  const [docPageSize, setDocPageSize] = useState(10);

  // 弹窗相关状态
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "delete-doc" as "delete-doc" | "delete-template",
    data: null as { id: number; name: string; triggerRect: DOMRect | null } | null
  });

  // 模板查看弹窗引用
  const templateModalRef = useRef<Window | null>(null);

  interface Template {
    id: number;
    filename: string;
    original_name: string;
    uploaded_at: string;
    content_preview: string;
  }
  const [templates, setTemplates] = useState<Template[]>([]);


  // 获取历史公文（带分页）
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await api.get(`/api/history?page=${docPage}&page_size=${docPageSize}`);
      // 强化数组类型校验
      let documentList = [];
      // 情况1：后端直接返回数组
      if (Array.isArray(res.data)) {
        documentList = res.data;
        setDocTotal(res.data.length);
      }
      // 情况2：后端返回分页结构 { items: [], total: number }
      else if (res.data?.items && Array.isArray(res.data.items)) {
        documentList = res.data.items;
        setDocTotal(res.data.total || 0);
      }
      // 情况3：后端返回包裹在data字段中的分页结构
      else if (res.data?.data?.items && Array.isArray(res.data.data.items)) {
        documentList = res.data.data.items;
        setDocTotal(res.data.data.total || 0);
      }
      // 其他情况
      else {
        documentList = [];
        setDocTotal(0);
        console.warn("后端返回的历史公文数据格式不符合预期");
      }
      // 类型断言
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
      setDocuments([]);
      setDocTotal(0);
    } finally {
      setLoadingDocs(false);
    }
  };

  // 下载公文
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

  // 历史公文删除点击事件
  const handleDeleteDocClick = (e: React.MouseEvent<HTMLButtonElement>, docId: number, filename: string) => {
    const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
    setConfirmModal({
      isOpen: true,
      type: "delete-doc",
      data: { id: docId, name: filename, triggerRect }
    });
  };

  // 确认删除公文
  const confirmDeleteDoc = async () => {
    if (!confirmModal.data) return;
    const { id: docId, name: filename } = confirmModal.data;

    setDeletingDocId(docId);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      await api.delete(`/api/history/${docId}`);
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      setDocTotal(prev => Math.max(0, prev - 1));
      toast.success(`公文「${filename}」删除成功`);
      
      // 如果当前页数据为空，自动跳转到上一页
      if (documents.filter(doc => doc.id !== docId).length === 0 && docPage > 1) {
        setDocPage(prev => prev - 1);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "删除失败，请重试";
      console.error("删除历史公文失败:", errorMsg);
      toast.error(`删除失败：${errorMsg}`);
    } finally {
      setDeletingDocId(null);
    }
  };

  // 模板删除点击事件
  const handleDeleteTemplateClick = (e: React.MouseEvent<HTMLButtonElement>, templateId: number, templateName: string) => {
    const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
    setConfirmModal({
      isOpen: true,
      type: "delete-template",
      data: { id: templateId, name: templateName, triggerRect }
    });
  };

  // 确认删除模板
  const confirmDeleteTemplate = async () => {
    if (!confirmModal.data) return;
    const { id: templateId, name: templateName } = confirmModal.data;

    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      await api.delete(`/api/templates/${templateId}`);
      setTemplates(prevTemplates => prevTemplates.filter(tpl => tpl.id !== templateId));
      setTemplateTotal(prev => Math.max(0, prev - 1));
      toast.success(`模板「${templateName}」删除成功`);
      
      // 如果当前页数据为空，自动跳转到上一页
      if (templates.filter(tpl => tpl.id !== templateId).length === 0 && templatePage > 1) {
        setTemplatePage(prev => prev - 1);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "删除失败，请重试";
      console.error("删除模板失败:", errorMsg);
      toast.error(`删除失败：${errorMsg}`);
    }
  };

  // 获取模板列表（带分页）
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get(`/api/templates?page=${templatePage}&page_size=${templatePageSize}`);
      if (res.data?.items && Array.isArray(res.data.items)) {
        setTemplates(res.data.items as Template[]);
        setTemplateTotal(res.data.total || 0);
      } else {
        setTemplates([]);
        setTemplateTotal(0);
        console.warn("后端返回的模板数据格式不符合预期");
      }
    } catch (err) {
      console.error("获取模板列表失败:", err);
      toast.error("获取模板列表失败");
      setTemplates([]);
      setTemplateTotal(0);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 上传模板
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
      // 上传成功后刷新当前页数据
      fetchTemplates();
      toast.success("模板上传成功");
    } catch (err) {
      console.error("上传模板失败", err);
      toast.error("上传模板失败：服务器错误或文件过大");
    }
  };

  // 查看模板内容
  const viewTemplateContent = async (e: React.MouseEvent<HTMLButtonElement>, templateId: number) => {
    try {
      const res = await api.get(`/api/template-content/${templateId}`);
      const content = res.data.content;
      const template = templates.find(t => t.id === templateId);
      const templateName = template?.original_name || "模板内容预览";

      const triggerRect = (e.target as HTMLButtonElement).getBoundingClientRect();
      const modalWidth = 800;
      const modalHeight = 600;
      const offset = 10;

      let left = triggerRect.right + offset;
      let top = triggerRect.top;

      const viewportWidth = window.innerWidth;
      if (left + modalWidth > viewportWidth) {
        left = triggerRect.left - modalWidth - offset;
      }

      const viewportHeight = window.innerHeight;
      if (top + modalHeight > viewportHeight) {
        top = 20;
      }

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

  // 初始化加载数据及分页变化时重新加载
  useEffect(() => {
    fetchDocuments();
  }, [docPage, docPageSize]);

  useEffect(() => {
    fetchTemplates();
  }, [templatePage, templatePageSize]);

  // 组件卸载时关闭模板预览弹窗
  useEffect(() => {
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
          {/* 历史公文 */}
          {selectedTab === "docs" && (
            <>
              {loadingDocs ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-slate-500">加载历史公文中...</p>
                </div>
              ) : !Array.isArray(documents) ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <p>数据加载异常，请刷新页面重试</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <p>暂无历史公文记录</p>
                  <p className="text-sm mt-2">可前往公文生成页面创建新公文</p>
                </div>
              ) : (
                <>
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
                  
                  {/* 公文列表分页 */}
                  <Pagination
                    currentPage={docPage}
                    total={docTotal}
                    pageSize={docPageSize}
                    onPageChange={setDocPage}
                    onPageSizeChange={setDocPageSize}
                  />
                </>
              )}
            </>
          )}

          {/* 模板管理 */}
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
              <>
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
                      <button
                        onClick={(e) => viewTemplateContent(e, template.id)}
                        className="w-full py-1.5 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        查看完整内容
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* 模板列表分页 */}
                <Pagination
                  currentPage={templatePage}
                  total={templateTotal}
                  pageSize={templatePageSize}
                  onPageChange={setTemplatePage}
                  onPageSizeChange={setTemplatePageSize}
                />
              </>
            )}
          </>
        )}

          {/* API Keys 管理 */}
          {selectedTab === "api-keys" && (
            <ApiKeyManager 
              onConfigChange={() => {
                toast.success("API 配置已更新");
                console.log("API 配置已更新");
              }}
            /> 
          )}

          {/* 个人信息 */}
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

      {/* 自定义确认弹窗 */}
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