import React, { useEffect, useState } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  // 从 localStorage 读取侧边栏状态，支持刷新后保持
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved === null ? true : saved === "true"; // 默认展开
  });

  // 保存状态到 localStorage
  const toggleSidebar = () => {
    const newOpen = !isOpen;
    setIsOpen(newOpen);
    localStorage.setItem("sidebarOpen", String(newOpen));
  };

  // 获取对话列表
  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
    } catch (err) {
      console.error("获取对话列表失败:", err);
      alert("获取对话列表失败");
    }
  };

  // 新建对话
  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      const newConversation = res.data;

      const updatedConvs = Array.isArray(state.conversations)
        ? [...state.conversations, newConversation]
        : [newConversation];

      dispatch({ type: "SET_CONVS", payload: updatedConvs });
      dispatch({ type: "SET_CURRENT_CONV", payload: newConversation });

      navigate(`/core/${newConversation.id}`);

      // 可选：在小屏幕上创建后自动收起侧边栏
      if (window.innerWidth < 768) {
        setIsOpen(false);
      }
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  // 删除对话
  const deleteConv = async (id: number) => {
    if (!window.confirm("确定要删除这个对话吗？")) return;
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs(); // 重新加载
    } catch (err) {
      console.error("删除对话失败:", err);
      alert("删除对话失败");
    }
  };

  // 切换对话
  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    onSelect(c);

    // 可选：在小屏幕上切换后自动收起侧边栏
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchConvs();
  }, []);

  // 如果关闭，只渲染一个按钮
  if (!isOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center
                   bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200
                   rounded-r-md hover:bg-slate-300 dark:hover:bg-slate-600
                   transition-transform duration-200"
        title="展开侧边栏"
      >
        ▶
      </button>
    );
  }

  // 默认：展开状态
  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col border-r">
      {/* 折叠按钮 */}
      <button
        onClick={toggleSidebar}
        className="self-end mb-4 p-1 text-slate-600 dark:text-slate-300 
                   hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
        title="收起侧边栏"
      >
        ◀
      </button>

      <Button className="mb-4" onClick={newConv}>
        新建对话
      </Button>

      <div className="flex-1 overflow-auto space-y-2">
        {Array.isArray(state.conversations) && state.conversations.length > 0 ? (
          state.conversations.map((c) => (
            <div
              key={c.id}
              className={`p-2 rounded-lg cursor-pointer text-sm
                ${c.id === state.currentConv?.id
                  ? "bg-blue-100 dark:bg-blue-900 border border-blue-200"
                  : "bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              onClick={() => handleSelect(c)}
            >
              <div className="flex justify-between items-center">
                <span className="truncate max-w-40">{c.title || `对话 ${c.id}`}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                  className="opacity-60 hover:opacity-100 text-red-500"
                  aria-label="删除对话"
                >
                  ✖
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">暂无对话记录</p>
        )}
      </div>

      <div className="mt-4 border-t pt-2 text-xs text-slate-600 dark:text-slate-300">
        <a href="/home" className="hover:underline">← 返回主页</a>
      </div>
    </div>
  );
}