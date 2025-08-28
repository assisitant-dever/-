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
    <div className="api-key-manager">
      <h2>API Key 管理</h2>

      {loading && <p>加载中...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div>
        <label htmlFor="platform">选择平台：</label>
        <select
          id="platform"
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
        <div>
          <label htmlFor="model">选择模型：</label>
          <select
            id="model"
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

      <div>
        <label htmlFor="apiKey">API Key：</label>
        <input
          id="apiKey"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <button onClick={handleAddApiKey} disabled={loading}>
        添加 API Key
      </button>

      <h3>现有 API Keys</h3>
      {apiKeys.length === 0 ? (
        <p>您还没有添加任何 API Key。</p>
      ) : (
        <ul>
          {apiKeys.map((apiKey) => (
            <li key={apiKey.id}>
              {apiKey.platform} - {apiKey.model_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApiKeyManager;
