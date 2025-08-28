// TemplateLibrary.tsx
import React from 'react';

const TemplateLibrary = ({ filteredTemplates, handleTemplateSelect, search, setSearch }) => (
  <div className="border-t p-4">
    <h3 className="font-bold mb-2">模板库</h3>
    <input
      type="text"
      placeholder="搜索模板..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full p-1 border rounded text-sm mb-2"
    />
    <ul className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
      {filteredTemplates.map((t) => (
        <li
          key={t.id}
          className="p-1 hover:bg-gray-200 rounded truncate cursor-pointer"
          title={t.original_name}
          onClick={() => handleTemplateSelect(t.filename)}
        >
          📄 {t.original_name}
        </li>
      ))}
    </ul>
  </div>
);

export default TemplateLibrary;
