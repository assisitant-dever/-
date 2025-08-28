import { useEffect, useState } from "react";
import api from "../api";

export default function HomePage() {
  const [docs, setDocs] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const res = await api.get("/api/documents");
      setDocs(res.data.documents);
    } catch (err) {
      console.error("获取历史文档失败", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">我的历史公文</h1>
      {docs.length === 0 ? (
        <p>暂无历史公文</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d}>
              <a
                href={`http://127.0.0.1:8000/api/download/${encodeURIComponent(d)}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                {d}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
