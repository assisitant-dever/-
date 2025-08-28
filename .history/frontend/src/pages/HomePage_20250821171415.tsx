import React, { useEffect, useState } from "react";
import api from "../api";

export default function HomePage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [convs, setConvs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const d = await api.get("/api/documents");
      const c = await api.get("/api/conversations");
      setDocs(d.data);
      setConvs(c.data);
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 min-h-screen bg-slate-50 dark:bg-slate-900">
      <h2 className="text-2xl font-bold mb-4">个人主页</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-2">公文生成历史</h3>
          <ul className="space-y-2">
            {docs.map(d => (
              <li key={d.id} className="flex justify-between p-2 border rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                <span>{d.title}</span>
                <a href={`/api/download/${d.filename}`} target="_blank" className="text-blue-500">下载</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-2">对话历史</h3>
          <ul className="space-y-2">
            {convs.map(c => (
              <li key={c.id} className="p-2 border rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                {c.title}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
