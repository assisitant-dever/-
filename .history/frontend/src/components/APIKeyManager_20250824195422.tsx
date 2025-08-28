import React, { useState, useEffect } from 'react';

interface ApiKeyConfig {
  id: string;
  model: string;
  platform: string;
  apiKey: string;
}

const ApiKeyManager: React.FC = () => {
  const [apiKeyConfigs, setApiKeyConfigs] = useState<ApiKeyConfig[]>([]); // 存储用户的API配置
  const [currentConfig, setCurrentConfig] = useState<ApiKeyConfig | null>(null); // 当前选中的配置
  const [isEditing, setIsEditing] = useState(false); // 控制表单的显示
  const [newConfig, setNewConfig] = useState<ApiKeyConfig>({
    id: '',
    model: '',
    platform: '',
    apiKey: '',
  });

  useEffect(() => {
    const fetchApiKeyConfigs = async () => {
      try {
        const response = await fetch('/api/keys');
        if (!response.ok) {
          throw new Error('加载 API 配置失败');
        }
        const data = await response.json();
        setApiKeyConfigs(data);
        // 默认设置当前配置为第一个配置
        if (data.length > 0) {
          setCurrentConfig(data[0]);
        }
      } catch (error) {
        console.error(error);
        alert('加载失败');
      }
    };

  fetchApiKeyConfigs();
}, []);
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setNewConfig(prevConfig => ({
    ...prevConfig,
    [name]: value,
  }));
};


  const handleSelectConfig = (config: ApiKeyConfig) => {
    setCurrentConfig(config);
  };

  const handleEdit = () => {
    if (currentConfig) {
      setNewConfig(currentConfig);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewConfig({
      id: '',
      model: '',
      platform: '',
      apiKey: '',
    });
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/keys/${newConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('保存配置失败');
      }

      const updatedConfig = await response.json();
      const updatedConfigs = apiKeyConfigs.map((config) =>
        config.id === updatedConfig.id ? updatedConfig : config
      );
      setApiKeyConfigs(updatedConfigs);
      setCurrentConfig(updatedConfig);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert('保存配置失败');
    }
  };

  const handleAddNew = async () => {
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('添加配置失败');
      }

      const addedConfig = await response.json();
      setApiKeyConfigs([...apiKeyConfigs, addedConfig]);
      setCurrentConfig(addedConfig);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert('添加配置失败');
    }
  };


  return (
    <div className="p-4 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-semibold">API 配置管理</h2>

      {/* 显示当前选择的配置 */}
      {!isEditing && currentConfig ? (
        <div>
          <div className="mt-4">
            <p><strong>当前配置:</strong></p>
            <p>模型名: {currentConfig.model}</p>
            <p>平台: {currentConfig.platform}</p>
            <p>API Key: {currentConfig.apiKey}</p>
          </div>
          <button
            className="mt-4 p-2 bg-blue-600 text-white rounded"
            onClick={handleEdit}
          >
            编辑配置
          </button>
        </div>
      ) : (
        // 配置编辑表单
        <div className="mt-4">
          <div>
            <label className="block">选择模型</label>
            <input
              type="text"
              className="w-full p-2 mt-2 border rounded"
              value={newConfig.model}
              onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })}
            />
          </div>

          <div className="mt-4">
            <label className="block">选择平台</label>
            <input
              type="text"
              className="w-full p-2 mt-2 border rounded"
              value={newConfig.platform}
              onChange={(e) => setNewConfig({ ...newConfig, platform: e.target.value })}
            />
          </div>

          <div className="mt-4">
            <label className="block">API Key</label>
            <input
              type="text"
              className="w-full p-2 mt-2 border rounded"
              value={newConfig.apiKey}
              onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })}
            />
          </div>

          <div className="mt-4 flex justify-between">
            <button
              className="p-2 bg-gray-300 text-black rounded"
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              className="p-2 bg-blue-600 text-white rounded"
              onClick={newConfig.id ? handleSave : handleAddNew}
            >
              {newConfig.id ? '保存配置' : '添加新配置'}
            </button>
          </div>
        </div>
      )}

      {/* 配置选择列表 */}
      <div className="mt-6">
        <h3 className="font-semibold">已有配置</h3>
        <ul>
          {apiKeyConfigs.map((config) => (
            <li
              key={config.id}
              className="mt-2 flex justify-between items-center cursor-pointer"
              onClick={() => handleSelectConfig(config)}
            >
              <div>
                <p>{config.model}</p>
                <p className="text-sm text-gray-500">{config.platform}</p>
              </div>
              {currentConfig?.id === config.id && (
                <span className="text-green-500">当前配置</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ApiKeyManager;
