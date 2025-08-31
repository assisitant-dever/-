import React, { useEffect, useRef } from 'react';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 自动关闭定时器
  useEffect(() => {
    if (visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      timerRef.current = setTimeout(() => {
        onClose();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, duration, onClose]);

  // 根据类型获取样式
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: '✓'
        };
      case 'error':
        return {
          bgColor: 'bg-red-50',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: '✕'
        };
      case 'info':
      default:
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          icon: 'i'
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg border border shadow-sm flex items-center gap-2 z-50 transition-all duration-300 ${
        visible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4 pointer-events-none'
      } ${styles.bgColor} ${styles.textColor} ${styles.borderColor}`}
    >
      <span className="font-semibold">{styles.icon}</span>
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-opacity-20"
        aria-label="关闭通知"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
    