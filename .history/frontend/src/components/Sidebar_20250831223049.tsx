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
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  
  // 状态管理
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebarOpen");
      // 电脑端默认展开，移动端默认收起
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        return saved === null ? true : saved === "true";
      }
      return saved === null ? false : saved === "true";
    } catch (e) {
      console.error("读取localStorage失败:", e);
      return true; // 出错时默认展开
    }
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
  
  // 设备状态
  const [isMobile, setIsMobile] = useState(false);

  // 显示提示消息
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  // 切换侧边栏展开/收起 - 添加调试日志
  const toggleSidebar = useCallback(() => {
    console.log("尝试切换侧边栏状态，当前状态:", isOpen);
    const newState = !isOpen;
    setIsOpen(newState);
    try {
      localStorage.setItem("sidebarOpen", String(newState));
      console.log("已更新localStorage，新状态:", newState);
    } catch (e) {
      console.error("更新localStorage失败:", e);
    }
  }, [isOpen]);

  // 检测设备类型和屏幕尺寸
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // 电脑端始终可以展开，移动端默认收起
      if (!mobile && localStorage.getItem("sidebarOpen") === null) {
        setIsOpen(true);
      }
    };

    checkDevice();
    const resizeHandler = () => checkDevice();
    window.addEventListener('resize', resizeHandler);
    
    // 初始检查按钮是否存在
    if (toggleButtonRef.current) {
      console.log("展开按钮已加载到DOM中");
    } else {
      console.log("展开按钮尚未加载到DOM中");
    }
    
    return () => window.removeEventListener('resize', resizeHandler);
  }, []);

  // 确保按钮可点击的关键修复
  useEffect(() => {
    if (toggleButtonRef.current) {
      // 强制设置按钮样式，确保可点击
      toggleButtonRef.current.style.pointerEvents = 'auto';
      toggleButtonRef.current.style.zIndex = '1000';
      toggleButtonRef.current.style.display = 'flex';
      
      // 添加点击事件监听器（直接绑定到DOM，绕过React事件系统）
      const handleNativeClick = () => {
        console.log("原生点击事件触发");
        toggleSidebar();
      };
      
      toggleButtonRef.current.addEventListener('click', handleNativeClick);
      
      return () => {
        toggleButtonRef.current?.removeEventListener('click', handleNativeClick);
      };
    }
  }, [toggleSidebar]);

  // 触摸滑动支持（仅移动端）
  const [touchStart, setTouchStart] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - touchStart;
    
    if (!isOpen && diff > 50) {
      toggleSidebar();
    }
    
    if (isOpen && diff < -50) {
      toggleSidebar();
    }
    
    setIsDragging(false);
  };

  // 其他方法保持不变...
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

  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    onSelect(c);
    navigate(`/core/${c.id}`);
    
    if (isMobile) {
      setIsOpen(false);
      localStorage.setItem("sidebarOpen", "false");
    }
  };

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

  const filteredConversations = Array.isArray(state.conversations)
    ? state.conversations.filter((c) =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

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
        className={`absolute top-0 left-0 bottom-0 bg-gray-50 border-r border-gray-200 
          transition-all duration-300 ease-in-out flex flex-col z-20
          ${isOpen ? 'w-[260px]' : 'w-0 overflow-hidden'}`}
        style={{
          // 强制设置样式，确保过渡效果正常
          transitionProperty: 'width',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionDuration: '300ms',
        }}
      >
        {/* 侧边栏头部 */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center rounded-full 
              hover:bg-gray-200 transition-colors text-gray-600"
            title="收起侧边栏"
          >
            ◀
          </button>
        </div>

        {/* 搜索框、按钮和列表内容保持不变 */}
        <div className="p-3">
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="px-3">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm 
              transition-all active:scale-[0.98]"
            onClick={newConv}
            disabled={loading}
          >
            {loading ? "创建中..." : "➕ 新建对话"}
          </Button>
        </div>

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
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded 
                          focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          aria-label="编辑对话标题"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                          className="text-red-500 hover:text-red-700 text-xs p-1 rounded hover:bg-gray-100"
                          aria-label="删除对话"
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

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => navigate("/home")}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            ← 返回主页
          </button>
        </div>
      </div>

      {/* 展开按钮 - 关键修复 */}
      {!isOpen && (
        <button
          ref={toggleButtonRef}
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center
            bg-blue-600 text-white rounded-r-full shadow-lg hover:bg-blue-700 transition-all z-1000"
          title="展开侧边栏"
          aria-label="展开侧边栏"
          style={{
            // 强制设置按钮可见且可点击
            display: 'flex !important',
            pointerEvents: 'auto !important',
            zIndex: 1000,
          }}
        >
          ➡
        </button>
      )}

      {/* 移动设备遮罩层 */}
      {isOpen && isMobile && (
        <div
          className="absolute inset-0 bg-black bg-opacity-30 z-10"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* 主内容区域占位 */}
      <div className={`transition-all duration-300 ${isOpen ? 'ml-[260px]' : 'ml-0'} flex-1`}>
        {/* 主内容区域 */}
      </div>

      {/* Toast通知组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      <style>
        {`
          .animate-pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          /* 确保没有全局样式影响按钮 */
          [aria-label="展开侧边栏"] {
            all: unset !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            width: 40px !important;
            height: 40px !important;
            background-color: #2563eb !important;
            color: white !important;
            border-radius: 0 50% 50% 0 !important;
            cursor: pointer !important;
            position: absolute !important;
            left: 0 !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 1000 !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
          }

          [aria-label="展开侧边栏"]:hover {
            background-color: #1d4ed8 !important;
          }
        `}
      </style>
    </div>
  );
}
    