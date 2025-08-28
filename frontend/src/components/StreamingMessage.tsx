import React, { useEffect, useRef } from 'react';

interface StreamingMessageProps {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  docxFile?: string;
  onDownload?: (filename: string) => void;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({
  id,
  role,
  content,
  isStreaming = false,
  docxFile,
  onDownload
}) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLParagraphElement>(null);

  // 流式更新时自动滚动到最新内容
  useEffect(() => {
    if (isStreaming && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isStreaming]);

  // 为流式内容添加动态效果（可选）
  const getContentStyles = () => ({
    margin: 0,
    padding: 0,
    whiteSpace: 'pre-wrap' as const,
    opacity: isStreaming ? 0.9 : 1,
    transition: isStreaming ? 'opacity 0.1s ease' : 'none'
  });

  return (
    <div
      ref={messageRef}
      style={{
        display: 'flex',
        marginBottom: '16px',
        justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 16px',
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          backgroundColor: role === 'user' ? '#2563eb' : '#f3f4f6',
          color: role === 'user' ? 'white' : '#1f2937',
        }}
      >
        <p ref={contentRef} style={getContentStyles()}>
          {content || (isStreaming ? '生成中...' : '')}
        </p>

        {/* 流式结束后显示下载按钮 */}
        {docxFile && !isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(docxFile);
            }}
            style={{
              marginTop: '8px',
              color: role === 'user' ? '#a5b4fc' : '#16a34a',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            📥 下载公文文件
          </button>
        )}
      </div>
    </div>
  );
};

export default StreamingMessage;
    