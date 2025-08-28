// PreviewArea.tsx
import React from 'react';

const PreviewArea = ({ previewContent, previewHTML }) => (
  <div className="w-80 bg-gray-50 flex flex-col border-l">
    <div className="flex-1 p-4 overflow-y-auto">
      <h3 className="font-bold mb-2">公文预览</h3>
      <div
        className="bg-white p-3 border rounded text-sm whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: previewHTML || previewContent }}
      />
    </div>
  </div>
);

export default PreviewArea;
