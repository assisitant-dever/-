import React, { useEffect, useState } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved === null ? true : saved === "true";
  });

  const [searchTerm, setSearchTerm] = useState(""); // 搜索关键词
  const [editingId, setEditingId] = useState<number | null>(null); // 正在编辑的对话 ID
  const [editTitle, setEditTitle] = useState(""); // 编辑框内容

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    localStorage.setItem("sidebarOpen", String(!isOpen));
  };

  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
    } catch (err) {
      console.error("获取对话列表失败:", err);
      alert("获取对话列表失败");
    }
  };

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
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  const deleteConv = async (id: number) => {
    if (!window.confirm("确定要删除这个对话吗？")) return;
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs();
    } catch (err) {
      console.error("删除对话失败:", err);
      alert("删除对话失败");
    }
  };

  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    if (onSelect) onSelect(c);
    navigate(`/core/${c.id}`);
  };

  // 开始编辑
  const startEdit = (e: React.MouseEvent, c: any) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      await api.patch(`/api/conversations/${editingId}`, { title: editTitle.trim() });
      fetchConvs(); // 刷新列表
      setEditingId(null);
    } catch (err) {
      console.error("更新标题失败:", err);
      alert("保存失败");
    }
  };

  // 过滤后的对话列表
  const filteredConversations = Array.isArray(state.conversations)
    ? state.conversations.filter((c) =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // 初始加载
  useEffect(() => {
    fetchConvs();
  }, []);

  return (
    <div
      className={`grid grid-cols-[auto,1fr] h-full transition-all duration-300 ease-in-out ${isOpen ? "grid-cols-[256px,1fr]" : "grid-cols-[64px,1fr]"}`}
      onClick={isOpen ? undefined : toggleSidebar} // 点击收起的侧边栏展开
    >
      {/* 侧边栏主体 */}
      <div
        className="bg-slate-100 dark:bg-slate-900 p-4 flex flex-col border-r"
        style={{ width: isOpen ? '256px' : '64px' }} // 侧边栏宽度
      >
        {isOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute top-4 left-500 z-50 w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full"
            title="收回侧边栏"
            style={{ zIndex: 9999 }}  // 确保按钮位于最上层
          >
            收回
          </button>
        )}


        <h2 className={`text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 ${isOpen ? '' : 'invisible'}`}>对话记录</h2>

        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`mb-3 px-3 py-1 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 ${isOpen ? '' : 'invisible'}`}
        />

        <Button className={`mb-3 ${isOpen ? '' : 'invisible'}`} onClick={newConv}>➕ 新建对话</Button>

        <div className={`flex-1 overflow-auto space-y-1 ${isOpen ? '' : 'invisible'}`}>
          {filteredConversations.length > 0 ? (
            filteredConversations.map((c) => (
              <div
                key={c.id}
                className={`p-2 rounded cursor-pointer text-sm break-words
                  ${c.id === state.currentConv?.id
                    ? "bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500"
                    : "bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                onClick={() => handleSelect(c)}
              >
                {editingId === c.id ? (
                  // 编辑模式
                  <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 px-1 text-xs border rounded"
                      autoFocus
                      onBlur={saveEdit}
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                    />
                    <button
                      onClick={saveEdit}
                      className="text-green-600 text-xs px-1"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  // 正常显示
                  <div className="flex justify-between items-center">
                    <span
                      className="truncate"
                      onDoubleClick={(e) => startEdit(e, c)}
                    >
                      {c.title}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => startEdit(e, c)}
                        className="opacity-40 hover:opacity-100 text-xs"
                        aria-label="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                        className="opacity-40 hover:opacity-100 text-red-500 text-xs"
                        aria-label="删除"
                      >
                        ✖
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">暂无匹配对话</p>
          )}
        </div>

        <div className="mt-3 pt-2 text-xs text-slate-600 dark:text-slate-300 border-t">
          <a href="/home" className="hover:underline">← 返回主页</a>
        </div>
      </div>

      {/* ========== 内容区域（此处可以显示其它内容） ========== */}
      <div className="flex-1 bg-white dark:bg-slate-800 p-4">
        {/* 你可以在这里放其他内容 */}
      </div>
    </div>
  );
}
