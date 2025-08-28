import React, { useEffect } from "react";
import api from "../api";
import { useApp } from "../store/app";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate(); // 导入并使用 useNavigate

  const fetchConvs = async () => {
    const res = await api.get("/api/conversations");
    dispatch({ type: "SET_CONVERSATIONS", payload: res.data });
  };

  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      const newConversation = res.data;

      // 更新全局状态
      dispatch({ type: "SET_CONVERSATIONS", payload: [...state.conversations, newConversation] });

      // 设置当前对话
      dispatch({ type: "SET_CURRENT_CONV", payload: newConversation });

      // 跳转到 CorePage 页面
      navigate(`/core/${newConversation.id}`);
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  const deleteConv = async (id: number) => {
    await api.delete(`/api/conversations/${id}`);
    fetchConvs();
  };

  useEffect(() => {
    fetchConvs();
  }, []);

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv}>
        新建对话
      </Button>
      <div className="flex-1 overflow-auto space-y-2">
        {/* 使用条件渲染，避免访问 undefined */}
        {Array.isArray(state.conversations) && state.conversations.length > 0 ? (
          state.conversations.map((c) => (
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
                <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}>❌</button>
              </div>
            </div>
          ))
        ) : (
          <p>暂无对话记录</p> // 如果没有对话数据，则显示提示
        )}
      </div>
      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/home">个人页面</a>
      </div>
    </div>
  );
}
