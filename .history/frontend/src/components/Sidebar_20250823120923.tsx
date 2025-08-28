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
    // ✅ 使用 grid 布局，让侧边栏和主内容区共享空间
    className="grid h-full w-full"
    style={{
      gridTemplateColumns: isOpen ? '256px 1fr' : '40px 1fr', // ✅ 真正影响布局
      transition: 'grid-template-columns 300ms ease-in-out',
    }}
  >
    {/* ========== 侧边栏（现在真正占用布局空间）========== */}
    <div
      className={`bg-slate-100 dark:bg-slate-900 flex flex-col border-r
                  transform-gpu transition-all duration-300 ease-in-out cursor-pointer
                  relative`} // 移除了 absolute，现在是正常布局流
      style={{
        width: isOpen ? '256px' : '40px', // 可选：辅助控制，也可省略
      }}
      onClick={() => {
        if (!isOpen) {
          setIsOpen(true);
        }
      }}
    >
      {/* 内部折叠按钮（只在展开时显示） */}
      {isOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          className="absolute top-4 right-2 w-6 h-6 flex items-center justify-center
                     text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700
                     rounded transition-colors z-10"
          title="收起侧边栏"
        >
          ◀
        </button>
      )}

      {/* 展开状态：完整内容 */}
      {isOpen ? (
        <>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 mt-8 px-2">对话记录</h2>

          <input
            type="text"
            placeholder="搜索对话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mx-2 mb-3 px-3 py-1 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          />

          <Button 
            className="mx-2 mb-3" 
            onClick={(e) => {
              e.stopPropagation();
              newConv();
            }}
          >
            ➕ 新建对话
          </Button>

          <div className="flex-1 px-2 overflow-auto space-y-1">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded cursor-pointer text-sm break-words
                    ${c.id === state.currentConv?.id
                      ? "bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500"
                      : "bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(c);
                  }}
                >
                  {/* 内容项保持不变 */}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-2">暂无匹配对话</p>
            )}
          </div>

          <div className="mt-3 pt-2 px-2 text-xs text-slate-600 dark:text-slate-300 border-t">
            <a 
              href="/home" 
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              ← 返回主页
            </a>
          </div>
        </>
      ) : (
        /* ========== 收起状态：中间显示 ▶ ========== */
        <div
          className="flex-1 flex items-center justify-center text-2xl text-slate-500 dark:text-slate-400"
          onClick={() => setIsOpen(true)}
        >
          ▶
        </div>
      )}
    </div>

    {/* ========== 主内容区（自动适应剩余空间）========== */}
    <main className="bg-white dark:bg-slate-800 transition-all duration-300 p-4 overflow-auto">
      {/* 这里是你原来的主内容区，比如聊天窗口 */}
      {/* 它会自动从 256px 或 40px 开始布局 */}
      {state.currentConv ? (
        <div>当前对话: {state.currentConv.title}</div>
      ) : (
        <div>请选择或新建一个对话</div>
      )}
    </main>
  </div>
);
}
