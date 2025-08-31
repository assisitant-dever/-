import React from 'react';

interface SkeletonProps {
  type: 'message' | 'preview';
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({ type, count = 1 }) => {
  // 消息骨架屏
  const MessageSkeleton = () => (
    <div className="mb-4 flex items-start">
      <div className="w-8 h-8 rounded-full bg-gray-200 rounded rounded rounded rounded-full mr-3 animate-pulse"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
      </div>
    </div>
  );

  // 预览骨架屏
  const PreviewSkeleton = () => (
    <div className="bg-white p-4 border border-gray-200 rounded-lg w-full">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6 mb-2 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse"></div>
    </div>
  );

  // 根据类型渲染不同的骨架屏
  const renderSkeleton = () => {
    switch (type) {
      case 'message':
        return Array(count).fill(0).map((_, index) => <MessageSkeleton key={index} />);
      case 'preview':
        return <PreviewSkeleton />;
      default:
        return null;
    }
  };

  return <>{renderSkeleton()}</>;
};

export default Skeleton;
    