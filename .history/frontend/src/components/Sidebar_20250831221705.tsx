import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import Toast from "./Toast";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved === null ? true : saved === "true";
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'info' });
  
  // 滑动相关状态
  const [touchStart, setTouchStart] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 显示提示消息
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  // 切换侧边栏展开/收起
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    localStorage.setItem("sidebarOpen", String(!isOpen));
  };

  // 检测设备类型和屏幕尺寸
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // 移动设备默认收起侧边栏
      if (mobile && isOpen) {
        setIsOpen(false);
        localStorage.setItem("sidebarOpen", "false");
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [isOpen]);

  // 滑动开始处理
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  // 滑动结束处理
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - touchStart;
    
    // 从左向右滑动超过50px且侧边栏收起时，展开侧边栏
    if (!isOpen && diff > 50) {
      toggleSidebar();
    }
    
    // 从右向左滑动超过50px且侧边栏展开时，收起侧边栏
    if (isOpen && diff < -50) {
      toggleSidebar();
    }
    
    setIsDragging(false);
  };

  // 获取对话列表
  const fetchConvs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
    } catch (err) {
      console.error("获取对话列表失败:", err);
      showToast("获取对话列表失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 新建对话
  const newConv = async () => {
    setLoading(true);
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      const newConversation = res.data;

      const updatedConvs = Array.isArray(state.conversations)
        ? [...state.conversations, newConversation]
        : [newConversation];

      dispatch({ type: "SET_CONVS", payload: updatedConvs });
      dispatch({ type: "SET_CURRENT_CONV", payload: newConversation });
      
      navigate(`/core/${newConversation.id}`);
      onSelect(newConversation);
      showToast("新建对话成功", "success");
    } catch (err) {
      console.error("新建对话失败", err);
      showToast("新建对话失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 删除对话
  const deleteConv = async (id: number) => {
    if (!window.confirm("确定要删除这个对话吗？")) return;
    
    setLoading(true);
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs();
      showToast("对话已删除", "success");
      
      if (state.currentConv?.id === id) {
        navigate("/home");
        onSelect(null);
      }
    } catch (err) {
      console.error("删除对话失败:", err);
      showToast("删除对话失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 选择对话
  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    onSelect(c);
    navigate(`/core/${c.id}`);
    
    // 移动设备上选择对话后自动收起侧边栏
    if (isMobile) {
      setIsOpen(false);
      localStorage.setItem("sidebarOpen", "false");
    }
  };

  // 编辑标题相关方法
  const startEdit = (e: React.MouseEvent, c: any) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    setLoading(true);
    try {
      await api.patch(`/api/conversations/${editingId}`, { title: editTitle.trim() });
      fetchConvs();
      setEditingId(null);
      showToast("标题已更新", "success");
    } catch (err) {
      console.error("更新标题失败:", err);
      showToast("保存失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 过滤对话列表
  const filteredConversations = Array.isArray(state.conversations)
    ? state.conversations.filter((c) =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // 初始加载对话列表
  useEffect(() => {
    fetchConvs();
  }, []);

  return (
    <div 
      ref={sidebarRef}
      className="h-full flex overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 侧边栏主体 */}
      <div
        className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'w-[260px]' : 'w-0'
        }`}
      >
        {/* 侧边栏头部 */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600"
            title="收起侧边栏"
          >
            ◀
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-3">
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 新建对话按钮 */}
        <div className="px-3">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm transition-all active:scale-[0.98]"
            onClick={newConv}
            disabled={loading}
          >
            {loading ? "创建中..." : "➕ 新建对话"}
          </Button>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="space-y-1">
              {filteredConversations.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded-md cursor-pointer text-sm break-words transition-all duration-200
                    ${c.id === state.currentConv?.id
                      ? "bg-blue-50 border-l-2 border-blue-500"
                      : "bg-white hover:bg-gray-100"
                    }`}
                  onClick={() => handleSelect(c)}
                >
                  {editingId === c.id ? (
                    <div onClick={(e) => e.stopPropagation()} className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        onBlur={saveEdit}
                        onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                      />
                      <button
                        onClick={saveEdit}
                        className="text-green-600 hover:text-green-700 text-xs px-1"
                        disabled={loading}
                      >
                        {loading ? "..." : "✓"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span
                        className="truncate max-w-[160px]"
                        onDoubleClick={(e) => startEdit(e, c)}
                        title={c.title}
                      >
                        {c.title}
                      </span>
                      <div className="flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startEdit(e, c)}
                          className="text-gray-500 hover:text-gray-700 text-xs p-1 rounded hover:bg-gray-100"
                          aria-label="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                          className="text-red-500 hover:text-red-700 text-xs p-1 rounded hover:bg-gray-100"
                          aria-label="删除"
                          disabled={loading}
                        >
                          {loading ? "..." : "✖"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 py-4 text-center">
              暂无匹配对话
            </p>
          )}
        </div>

        {/* 底部链接 */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => navigate("/home")}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            ← 返回主页
          </button>
        </div>
      </div>

      {/* 收起状态时的展开按钮 - 仅在左侧中间显示一个 */}
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-r-full shadow-md hover:bg-blue-700 transition-all z-10"
          title="展开侧边栏"
        >
          ➡
        </button>
      )}

      {/* 遮罩层 - 仅在移动设备侧边栏展开时显示 */}
      {isOpen && isMobile && (
        <div
          className="absolute inset-0 bg-black bg-opacity-30 z-10"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Toast通知组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 全局样式 */}
      <style>
        {`
          .animate-pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          /* 禁止选择文本，优化触摸体验 */
          .no-select {
            user-select: none;
            -webkit-user-select: none;
          }
        `}
      </style>
    </div>
  );
}
    