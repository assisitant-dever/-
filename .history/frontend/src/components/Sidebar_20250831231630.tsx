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
  const headerRef = useRef<HTMLDivElement>(null); // 新增：头部容器引用
  
  // 状态管理
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ left: 0, top: 0 }); // 按钮位置
  
  // 其他状态保持不变
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

  // 关键修复：动态计算按钮位置
  useEffect(() => {
    const calculatePosition = () => {
      if (sidebarRef.current && headerRef.current) {
        // 获取侧边栏和头部容器的位置信息
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const headerRect = headerRef.current.getBoundingClientRect();
        
        // 计算展开状态时按钮应处的位置
        const targetLeft = sidebarRect.left + sidebarRect.width - 32; // 右侧内边距调整
        const targetTop = headerRect.top + headerRect.height / 2;
        
        setButtonPosition({ left: targetLeft, top: targetTop });
      }
    };

    // 初始化计算
    calculatePosition();
    
    // 监听窗口大小变化，重新计算位置
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
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

  // 其他功能方法保持不变...
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

  // ... 其他方法保持不变

  return (
    <div className="h-full flex overflow-hidden relative">
      {/* 侧边栏主体 */}
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
        {/* 侧边栏头部 - 添加ref用于位置计算 */}
        <div ref={headerRef} className="p-3 border-b border-gray-200 flex items-center justify-between relative h-12">
          <h2 className="text-sm font-semibold text-gray-800">对话记录</h2>
          <div className="toggle-button-target w-8 h-8"></div>
        </div>

        {/* 搜索框、列表等内容保持不变 */}
        <div className="p-3">
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* ... 其他内容保持不变 */}
      </div>

      {/* 智能切换按钮 - 基于计算的精准定位 */}
      <div
        ref={toggleButtonRef}
        className="sidebar-toggle-button"
        title={isOpen ? "收起侧边栏" : "展开侧边栏"}
        aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
        style={{
          // 动态定位：根据状态和计算结果定位
          left: isOpen ? `${buttonPosition.left}px` : '0',
          top: isOpen ? `${buttonPosition.top}px` : '50%',
          transform: isOpen ? 'translate(-50%, -50%)' : 'translateY(-50%)',
          
          // 尺寸和样式自适应
          width: isOpen ? '32px' : '40px',
          height: isOpen ? '32px' : '100px',
          borderRadius: isOpen ? '6px' : '0 12px 12px 0',
          boxShadow: isOpen ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <span className="toggle-icon" style={{
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          fontSize: isOpen ? '16px' : '20px',
        }}>
          {isOpen ? '◀' : '▶'}
        </span>
      </div>

      {/* 主内容区域 */}
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
          .sidebar-toggle-button {
            position: fixed !important;
            background-color: #2563eb !important;
            border: none !important;
            cursor: pointer !important;
            z-index: 9998 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          }
          
          .sidebar-toggle-button:hover {
            background-color: #1d4ed8 !important;
          }
          
          .toggle-icon {
            color: white !important;
            transition: transform 0.5s ease, font-size 0.5s ease !important;
            font-weight: bold !important;
          }
          
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
    