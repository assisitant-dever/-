import React, { useEffect, useState } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<number | string | null>(null); // 👈 跟踪正在删除的对话

  // 获取对话列表
  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      // 确保返回的是数组
      const convs = Array.isArray(res.data) ? res.data : [];
      dispatch({ type: "SET_CONVERSATIONS", payload: convs });
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

      dispatch({ type: "SET_CONVERSATIONS", payload: updatedConvs });
      dispatch({ type: "SET_CURRENT_CONV", payload: newConversation });
      navigate(`/core/${newConversation.id}`);
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  // 删除对话
  const deleteConv = async (id: number | string) => {
    if (deletingId) return; // ❌ 防止重复点击

    if (!window.confirm("确定要删除这个对话吗？")) return;

    setDeletingId(id); // 👈 标记正在删除

    try {
      await api.delete(`/api/conversations/${id}`);

      // ✅ 本地过滤删除，无需重新 fetch
      const remaining = (state.conversations || []).filter(
        (c) => String(c.id) !== String(id)
      );
      dispatch({ type: "SET_CONVERSATIONS", payload: remaining });

      // 如果当前会话被删除，清空它
      if (state.currentConv?.id === id) {
        dispatch({ type: "SET_CURRENT_CONV", payload: null });
        onSelect(null);
      }
    } catch (err) {
      console.error("删除对话失败:", err);
      alert("删除失败：" + (err.response?.data?.detail || "网络错误"));
    } finally {
      setDeletingId(null); // ✅ 清除删除状态
    }
  };

  // 页面加载时获取对话列表
  useEffect(() => {
    fetchConvs();
  }, []);

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col h-full">
      <Button className="mb-4" onClick={newConv}>
        新建对话
      </Button>

      <div className="flex-1 overflow-auto space-y-2">
        {Array.isArray(state.conversations) && state.conversations.length > 0 ? (
          state.conversations.map((c) => (
            <div
              key={c.id}
              className="p-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              onClick={() => {
                dispatch({ type: "SET_CURRENT_CONV", payload: c });
                onSelect(c);
              }}
            >
              <div className="flex justify-between items-center">
                <span className="truncate flex-1 text-sm">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // ❌ 阻止冒泡
                    deleteConv(c.id);   // ✅ 调用删除
                  }}
                  disabled={deletingId === c.id} // ✅ 删除中禁用
                  className="ml-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs"
                >
                  {deletingId === c.id ? "…" : "❌"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">暂无对话记录</p>
        )}
      </div>

      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/home" className="hover:underline">
          个人页面
        </a>
      </div>
    </div>
  );
}