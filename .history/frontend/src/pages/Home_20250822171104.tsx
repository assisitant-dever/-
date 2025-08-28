// src/pages/Home.tsx
import React from "react";
import { useApp } from "../store/app";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export default function Home() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const handleNewChat = () => {
    navigate("/chat/new");
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡到卡片点击

    if (!window.confirm("确定要删除这个会话吗？")) return;

    try {
      await fetch("/api/delete-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      // 本地同步删除
      dispatch({ type: "DELETE_CONVERSATION", payload: id });
    } catch (err) {
      alert("删除失败，请重试");
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧：会话列表 */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">公文助手</h1>
          <Button onClick={handleNewChat} className="w-full mt-4">
            ➕ 新建会话
          </Button>
        </div>

        <div className="flex-1 p-2 overflow-y-auto">
          {state.conversations.length === 0 ? (
            <p className="text-gray-500 text-center mt-10">暂无会话</p>
          ) : (
            <ul className="space-y-1">
              {state.conversations.map((conv) => (
                <li
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="p-3 border rounded cursor-pointer hover:bg-gray-100 group relative"
                >
                  <div className="font-medium text-sm truncate">{conv.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(conv.updated_at).toLocaleString()}
                  </div>
                  {/* 删除按钮（悬停显示） */}
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 右侧：欢迎页 */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">欢迎使用公文助手</h2>
          <p className="text-gray-500 mt-2">从左侧选择会话或点击“新建会话”开始</p>
        </div>
      </div>
    </div>
  );
}