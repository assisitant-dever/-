import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Editor from "../components/Editor";
import { useApp } from "../store/app";
import api from "../api";

export default function CorePage() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{ text: string; filename: string } | null>(null);

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

  // 生成公文
  const generateDocument = async (docType: string, userInput: string) => {
    try {
      const res = await api.post("/api/generate", {
        doc_type: docType,
        user_input: userInput,
      });
      setGeneratedDoc({
        text: res.data.text,
        filename: res.data.filename,
      });
    } catch (err) {
      console.error("生成公文失败", err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // 选择对话
  const handleSelectConv = (conv: any) => {
    dispatch({ type: "SET_CURRENT_CONV", payload: conv });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* 左侧 Sidebar */}
      <Sidebar
        conversations={state.conversations}
        onSelect={handleSelectConv}
        loading={loading}
      />

      {/* 中间区域：显示对话和输入框 */}
      <div className="flex-1 p-4 flex flex-col">
        <div className="flex-1 overflow-auto">
          <Editor currentConv={state.currentConv} /> {/* 用于展示和交互 */}
        </div>

        {/* 输入框和按钮 */}
        <div className="mt-4 flex">
          <textarea
            className="w-full p-2 rounded-lg"
            placeholder="请输入内容..."
            // 这里可以添加对输入框的 onChange 和 submit 处理函数
          />
          <button
            className="ml-2 bg-blue-600 text-white py-2 px-4 rounded-lg"
            onClick={() => generateDocument("通知", "公文内容示例")}
          >
            发送
          </button>
        </div>
      </div>

      {/* 右侧：公文生成 */}
      <div className="w-96 p-4 bg-slate-100 dark:bg-slate-800">
        <h3 className="text-xl font-bold mb-4">生成的公文</h3>
        {generatedDoc && (
          <div>
            <pre className="bg-gray-200 p-4 rounded-lg">{generatedDoc.text}</pre>
            <a
              href={`/api/download/${generatedDoc.filename}`}
              target="_blank"
              className="text-blue-500 mt-2 block"
            >
              下载公文
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
