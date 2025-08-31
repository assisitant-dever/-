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

  // 切换侧边栏展开/收起（核心方法，确保状态稳定切换）
  const toggleSidebar = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem("sidebarOpen", String(newState));
  }, [isOpen]);

  // 检测设备类型和屏幕尺寸（响应式适配）
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // 移动设备默认收起侧边栏，避免遮挡内容
      if (mobile && isOpen) {
        setIsOpen(false);
        localStorage.setItem("sidebarOpen", "false");
      }
    };

    checkDevice();
    const resizeHandler = () => checkDevice();
    window.addEventListener('resize', resizeHandler);
    
    // 清理监听
    return () => window.removeEventListener('resize', resizeHandler);
  }, [isOpen]);

  // 触摸滑动：开始滑动时记录初始位置
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  // 触摸滑动：结束滑动时判断方向和距离
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - touchStart;
    
    // 从左向右滑动超过50px → 展开侧边栏
    if (!isOpen && diff > 50) {
      toggleSidebar();
    }
    
    // 从右向左滑动超过50px → 收起侧边栏
    if (isOpen && diff < -50) {
      toggleSidebar();
    }
    
    setIsDragging(false);
  };

  // 确保展开按钮始终可点击（修复遮挡问题）
  useEffect(() => {
    if (toggleButtonRef.current) {
      toggleButtonRef.current.style.pointerEvents = 'auto';
      toggleButtonRef.current.style.zIndex = '100'; // 强制置顶，避免被其他元素遮挡
    }
  }, [isOpen]);

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
      
      // 若删除当前对话，跳转回主页
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

  // 选择对话（切换当前对话并跳转）
  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    onSelect(c);
    navigate(`/core/${c.id}`);
    
    // 移动设备选择后自动收起侧边栏，优化体验
    if (isMobile) {
      setIsOpen(false);
      localStorage.setItem("sidebarOpen", "false");
    }
  };

  // 开始编辑对话标题
  const startEdit = (e: React.MouseEvent, c: any) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发对话选择
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  // 保存编辑后的标题
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

  // 过滤对话列表（根据搜索关键词）
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
      {/* 1. 侧边栏主体（绝对定位确保层级正确） */}
      <div
        className={`absolute top-0 left-0 bottom-0 bg-gray-50 border-r border-gray-200 
          transition-all duration-300 ease-in-out flex flex-col z-20
          ${isOpen ? 'w-[260px]' : 'w-0 overflow-hidden'}`}
      >
        {/* 侧边栏头部（标题 + 收起按钮） */}
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

        {/* 搜索框 */}
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

        {/* 新建对话按钮 */}
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

        {/* 对话列表（带加载骨架屏） */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            // 加载状态：骨架屏
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            // 有对话数据：渲染列表
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
                    // 编辑模式：输入框 + 保存按钮
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
                    // 正常模式：标题 + 编辑/删除按钮
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
            // 无数据：提示文本
            <p className="text-xs text-gray-500 py-4 text-center">
              暂无匹配对话
            </p>
          )}
        </div>

        {/* 底部：返回主页链接 */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => navigate("/home")}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            ← 返回主页
          </button>
        </div>
      </div>

      {/* 2. 收起状态的展开按钮（左侧居中，仅在收起时显示） */}
      {!isOpen && (
        <button
          ref={toggleButtonRef}
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center
            bg-blue-600 text-white rounded-r-full shadow-md hover:bg-blue-700 transition-all z-30"
          title="展开侧边栏"
          aria-label="展开侧边栏"
        >
          ➡
        </button>
      )}

      {/* 3. 移动设备遮罩层（仅在侧边栏展开时显示，点击关闭） */}
      {isOpen && isMobile && (
        <div
          className="absolute inset-0 bg-black bg-opacity-30 z-10"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* 4. 主内容区域占位（确保侧边栏展开时不遮挡内容） */}
      <div className={`transition-all duration-300 ${isOpen ? 'ml-[260px]' : 'ml-0'} flex-1`}>
        {/* 主内容由父组件传入，此处仅为占位，避免布局错乱 */}
      </div>

      {/* 5. Toast 通知组件（全局提示） */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 全局样式（动画等） */}
      <style>
        {`
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