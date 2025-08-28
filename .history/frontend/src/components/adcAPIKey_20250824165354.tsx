import React, { useState, useEffect } from "react";

// 获取已知平台列表
const fetchPlatforms = async () => {
  const res = await fetch("/api/platforms");
  if (res.ok) {
    return res.json();
  }
  throw new Error("Failed to fetch platforms");
};

// 获取用户已有的 API Keys
const fetchAPIKeys = async () => {
  const res = await fetch("/api/api-keys");
  if (res.ok) {
    return res.json();
  }
  throw new Error("Failed to fetch API Keys");
};

const ApiKeyManager = () => {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [apiKeys, setAPIKeys] = useState<any[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // 获取平台列表
    fetchPlatforms()
      .then((data) => setPlatforms(data))
      .catch((err) => setError(err.message));

    // 获取用户已有的 API Keys
    fetchAPIKeys()
      .then((data) => setAPIKeys(data))
      .catch((err) => setError(err.message));

    setLoading(false);
  }, []);

  // 处理提交 API Key
  const handleAddApiKey = async () => {
    if (!selectedPlatform || !selectedModel || !apiKey) {
      setError("请填写所有字段！");
      return;
    }

    const apiKeyData = {
      platform: selectedPlatform,
      model_name: selectedModel,
      api_key: apiKey,
    };

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiKeyData),
      });

      if (res.ok) {
        const newApiKey = await res.json();
        setAPIKeys((prevKeys) => [...prevKeys, newApiKey]); // 更新现有 API Key 列表
        setApiKey(""); // 清空输入框
        setSelectedPlatform(""); // 清空平台选择
        setSelectedModel(""); // 清空模型选择
        setError(""); // 清除错误信息
      } else {
        setError("API Key 添加失败，请重试！");
      }
    } catch (err: any) {
      setError("出现错误，请稍后再试！");
      console.error(err);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-4">API Key 管理</h2>

      {loading && <p className="text-gray-500">加载中...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="mb-4">
        <label htmlFor="platform" className="block text-sm font-medium text-gray-700">选择平台</label>
        <select
          id="platform"
          className="w-full mt-2 p-2 border rounded"
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
        >
          <option value="">请选择平台</option>
          {platforms.map((platform) => (
            <option key={platform.platform} value={platform.platform}>
              {platform.platform}
            </option>
          ))}
        </select>
      </div>

      {selectedPlatform && (
        <div className="mb-4">
          <label htmlFor="model" className="block text-sm font-medium text-gray-700">选择模型</label>
          <select
            id="model"
            className="w-full mt-2 p-2 border rounded"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="">请选择模型</option>
            {platforms
              .find((platform) => platform.platform === selectedPlatform)
              ?.models.map((model: string) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">API Key</label>
        <input
          id="apiKey"
          className="w-full mt-2 p-2 border rounded"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <button
        onClick={handleAddApiKey}
        className="w-full py-2 bg-blue-500 text-white rounded"
        disabled={loading}
      >
        添加 API Key
      </button>

      <h3 className="mt-6 text-lg font-semibold">现有 API Keys</h3>
      {apiKeys.length === 0 ? (
        <p>您还没有添加任何 API Key。</p>
      ) : (
        <ul>
          {apiKeys.map((apiKey) => (
            <li key={apiKey.id} className="mt-2">
              {apiKey.platform} - {apiKey.model_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApiKeyManager;
