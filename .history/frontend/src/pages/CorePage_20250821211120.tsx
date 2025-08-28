import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Editor from "../components/Editor";
import { useApp } from "../store/app";
import api from "../api";

export default function CorePage() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);

  // 拉取对话列表
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

  // 选择对话
  const handleSelectConv = (conv: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: conv });
  };

  // 生成公文
  const handleGenerateDocument = async (docType: string, userInput: string) => {
    try {
      const res = await api.post("/api/generate", {
        doc_type: docType,
        user_input: userInput
      });
      
      const { text, filename } = res.data;

      // 将生成的公文和文件名保存在当前对话中
      dispatch({ type: "SET_CURRENT_CONV", payload: { ...state.currentConv, docContent: text, filename: filename } });

    } catch (err) {
      console.error("生成公文失败", err);
    }
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
      <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4">
        <h3>公文格式</h3>
        {/* 检查并渲染公文内容 */}
        {state.currentConv?.docContent ? (
          <div>
            <p>{state.currentConv?.docContent}</p>
            <a href={`/api/download/${state.currentConv?.filename}`} target="_blank" rel="noreferrer">
              下载公文
            </a>
          </div>
        ) : (
          <p>暂无公文内容</p>
        )}
      </div>
    </div>
  );
}
