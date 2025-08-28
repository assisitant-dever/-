// MessageList.tsx
import React from 'react';

const MessageList = ({ messages, handleDownload, loading }) => (
  <div className="flex-1 p-4 overflow-y-auto space-y-4">
    {messages.length === 0 ? (
      <p className="text-gray-500 text-center">暂无消息</p>
    ) : (
      messages.map((msg, idx) => (
        <div
          key={msg.id || idx}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-3xl px-4 py-2 rounded-lg shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.docx_file && (
              <button
                onClick={() => handleDownload(msg.docx_file)}
                className="text-sm mt-2 inline-block text-green-600 hover:underline cursor-pointer"
                disabled={loading}
              >
                📥 下载公文文件
              </button>
            )}
          </div>
        </div>
      ))
    )}
  </div>
);

export default MessageList;
