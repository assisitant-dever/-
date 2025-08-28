import React from 'react';

interface ButtonProps {
  /** 按钮文本 */
  children: React.ReactNode;
  /** 按钮类型 */
  variant?: 'primary' | 'secondary' | 'danger';
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 额外样式 */
  className?: string;
}

/**
 * 通用按钮组件
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        px-4 py-2 rounded font-medium transition-colors
        ${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
        ${variant === 'secondary' ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : ''}
        ${variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : ''}
        ${size === 'sm' ? 'px-2 py-1 text-sm' : ''}
        ${size === 'lg' ? 'px-6 py-3 text-lg' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export { Button };
