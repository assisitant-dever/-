import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  messages: { role: string; content: string }[];
}

export default function Sidebar({ onSelect }: { onSelect: (c: Conversation) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const fetchConvs = async () => {
    const res = await axios.get("http://127.0.0.1:8000/api/conversations");
    setConversations(res.data);
  };

  const newConv = async () => {
    const res = await axios.post("http://127.0.0.1:8000/api/conversations", { title: "新对话" });
    fetchConvs();
    onSelect(res.data);
  };

  const deleteConv = async (id: number) => {
    await axios.delete(`http://127.0.0.1:8000/api/conversations/${id}`);
    fetchConvs();
  };

  useEffect(() => { fetchConvs(); }, []);

  return (
    <div className="w-64 bg-slate-100 dark:bg-slate-900 p-4 flex flex-col">
      <Button className="mb-4" onClick={newConv}>新建对话</Button>
      <div className="flex-1 overflow-auto space-y-2">
        {conversations.map(c => (
          <div
            key={c.id}
            className="p-2 rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-200"
            onClick={() => onSelect(c)}
          >
            <div className="flex justify-between">
              <span>{c.title}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}>❌</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t pt-2 text-sm text-slate-600 dark:text-slate-300">
        <a href="/profile">个人页面</a>
      </div>
    </div>
  );
}
    