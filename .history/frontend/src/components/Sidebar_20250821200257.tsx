import React, { useEffect } from "react";
import api from "../api";
import { useApp } from "../store/app";
import { Button } from "./ui/button";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();

  // 获取对话列表
  const fetchConvs = async () => {
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVERSATIONS", payload: res.data });
    } catch (err) {
      console.error("获取对话列表失败:", err);
      alert("获取对话列表失败");
    }
  };

  // 创建新对话
  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      fetchConvs();
      onSelect(res.data);
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  // 删除对话
  const deleteConv = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs();
    } catch (err) {
      console.error("删除对话失败:", err);
      alert("删除对话失败");
    }
  };

  useEffect(() => {
    fetchConvs(); // 加载对话列表
  }, []);

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv}>新建对话</Button>
      <div className="flex-1 overflow-auto space-y-2">
        {state.conversations && state.conversations.length > 0 ? (
          state.conversations.map((c) => (
            <div
              key={c.id}
              className="p-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-200"
              onClick={() => { dispatch({ type: "SET_CURRENT_CONV", payload: c }); onSelect(c); }}
            >
              <div className="flex justify-between">
                <span>{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv(c.id);
                  }}
                  className="text-red-500"
                >
                  ❌
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>暂无对话记录</p>
        )}
      </div>
      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/home">个人页面</a>
      </div>
    </div>
  );
}
