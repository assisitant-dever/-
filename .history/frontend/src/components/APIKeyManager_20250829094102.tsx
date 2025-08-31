// ApiKeyManager.tsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'react-toastify';

interface ApiKeyManagerProps {
  onConfigChange?: () => void;
}

interface ApiKeyConfig {
  id: number;
  platform_name: string;
  model_name: string;
  api_key_mask: string;
  base_url?: string;
  created_at: string;
  model_id: number
}

interface ApiKeyCreatePayload {
  model_id: number;
  api_key: string;
  base_url?: string;
}

interface ModelDetail {
  model_id: number;
  name: string;
  description?: string;
  is_supported: boolean;
  platform_id: number;
  platform_name: string;
}

interface PlatformModelResponse {
  platform_id: number;
  platform: string;
  base_url?: string | null;
  is_active: boolean;
  models: string[];
  model_details?: ModelDetail[] | null;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onConfigChange }) => {
  const [apiKeyConfigs, setApiKeyConfigs] = useState<ApiKeyConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ApiKeyConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemModels, setSystemModels] = useState<ModelDetail[]>([]);
  const [platformList, setPlatformList] = useState<PlatformModelResponse[]>([]);

  // 表单状态
const [formState, setFormState] = useState<{
  model_id?: number;
  api_key: string;
  base_url?: string;
  platform_name: string;
  model_name: string;
  custom_platform_name?: string;
  custom_model_name?: string;
}>({
  model_id: undefined,
  api_key: '',
  base_url: '',
  platform_name: '',
  model_name: ''
});


  useEffect(() => { initData(); }, []);

  const initData = async () => {
    setLoading(true);
    try {
      const [configsRes, platformsRes] = await Promise.all([
        api.get<ApiKeyConfig[]>('/api/keys'),
        api.get<PlatformModelResponse[]>('/api/platforms?include_details=true')
      ]);
      setApiKeyConfigs(configsRes.data);
      const activePlatforms = platformsRes.data.filter(p => p.is_active);
      setPlatformList(activePlatforms);
      if (activePlatforms.length > 0 && activePlatforms[0].model_details) {
        setSystemModels(activePlatforms[0].model_details);
      }
    } catch (error) {
      console.error(error);
      toast.error("加载配置失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));

    if (name === "model_id" && value) {
      const selectedModel = systemModels.find(m => m.model_id === Number(value));
      if (selectedModel) {
        setFormState(prev => ({
          ...prev,
          platform_name: selectedModel.platform_name,
          model_name: selectedModel.name,
          custom_model_name: ''
        }));
      }
    }

    if (name === "platform_id" && value) {
      const selectedPlatform = platformList.find(p => p.platform_id === Number(value));
      if (selectedPlatform) {
        fetchModelsByPlatform(selectedPlatform.platform_id).then(models => setSystemModels(models));
        setFormState(prev => ({
          ...prev,
          platform_name: selectedPlatform.platform,
          model_id: 0,
          model_name: '',
          custom_platform_name: ''
        }));
      }
    }
  };

  const fetchModelsByPlatform = async (platformId: number) => {
    const platformFromList = platformList.find(p => p.platform_id === platformId);
    if (platformFromList && platformFromList.model_details) {
      return platformFromList.model_details.filter(m => m.is_supported);
    }
    try {
      const res = await api.get<PlatformModelResponse>(`/api/platforms/${platformId}?include_details=true`);
      if (!res.data.is_active) {
        toast.warning("该平台已禁用");
        return [];
      }
      return res.data.model_details?.filter(m => m.is_supported) || [];
    } catch (error) {
      toast.error("加载模型失败");
      return [];
    }
  };

  const handleSelectConfig = (config: ApiKeyConfig) => {
    setCurrentConfig(config);
    toast.info(`已选择模型：${config.platform_name} - ${config.model_name}`);
  };

  const handleEdit = () => {
    if (!currentConfig) return toast.warning("请先选择配置");

    setFormState({
      model_id: currentConfig.model_id,  // 正确使用 model_id
      api_key: '',  // 编辑时初始化为空，不显示原密钥
      base_url: currentConfig.base_url || '',
      platform_name: currentConfig.platform_name,
      model_name: currentConfig.model_name,
      custom_model_name: '',
      custom_platform_name: ''
    });

  setIsEditing(true);
};
  const handleCancel = () => {
    setIsEditing(false);
    setFormState({
      model_id: 0,
      api_key: '',
      base_url: '',
      model_name: '',
      platform_name: '',
      custom_model_name: '',
      custom_platform_name: ''
    });
  };

  const handleSaveOrAdd = async () => {
    // 1. 基础校验：新增时必须输入 API Key；编辑时可选（空则不更新）
    if (!currentConfig && !formState.api_key.trim()) {
      toast.warning("新增配置必须输入 API Key");
      return;
    }

    // 2. 初始化 payload：仅包含必传/可选字段，避免冗余
    const payload: Record<string, any> = {};

    // 3. API Key 处理：仅当用户输入了新密钥时才传递（编辑时空则不传，保留原密钥）
    if (formState.api_key.trim()) {
      payload.api_key = formState.api_key;
    }

    // 4. BaseURL 处理：空则传 undefined（后端若有默认值会使用）
    if (formState.base_url?.trim()) {
      payload.base_url = formState.base_url.trim();
    } else {
      payload.base_url = undefined;
    }

    // 5. 模型类型区分：系统模型（传 model_id）vs 自定义模型（传 platform_name + model_name）
    const isSystemModel = formState.model_id && formState.model_id !== 0;
    const customPlatform = formState.custom_platform_name?.trim();
    const customModel = formState.custom_model_name?.trim();

    if (isSystemModel) {
      // 场景1：选择系统模型 → 仅传 model_id（后端自动关联平台/模型名称）
      payload.model_id = formState.model_id;
    } else {
      // 场景2：自定义模型 → 必须传平台和模型名称（新增/编辑都需校验）
      if (!customPlatform || !customModel) {
        toast.warning("自定义配置必须输入平台名称和模型名称");
        return;
      }
      payload.platform_name = customPlatform;
      payload.model_name = customModel;
    }

    // 6. 发送请求（区分新增 POST / 编辑 PUT）
    setLoading(true);
    try {
      const requestConfig = {
        url: currentConfig ? `/api/keys/${currentConfig.id}` : "/api/keys",
        method: currentConfig ? "put" : "post",
        data: payload, // 仅传递处理后的 payload，无冗余字段
      };

      const res = await api(requestConfig);

      // 7. 更新前端状态：刷新列表、切换选中配置、关闭编辑态
      const updatedConfigs = currentConfig
        ? apiKeyConfigs.map((c) => (c.id === currentConfig.id ? res.data : c))
        : [...apiKeyConfigs, res.data];
      setApiKeyConfigs(updatedConfigs);
      setCurrentConfig(res.data);
      setIsEditing(false);
      toast.success(currentConfig ? "配置更新成功" : "配置新增成功");
      onConfigChange && onConfigChange();
    } catch (error: any) {
      console.error("操作失败详情：", error);
      // 优先显示后端返回的错误信息，无则用默认提示
      const errorMsg = error.response?.data?.detail || "操作失败，请检查参数后重试";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (id: number, platformName: string, modelName: string) => {
    if (!confirm(`确认删除「${platformName} - ${modelName}」吗？`)) return;
    if (currentConfig?.id === id) return toast.warning("无法删除正在使用的配置");
    setLoading(true);
    try {
      await api.delete(`/api/keys/${id}`);
      const updatedConfigs = apiKeyConfigs.filter(c => c.id !== id);
      setApiKeyConfigs(updatedConfigs);
      if (updatedConfigs.length === 0) setCurrentConfig(null);
      else if (currentConfig?.id === id) setCurrentConfig(updatedConfigs[0]);
      toast.success("删除成功");
    } catch (error) {
      toast.error("删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">API 配置管理</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {!loading && currentConfig ? (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">当前使用：</span>
              <span className="font-medium text-blue-700 dark:text-blue-300">{currentConfig.platform_name} - {currentConfig.model_name}</span>
              <button onClick={handleEdit} className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">编辑</button>
            </div>
          ) : (
            <span className="text-sm text-slate-500">未选择API配置</span>
          )}
          <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors" disabled={loading}>新增配置</button>
        </div>
      </div>

      {/* 编辑/新增表单 */}
      {isEditing && (
        <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-4">
          <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200">{currentConfig ? '编辑配置' : '新增配置'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 平台输入/选择 */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">AI 平台</label>
              <input
                type="text"
                name="custom_platform_name"
                value={formState.custom_platform_name || formState.platform_name}
                onChange={(e) => setFormState(prev => ({
                  ...prev,
                  custom_platform_name: e.target.value,
                  platform_name: '',
                  model_id: 0,
                  model_name: ''
                }))}
                placeholder="输入平台名称"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              />
              <select
                name="platform_id"
                value={formState.model_id}
                onChange={handleInputChange}
                className="w-full mt-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">选择已有平台</option>
                {platformList.map(p => (
                  <option key={p.platform_id} value={p.platform_id}>{p.platform}</option>
                ))}
              </select>
            </div>

            {/* 模型输入/选择 */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">AI 模型</label>
              <input
                type="text"
                name="custom_model_name"
                value={formState.custom_model_name || formState.model_name}
                onChange={(e) => setFormState(prev => ({
                  ...prev,
                  custom_model_name: e.target.value,
                  model_id: 0,
                  model_name: ''
                }))}
                placeholder="输入模型名称"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              />
              <select
                name="model_id"
                value={formState.model_id}
                onChange={handleInputChange}
                className="w-full mt-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">选择已有模型</option>
                {systemModels.map(m => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.name} {m.description ? `(${m.description})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">API Key</label>
              <input type="password" name="api_key" value={formState.api_key} onChange={handleInputChange} placeholder="sk-xxxxxxxx" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200" />
            </div>

            {/* BaseURL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">自定义 BaseURL（可选）</label>
              <input type="text" name="base_url" value={formState.base_url} onChange={handleInputChange} placeholder="https://api.openai.com/v1" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={handleCancel} className="px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500" disabled={loading}>取消</button>
            <button onClick={handleSaveOrAdd} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{loading ? '处理中...' : currentConfig ? '保存修改' : '新增配置'}</button>
          </div>
        </div>
      )}

      {/* 配置列表 */}
      <div className="space-y-3">
        <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200">已有API配置</h4>
        {loading ? (
          <p className="text-slate-500">加载中...</p>
        ) : apiKeyConfigs.length === 0 ? (
          <p className="text-slate-500">暂无API配置</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left">平台</th>
                <th className="px-4 py-2 text-left">模型名称</th>
                <th className="px-4 py-2 text-left">API Key</th>
                <th className="px-4 py-2 text-left">BaseURL</th>
                <th className="px-4 py-2 text-left">创建时间</th>
                <th className="px-4 py-2 text-left">状态</th>
                <th className="px-4 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {apiKeyConfigs.map(config => (
                <tr key={config.id} className="hover:bg-slate-100 dark:hover:bg-slate-700">
                  <td className="px-4 py-2">{config.platform_name}</td>
                  <td className="px-4 py-2">{config.model_name}</td>
                  <td className="px-4 py-2">{config.api_key_mask}</td>
                  <td className="px-4 py-2">{config.base_url || '默认'}</td>
                  <td className="px-4 py-2">{new Date(config.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{currentConfig?.id === config.id && <span className="text-green-600 dark:text-green-400 font-medium">正在使用</span>}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button onClick={() => handleSelectConfig(config)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors">选择</button>
                    <button onClick={() => handleDelete(config.id, config.platform_name, config.model_name)} className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ApiKeyManager;
