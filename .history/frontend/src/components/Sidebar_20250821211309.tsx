import React from "react";
import { Button } from "./ui/button"; // 假设Button组件为自定义按钮组件
import { useApp } from "../store/app";

export default function Sidebar({ conversations, onSelect, loading }: { conversations: any[], onSelect: any, loading: boolean }) {
  const { dispatch } = useApp();

  // 创建新对话
  const newConv = async () => {
    try {
      const res = await api.post("/api/conversations", { title: "新对话" });
      dispatch({ type: "SET_CURRENT_CONV", payload: res.data });
      onSelect(res.data);
    } catch (err) {
      console.error("新建对话失败", err);
      alert("新建对话失败");
    }
  };

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv} disabled={loading}>
        {loading ? "创建中..." : "新建对话"}
      </Button>
      <div className="flex-1 overflow-auto space-y-2">
        {conversations.map((conv: any) => (
          <div
            key={conv.id}
            className="p-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-200"
            onClick={() => onSelect(conv)}
          >
            <div className="flex justify-between">
              <span>{conv.title}</span>
              <button onClick={(e) => { e.stopPropagation(); /* 删除逻辑 */ }}>❌</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
