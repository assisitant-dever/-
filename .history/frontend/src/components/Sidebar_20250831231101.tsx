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
  const toggleButtonRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', type: 'info' });

  // 统一的切换函数 - 控制所有状态变化
  const toggleSidebar = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  // 检测设备类型
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isOpen) setIsOpen(false);
    };
    checkDevice();
    const resizeHandler = () => checkDevice();
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [isOpen]);

  // 绑定按钮点击事件
  useEffect(() => {
    if (toggleButtonRef.current) {
      const button = toggleButtonRef.current;
      
      const handleClick = () => toggleSidebar();
      button.addEventListener('click', handleClick);
      
      return () => button.removeEventListener('click', handleClick);
    }
  }, [toggleSidebar]);

  // 功能方法保持不变
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

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
    if (isMobile) setIsOpen(false);
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
    <div className="h-full flex overflow-hidden relative">
      {/* 侧边栏主体 - 平滑动画效果 */}
      <div
        ref={sidebarRef}
        className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-500 ease-in-out ${
          isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0'
        }`}
        style={{
          transformOrigin: 'left center',
          transitionProperty: 'width, opacity, transform',
          transform: isOpen ? 'scaleX(1)' : 'scaleX(0.5) translateX(-50%)',
        }}
      >
        {/* 侧边栏头部 - 移除了内部收起按钮，保持界面简洁 */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          
          {/* 这里移除了原来的内部收起按钮，统一使用外部按钮控制 */}
          <div className="w-8 h-8"></div> {/* 保持布局空间，避免标题偏移 */}
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm"
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
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
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
                      <div className="flex gap-1 opacity-0 hover:opacity-100">
                        <div
                          onClick={(e) => startEdit(e, c)}
                          className="text-gray-500 hover:text-gray-700 text-xs p-1 cursor-pointer"
                          aria-label="编辑"
                        >
                          ✏️
                        </div>
                        <div
                          onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                          className="text-red-500 hover:text-red-700 text-xs p-1 cursor-pointer"
                          aria-label="删除"
                          disabled={loading}
                        >
                          {loading ? "..." : "✖"}
                        </div>
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
          <div
            onClick={() => navigate("/home")}
            className="text-xs text-blue-600 hover:underline cursor-pointer"
          >
            ← 返回主页
          </div>
        </div>
      </div>

      {/* 统一的外部切换按钮 - 同时负责展开和收起 */}
      <div
        ref={toggleButtonRef}
        className="sidebar-toggle-button"
        title={isOpen ? "收起侧边栏" : "展开侧边栏"}
        aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
        style={{
          // 按钮随侧边栏状态平滑移动
          left: isOpen ? '260px' : '0',
          opacity: isOpen ? '0.9' : '1',
          transform: isOpen ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(1.05)',
        }}
      >
        <span className="toggle-icon" style={{
          // 图标随状态旋转，提供清晰反馈
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
        }}>
          {isOpen ? '◀' : '▶'}
        </span>
      </div>

      {/* 主内容区域 - 同步过渡 */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'ml-[260px]' : 'ml-0'} flex-1`}></div>

      {/* Toast组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 样式定义 */}
      <style>
        {`
          /* 统一的切换按钮样式 */
          .sidebar-toggle-button {
            position: fixed !important;
            top: 50% !important;
            width: 40px !important;
            height: 100px !important;
            background-color: #2563eb !important;
            border: none !important;
            border-radius: 0 12px 12px 0 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            cursor: pointer !important;
            z-index: 9998 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          }
          
          .sidebar-toggle-button:hover {
            background-color: #1d4ed8 !important;
            width: 45px !important;
          }
          
          /* 按钮图标样式 */
          .toggle-icon {
            color: white !important;
            font-size: 20px !important;
            transition: transform 0.5s ease !important;
            font-weight: bold !important;
          }
          
          /* 骨架屏动画 */
          .animate-pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}
    