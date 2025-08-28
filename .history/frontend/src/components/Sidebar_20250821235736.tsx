import React, { useEffect } from "react";
import { useApp } from "../store/app";
import api from "../api";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelect }: { onSelect: (c: any) => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

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

      // 确保 conversations 是一个数组
      const updatedConvs = Array.isArray(state.conversations)
        ? [...state.conversations, newConversation] // 如果是数组，添加新对话
        : [newConversation]; // 如果不是数组，创建一个新的数组

      // 更新全局状态
      dispatch({ type: "SET_CONVS", payload: updatedConvs });

      // 设置当前对话
      dispatch({ type: "SET_CURRENT_CONV", payload: newConversation });

      // 跳转到新创建的对话页面
      navigate(`/core/${newConversation.id}`);
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  // 删除对话
  const deleteConv = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`);
      fetchConvs(); // 删除后重新加载对话列表
    } catch (err) {
      console.error("删除对话失败:", err);
      alert("删除对话失败");
    }
  };

  // 页面加载时获取对话列表
  useEffect(() => {
    fetchConvs();
  }, []);

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv}>新建对话</Button>

      <div className="flex-1 overflow-auto space-y-2">
        {/* 确保 conversations 是数组类型，防止 map 出现错误 */}
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
          <p>暂无对话记录</p> // 如果没有对话记录，显示提示
        )}
      </div>

      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/home">个人页面</a>
      </div>
    </div>
  );
}
