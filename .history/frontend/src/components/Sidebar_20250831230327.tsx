import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import Toast from "./Toast";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const toggleButtonRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  const [isOpen, setIsOpen] = useState(true); // 电脑端默认展开
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

  // 切换边栏展开/收起
  const toggleSidebar = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    console.log("侧边栏切换状态:", newState);
  }, [isOpen]);

  // 检测设备类型
  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isOpen) setIsOpen(false);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [isOpen]);

  // 绑定点击事件
  useEffect(() => {
    if (toggleButtonRef.current) {
      const button = toggleButtonRef.current;
      
      // 移除旧事件
      const oldHandler = button.getAttribute('data-handler');
      if (oldHandler) button.removeEventListener('click', eval(oldHandler));
      
      // 绑定新事件
      const handleClick = () => {
        console.log("展开按钮点击");
        toggleSidebar();
      };
      button.addEventListener('click', handleClick);
      button.setAttribute('data-handler', handleClick.toString());
      
      return () => {
        button.removeEventListener('click', handleClick);
      };
    }
  }, [toggleSidebar]);

  // 其他功能方法保持不变
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
      {/* 侧边栏主体 */}
      <div
        className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'w-[260px]' : 'w-0'
        }`}
      >
        {/* 侧边栏头部 */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          <div
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 cursor-pointer"
            title="收起侧边栏"
          >
            ◀
          </div>
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
                  className={`p-2 rounded-md cursor-pointer text-sm break-words
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

      {/* 收起状态的展开按钮 - 可自定义样式区域 */}
      {!isOpen && (
        <div
          ref={toggleButtonRef}
          className="collapsed-sidebar-button"
          title="展开侧边栏"
          aria-label="展开侧边栏"
        >
          <span className="expand-icon">≡</span>
        </div>
      )}

      {/* 主内容区域占位 */}
      <div className={`transition-all duration-300 ${isOpen ? 'ml-[260px]' : 'ml-0'} flex-1`}></div>

      {/* Toast组件 */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* 收起状态样式 - 在这里修改自定义样式 */}
      <style>
        {`
          /* 收起状态的展开按钮样式 */
          .collapsed-sidebar-button {
            /* 位置与尺寸 */
            position: fixed !important;
            left: 0 !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 45px !important;
            height: 120px !important;
            
            /* 外观样式 - 可根据需要修改 */
            background-color: #2563eb !important; /* 按钮背景色 */
            border-radius: 0 12px 12px 0 !important; /* 右侧圆角 */
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; /* 阴影效果 */
            cursor: pointer !important;
            z-index: 9999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* 悬停效果 */
          .collapsed-sidebar-button:hover {
            background-color: #1d4ed8 !important; /* 深色hover效果 */
            width: 50px !important; /* 轻微放大 */
          }
          
          /* 按钮图标样式 */
          .expand-icon {
            color: white !important;
            font-size: 20px !important;
            font-weight: bold !important;
            transition: transform 0.3s ease !important;
          }
          
          /* 悬停时图标旋转效果 */
          .collapsed-sidebar-button:hover .expand-icon {
            transform: rotate(90deg) !important;
          }
          
          /* 其他必要样式 */
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
    