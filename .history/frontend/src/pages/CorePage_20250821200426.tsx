import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Editor from "../components/Editor";
import { useApp } from "../store/app";
import api from "../api";

export default function CorePage() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);

  // ---------------- 拉取对话列表 ----------------
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/conversations");
      dispatch({ type: "SET_CONVS", payload: res.data });
      if (res.data.length > 0 && !state.currentConv) {
        dispatch({ type: "SET_CURRENT_CONV", payload: res.data[0] });
      }
    } catch (err) {
      console.error("获取对话历史失败", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // ---------------- 选择对话 ----------------
  const handleSelectConv = (conv: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: conv });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        conversations={state.conversations}
        onSelect={handleSelectConv}
        loading={loading}
      />
      <div className="flex-1 p-4">
        <Editor />
      </div>
    </div>
  );
}
