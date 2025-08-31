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
  const headerRef = useRef<HTMLDivElement>(null);
  
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

  // 切换侧边栏状态
  const toggleSidebar = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  // 实时计算按钮位置，解决F12调试时的失位问题
  useEffect(() => {
    const updateButtonPosition = () => {
      if (toggleButtonRef.current && headerRef.current && sidebarRef.current) {
        const headerRect = headerRef.current.getBoundingClientRect();
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        
        // 计算相对于视口的精确位置
        const buttonStyle = toggleButtonRef.current.style;
        
        if (isOpen) {
          // 展开状态：定位在头部右侧中间
          buttonStyle.left = `${sidebarRect.left + sidebarRect.width - 32}px`;
          buttonStyle.top = `${headerRect.top + headerRect.height / 2}px`;
          buttonStyle.transform = 'translate(-50%, -50%)';
        } else {
          // 收起状态：定位在左侧中间
          buttonStyle.left = '0';
          buttonStyle.top = '50%';
          buttonStyle.transform = 'translateY(-50%)';
        }
      }
    };

    // 初始化位置
    updateButtonPosition();
    
    // 监听窗口变化和侧边栏状态变化，实时更新位置
    const handleResize = () => {
      updateButtonPosition();
    };
    
    window.addEventListener('resize', handleResize);
    const sidebarObserver = new ResizeObserver(entries => {
      updateButtonPosition();
    });
    
    if (sidebarRef.current) {
      sidebarObserver.observe(sidebarRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      sidebarObserver.disconnect();
    };
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

  // 功能方法
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
    <div className="h-full flex overflow-hidden relative box-sizing: border-box;">
      {/* 侧边栏主体 - 解决空间占用问题 */}
      <div
        ref={sidebarRef}
        className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-500 ease-in-out ${
          isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0'
        }`}
        style={{
          // 关键修复：使用transform代替width变化来减少回流
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          position: 'relative',
          flexShrink: 0, // 防止被压缩
          boxSizing: 'border-box', // 确保padding不增加总宽度
          overflow: 'hidden', // 防止内容溢出
        }}
      >
        {/* 侧边栏头部 */}
        <div ref={headerRef} className="p-3 border-b border-gray-200 flex items-center justify-between h-12 box-sizing: border-box;">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          <div className="w-8 h-8"></div>
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

      {/* 智能切换按钮 - 解决F12调试失位问题 */}
      <div
        ref={toggleButtonRef}
        className="sidebar-toggle-button"
        title={isOpen ? "收起侧边栏" : "展开侧边栏"}
        aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
        style={{
          // 基础样式
          width: isOpen ? '32px' : '40px',
          height: isOpen ? '32px' : '100px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: isOpen ? '6px' : '0 12px 12px 0',
          boxShadow: isOpen ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 9998,
          position: 'fixed', // 使用fixed确保在视口中的位置稳定
          boxSizing: 'border-box', // 确保尺寸计算正确
        }}
      >
        <span className="toggle-icon" style={{
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          fontSize: isOpen ? '16px' : '20px',
          transition: 'transform 0.5s ease',
        }}>
          {isOpen ? '◀' : '◀'}
        </span>
      </div>

      {/* 主内容区域 - 解决空间占用问题 */}
      <div 
        className={`transition-all duration-500 ease-in-out flex-1`}
        style={{
          marginLeft: isOpen ? '260px' : '0',
          boxSizing: 'border-box',
        }}
      ></div>

      {/* Toast组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 全局样式修复 */}
      <style jsx global>{`
        /* 确保所有元素使用border-box计算尺寸 */
        * {
          box-sizing: border-box !important;
        }
        
        .sidebar-toggle-button:hover {
          background-color: #1d4ed8 !important;
        }
        
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* 防止滚动条导致的布局偏移 */
        html {
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
}
    