// InputArea.tsx
import React from 'react';
import { Button } from './ui/button';

const InputArea = ({ input, setInput, handleSend, loading, docType, setDocType, inputRef }) => (
  <div className="p-4 border-t bg-gray-50">
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="通知">通知</option>
          <option value="请示">请示</option>
          <option value="会议纪要">会议纪要</option>
          <option value="报告">报告</option>
          <option value="函">函</option>
        </select>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="请输入您的公文需求（按 Enter 发送，Shift+Enter 换行）..."
          className="flex-1 px-3 py-2 border rounded text-sm resize-none"
          rows={1}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? "生成中..." : "发送"}
        </Button>
      </div>
    </div>
  </div>
);

export default InputArea;
