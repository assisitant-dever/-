import React, { useEffect, useRef } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  width: string;
  className?: string;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  side,
  width,
  className = '',
  children
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 点击遮罩层关闭抽屉
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // 点击ESC键关闭抽屉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 阻止抽屉内部事件冒泡
  const handleDrawerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        ref={overlayRef}
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleOverlayClick}
      />

      {/* 抽屉内容 */}
      <div
        ref={drawerRef}
        className={`fixed top-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${
          side === 'left' 
            ? open ? 'translate-x-0' : '-translate-x-full' 
            : open ? 'translate-x-0' : 'translate-x-full'
        } ${className}`}
        style={{
          [side]: 0,
          width,
          maxWidth: '100%',
          overflowY: 'auto'
        }}
        onClick={handleDrawerClick}
      >
        {children}
      </div>
    </>
  );
};

export default Drawer;
    