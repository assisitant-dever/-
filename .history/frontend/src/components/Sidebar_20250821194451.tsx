import React, { useEffect } from "react";
import api from "../api";
import { useApp } from "../store/app";
import { Button } from "./ui/button";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();

  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVERSATIONS", payload: res.data });
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  };

  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      fetchConvs(); // 刷新对话列表
      onSelect(res.data); // 选中新对话
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    }
  };

  const deleteConv = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs(); // 删除对话后刷新列表
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  // 在组件加载时获取对话列表
  useEffect(() => {
    fetchConvs();
  }, []);

  // 确保 conversations 是一个数组
  const conversations = state.conversations || [];

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv}>新建对话</Button>
      <div className="flex-1 overflow-auto space-y-2">
        {/* 如果没有对话，显示提示 */}
        {conversations.length === 0 ? (
          <div className="text-center text-slate-600 dark:text-slate-300">暂无对话</div>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className="p-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-200"
              onClick={() => {
                dispatch({ type: "SET_CURRENT_CONV", payload: c });
                onSelect(c);
              }}
            >
              <div className="flex justify-between">
                <span>{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止点击事件冒泡，避免触发 onClick
                    deleteConv(c.id);
                  }}
                >
                  ❌
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/home">个人页面</a>
      </div>
    </div>
  );
}
