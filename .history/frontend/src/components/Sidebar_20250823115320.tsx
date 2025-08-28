// Sidebar.tsx
import React, { useState, useEffect } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // 获取对话列表
  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
    } catch (err) {
      console.error("获取对话列表失败:", err);
    }
  };

  useEffect(() => {
    fetchConvs();
  }, []);

  // 新建对话
  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      const newConv = res.data;
      dispatch({ type: "SET_CONVS", payload: [...state.conversations, newConv] });
      dispatch({ type: "SET_CURRENT_CONV", payload: newConv });
      navigate(`/core/${newConv.id}`);
    } catch (err) {
      console.error("新建对话失败", err);
    }
  };

  // 删除对话
  const deleteConv = async (id: number) => {
    if (!window.confirm("确定要删除吗？")) return;
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs();
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  // 选择对话
  const handleSelect = (c: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: c });
    navigate(`/core/${c.id}`);
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setIsOpen(false);
    }
  };

  // 编辑标题
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
      console.error("更新失败:", err);
    }
  };

  // 过滤对话
  const filteredConversations = Array.isArray(state.conversations)
    ? state.conversations.filter((c) =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="bg-slate-100 dark:bg-slate-900 border-r transition-all duration-300 ease-in-out">
      {/* ========== 收起状态：窄栏（40px） ========== */}
      {!isOpen && (
        <div className="w-10 h-full flex flex-col items-center py-2 gap-2">
          {/* 展开按钮 */}
          <button
            onClick={() => setIsOpen(true)}
            className="w-6 h-6 flex items-center justify-center
                       text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700
                       rounded transition-colors"
            title="展开侧边栏"
          >
            ▶
          </button>

          {/* 快捷图标（可选） */}
          <button
            onClick={newConv}
            className="w-6 h-6 flex items-center justify-center
                       text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30
                       rounded transition-colors"
            title="新建对话"
          >
            ➕
          </button>
        </div>
      )}

      {/* ========== 展开状态：完整侧边栏（256px） ========== */}
      {isOpen && (
        <div className="w-64 p-3 flex flex-col h-full">
          {/* 折叠按钮 */}
          <button
            onClick={() => setIsOpen(false)}
            className="self-end text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
          >
            ◀
          </button>

          {/* 搜索框 */}
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 my-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600"
          />

          {/* 新建按钮 */}
          <Button onClick={newConv} className="mb-3">
            ➕ 新建对话
          </Button>

          {/* 对话列表 */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredConversations.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`p-2 rounded text-sm cursor-pointer border-l-4
                            flex justify-between items-center
                            ${
                              state.currentConv?.id === c.id
                                ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500"
                                : "hover:bg-slate-200 dark:hover:bg-slate-700 border-transparent"
                            }`}
              >
                {editingId === c.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={saveEdit}
                      onKeyPress={(e) => e.key === "Enter" && saveEdit()}
                      className="flex-1 bg-transparent border-b px-1"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <span className="truncate flex-1">{c.title}</span>
                    <button
                      onClick={(e) => startEdit(e, c)}
                      className="ml-1 text-xs opacity-0 group-hover:opacity-100 hover:text-blue-600"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConv(c.id);
                      }}
                      className="ml-1 text-xs opacity-0 group-hover:opacity-100 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 返回主页 */}
          <a
            href="/home"
            className="mt-4 text-slate-600 dark:text-slate-400 hover:underline text-center"
          >
            ← 返回主页
          </a>
        </div>
      )}
    </div>
  );
}