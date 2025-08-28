// ApiKeyManager.tsx
import React, { useState, useEffect } from 'react';
interface ApiKeyManagerProps {
  onConfigChange?: () => void; // 数据变化时触发的回调
}
// 注意：后续需根据你贴的 AIModelCreate 结构调整字段名（如 model → model_name，apiKey → api_key）
interface ApiKeyConfig {
  id: string;
  model_name: string; // 若后端需要 model_name，后续改为 model_name
  platform: string;
  api_key: string; // 若后端需要 api_key，后续改为 api_key
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onConfigChange }) => {
  const [apiKeyConfigs, setApiKeyConfigs] = useState<ApiKeyConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ApiKeyConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newConfig, setNewConfig] = useState<ApiKeyConfig>({
    id: '',
    model_name: '',
    platform_name: '',
    api_key: '',
  });
  const [loading, setLoading] = useState(false); // 统一加载状态

  // 1. 加载 API 配置（保留内部请求，HomePage 不再重复请求）
  const fetchApiKeyConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) throw new Error('加载 API 配置失败');
      const data = await response.json();
      setApiKeyConfigs(data);
      if (data.length > 0) setCurrentConfig(data[0]);
    } catch (error) {
      console.error(error);
      alert('加载 API 配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeyConfigs();
  }, []);

  // 2. 输入变更（后续字段名需按后端调整）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewConfig(prev => ({ ...prev, [name]: value }));
  };

  // 3. 选择配置
  const handleSelectConfig = (config: ApiKeyConfig) => {
    setCurrentConfig(config);
  };

  // 4. 编辑配置
  const handleEdit = () => {
    if (currentConfig) {
      setNewConfig(currentConfig);
      setIsEditing(true);
    }
  };

  // 5. 取消编辑
  const handleCancel = () => {
    setIsEditing(false);
    setNewConfig({ id: '', model_name: '', platform: '', api_key: '' });
  };

  // 保存编辑
  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/keys/${newConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig), 
      });
      if (!response.ok) throw new Error('保存配置失败');
      const updated = await response.json();
      setApiKeyConfigs(apiKeyConfigs.map(c => c.id === updated.id ? updated : c));
      setCurrentConfig(updated);
      setIsEditing(false);
      alert('保存成功');
      if (onConfigChange) onConfigChange();
    } catch (error) {
      console.error(error);
      alert('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig), // 若后端需 model_name/api_key，此处需改字段
      });
      if (!response.ok) throw new Error('添加配置失败');
      const added = await response.json();
      setApiKeyConfigs([...apiKeyConfigs, added]);
      setCurrentConfig(added);
      setIsEditing(false);
      alert('新增成功');
      if (onConfigChange) onConfigChange();
    } catch (error) {
      console.error(error);
      alert('添加配置失败');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该 API 配置？')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('删除配置失败');
      const updatedConfigs = apiKeyConfigs.filter(c => c.id !== id);
      setApiKeyConfigs(updatedConfigs);
      // 若删除的是当前配置，自动切换到第一个（或清空）
      setCurrentConfig(updatedConfigs.length > 0 ? updatedConfigs[0] : null);
      alert('删除成功');
      if (onConfigChange) onConfigChange();
    } catch (error) {
      console.error(error);
      alert('删除配置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* 右上角：当前配置显示 + 新增/编辑按钮（核心样式调整） */}
      <div className="flex justify-between items-center mb-6">
        {/* 左侧：标题 */}
        <h3 className="text-lg font-semibold">API 配置管理</h3>
        
        {/* 右侧：当前配置 + 操作按钮（右上角核心区域） */}
        <div className="flex items-center gap-4">
          {!loading && currentConfig ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <span className="text-sm">当前模型：</span>
              <span className="font-medium">{currentConfig.model}</span>
              <span className="text-xs text-gray-500">（{currentConfig.platform}）</span>
              <button
                onClick={handleEdit}
                className="ml-2 text-xs px-2 py-1 bg-blue-600 text-white rounded"
              >
                编辑
              </button>
            </div>
          ) : (
            <span className="text-sm text-gray-500">未选择配置</span>
          )}

          {/* 新增按钮：始终显示 */}
          <button
            onClick={() => {
              setNewConfig({ id: '', model: '', platform: '', apiKey: '' });
              setIsEditing(true);
            }}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded"
          >
            新增配置
          </button>
        </div>
      </div>

      {/* 编辑/新增表单（展开时显示，占满宽度） */}
      {isEditing && (
        <div className="p-4 mb-6 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <h4 className="text-base font-medium mb-3">
            {newConfig.id ? '编辑配置' : '新增配置'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1">平台</label>
              <input
                type="text"
                name="platform"
                value={newConfig.platform}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded dark:bg-slate-800 dark:border-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">模型名</label>
              <input
                type="text"
                name="model" // 若后端需 model_name，改为 name="model_name"
                value={newConfig.model}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded dark:bg-slate-800 dark:border-slate-600"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">API Key</label>
              <input
                type="text"
                name="apiKey" // 若后端需 api_key，改为 name="api_key"
                value={newConfig.apiKey}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded dark:bg-slate-800 dark:border-slate-600"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 bg-gray-300 dark:bg-slate-600 rounded text-sm"
            >
              取消
            </button>
            <button
              onClick={newConfig.id ? handleSave : handleAddNew}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm"
            >
              {loading ? '处理中...' : (newConfig.id ? '保存' : '新增')}
            </button>
          </div>
        </div>
      )}

      {/* 已有配置列表（带删除按钮） */}
      <div>
        <h4 className="text-base font-medium mb-3">已有配置</h4>
        {loading ? (
          <p className="text-sm text-gray-500">加载中...</p>
        ) : apiKeyConfigs.length === 0 ? (
          <p className="text-sm text-gray-500">暂无 API 配置，请点击「新增配置」添加</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    模型名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    平台
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Key（隐藏）
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {apiKeyConfigs.map((config) => (
                  <tr key={config.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{config.model}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{config.platform}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-400">********{config.apiKey.slice(-4)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {currentConfig?.id === config.id && (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          当前使用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleSelectConfig(config)}
                        className="text-blue-500 hover:text-blue-700 mr-3"
                      >
                        选择
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyManager;