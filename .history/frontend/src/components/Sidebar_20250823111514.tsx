import React, { useEffect, useState } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

// 接收父组件传入的状态和 setter
export default function Sidebar({
  onSelect,
  isOpen,
  setIsOpen,
}: {
  onSelect: (c: any) => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // ✅ 移除内部的 isOpen 状态，由父组件控制

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

      if (window.innerWidth < 768) {
        setIsOpen(false);
      }
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
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const startEdit = (e: React.MouseEvent, c: any) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      await api.patch(`/api/conversations/${editingId}`, { title: editTitle.trim() });
      fetchConvs();
      setEditingId(null);
    } catch (err) {
      console.error("更新标题失败:", err);
      alert("保存失败");
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

  // ========== 核心修改：不再使用 absolute 定位 ==========
  return (
    <>
      {/* ========== 折叠按钮（现在是相对位置）========== */}
      {!isOpen && (
        <div
          className="flex items-center justify-center w-8 h-full bg-slate-200 dark:bg-slate-700 
                     hover:w-12 hover:bg-slate-300 dark:hover:bg-slate-600
                     cursor-w-resize z-40 border-r dark:border-slate-600"
          onClick={toggleSidebar}
          title="展开侧边栏"
        >
          <span className="text-xs text-slate-500 dark:text-slate-400 rotate-180">▶</span>
        </div>
      )}

      {/* ========== 侧边栏主体（作为 grid 一列）========== */}
      {isOpen && (
        <div className="bg-slate-100 dark:bg-slate-900 p-4 flex flex-col border-r dark:border-slate-700 z-30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">对话记录</h2>
            <button
              onClick={toggleSidebar}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              title="收起侧边栏"
            >
              ◀
            </button>
          </div>

          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3 px-3 py-1 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600"
          />

          <Button className="mb-3" onClick={newConv}>➕ 新建对话</Button>

          <div className="flex-1 overflow-auto space-y-1">
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
      )}
    </>
  );
}