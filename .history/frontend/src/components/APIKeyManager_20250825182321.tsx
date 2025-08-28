// ApiKeyManager.tsx
import React, { useState, useEffect } from 'react';
import api from '../api'; // 引入全局API实例
import { toast } from 'react-toastify';

interface ApiKeyManagerProps {
  onConfigChange?: () => void; // 数据变化时触发的回调
}

// 匹配后端 AIModelResponse 结构（从关联表推导的平台/模型名称）
interface ApiKeyConfig {
  id: number;
  platform_name: string; // 从 Platform 表推导的平台名称
  model_name: string;    // 从 Model 表推导的模型名称
  api_key_mask: string;  // 脱敏后的API Key（后端返回）
  base_url?: string;     // 可选：用户自定义BaseURL
  created_at: string;    // 创建时间
}

// 匹配后端 AIModelCreate 结构（创建/编辑时提交的参数）
interface ApiKeyCreatePayload {
  model_id: number;      // 关键：关联系统 Model 表的ID
  api_key: string;       // 明文API Key（提交时加密存储）
  base_url?: string;     // 可选：用户自定义BaseURL
}

// 匹配后端 SystemModelResponse 结构（系统支持的模型列表）
interface SystemModel {
  model_id: number;
  name: string;          // 模型名称（如 gpt-3.5-turbo）
  platform_id: number;
  platform_name: string; // 关联平台名称（如 OpenAI）
  description?: string;  // 模型描述
  is_supported: boolean; // 是否支持公文生成
}// 定义模型详情类型（与后端 Model 表字段对应）
interface ModelDetail {
  model_id: number;          // 关键修正：后端返回的是数字ID（与数据库id对应）
  name: string;              // 模型名称（如 "gpt-3.5-turbo"）
  description?: string;      // 模型描述（来自后端description字段）
  is_supported: boolean;     // 是否支持公文生成（来自后端is_supported字段）
  platform_id: number;       // 所属平台ID
  platform_name: string;     // 所属平台名称（关联Platform表）
}

// 平台模型响应类型（与后端PlatformModelResponse对应）
interface PlatformModelResponse {
  platform_id: number;       // 平台ID
  platform: string;          // 平台名称（如 "OpenAI"）
  base_url?: string | null;  // 平台默认BaseURL
  is_active: boolean;        // 平台是否启用
  models: string[];          // 模型名称列表（简化展示用）
  model_details?: ModelDetail[] | null;  // 详细模型信息
}
const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onConfigChange }) => {
  const [apiKeyConfigs, setApiKeyConfigs] = useState<ApiKeyConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ApiKeyConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemModels, setSystemModels] = useState<SystemModel[]>([]); // 系统支持的模型列表

  // 编辑/新增表单状态（匹配 AIModelCreate 结构）
  const [formState, setFormState] = useState<ApiKeyCreatePayload & {
    model_name: string; // 临时存储：用于表单显示选中的模型名称
    platform_name: string; // 临时存储：用于表单显示选中的平台名称
  }>({
    model_id: 0,
    api_key: '',
    base_url: '',
    model_name: '',
    platform_name: ''
  });


  const initData = async () => {
    setLoading(true);
    try {
      // 并行请求：修正API配置列表路径（配合后端 /keys 接口）
      // 原：api.get<ApiKeyConfig[]>('/api/keys')
      const [configsRes, platformsRes] = await Promise.all([
        api.get<ApiKeyConfig[]>('/api/keys'),  // 后端调整后实际路径：/api/keys（正确）
        api.get<PlatformModelResponse[]>('/api/platforms')  // 先请求平台列表，获取platform_id
      ]);
      
      // 处理平台列表，提取所有支持的模型（替代原错误的 /api/platforms/models 请求）
      const allModels: SystemModel[] = [];
      for (const platform of platformsRes.data) {
        // 按平台ID请求模型列表（调用后端正确接口 /platforms/{platform_id}/models）
        const modelsRes = await api.get<SystemModel[]>(
          `/api/platforms/${platform.platform_id}/models`
        );
        allModels.push(...modelsRes.data);
      }
      
      // 存储用户配置和系统模型
      setApiKeyConfigs(configsRes.data);
      setSystemModels(allModels);  // 存储所有平台的模型
      if (configsRes.data.length > 0) {
        setCurrentConfig(configsRes.data[0]);
      }
    } catch (error) {
      console.error("初始化API配置失败:", error);
      toast.error("加载配置失败：请刷新页面重试");
    } finally {
      setLoading(false);
    }
  };

// ----------------- 修正“加载平台下模型”的请求路径 -----------------
const fetchModelsByPlatform = async (platformId: number) => {
  try {
    // 原：api.get<SystemModel[]>(`/api/platforms/${platformId}/models`)
    const res = await api.get<SystemModel[]>(
      `/api/platforms/${platformId}/models`  // 正确路径：配合后端 /platforms/{platform_id}/models
    );
    return res.data.filter(model => model.is_supported);
  } catch (error) {
    console.error(`获取平台${platformId}模型失败:`, error);
    toast.error("加载模型列表失败");
    return [];
  }
};

  useEffect(() => {
    initData();
  }, []);

  // 3. 表单输入变更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));

    // 若选择模型ID，自动填充平台和模型名称
    if (name === "model_id" && value) {
      const selectedModel = systemModels.find(model => model.model_id === Number(value));
      if (selectedModel) {
        setFormState(prev => ({
          ...prev,
          platform_name: selectedModel.platform_name,
          model_name: selectedModel.name
        }));
      }
    }
  };

  // 4. 选择配置（切换当前使用的模型）
  const handleSelectConfig = (config: ApiKeyConfig) => {
    setCurrentConfig(config);
    toast.info(`已选择模型：${config.platform_name} - ${config.model_name}`);
  };

  // 5. 编辑配置（加载当前配置到表单）
  const handleEdit = () => {
    if (!currentConfig) {
      toast.warning("请先选择一个配置进行编辑");
      return;
    }

    // 查找当前配置对应的系统模型ID
    const matchedModel = systemModels.find(
      model => model.platform_name === currentConfig.platform_name && model.name === currentConfig.model_name
    );

    if (!matchedModel) {
      toast.error("当前配置的模型已不支持，请重新选择");
      return;
    }

    // 加载当前配置到表单
    setFormState({
      model_id: matchedModel.model_id,
      api_key: '', // 编辑时不回显明文API Key
      base_url: currentConfig.base_url || '',
      platform_name: currentConfig.platform_name,
      model_name: currentConfig.model_name
    });

    setIsEditing(true);
  };

  // 6. 取消编辑
  const handleCancel = () => {
    setIsEditing(false);
    setFormState({
      model_id: 0,
      api_key: '',
      base_url: '',
      model_name: '',
      platform_name: ''
    });
  };

  // 7. 保存编辑（PUT /api/keys/{id}）
  const handleSave = async () => {
    if (!currentConfig) return;
    // 表单校验
    if (!formState.model_id) {
      toast.warning("请选择系统支持的模型");
      return;
    }
    if (!formState.api_key.trim()) {
      toast.warning("请输入API Key");
      return;
    }

    setLoading(true);
    try {
      const res = await api.put<ApiKeyConfig>(`/api/keys/${currentConfig.id}`, {
        model_id: formState.model_id,
        api_key: formState.api_key,
        base_url: formState.base_url || undefined
      });

      // 更新配置列表
      const updatedConfigs = apiKeyConfigs.map(config => 
        config.id === currentConfig.id ? res.data : config
      );
      setApiKeyConfigs(updatedConfigs);
      setCurrentConfig(res.data);
      setIsEditing(false);
      toast.success("配置更新成功");
      onConfigChange && onConfigChange();
    } catch (error) {
      console.error("更新API配置失败:", error);
      toast.error("更新失败：API Key无效或权限不足");
    } finally {
      setLoading(false);
    }
  };

  // 8. 新增配置（POST /api/keys）
  const handleAddNew = async () => {
    // 表单校验
    if (!formState.model_id) {
      toast.warning("请选择系统支持的模型");
      return;
    }
    if (!formState.api_key.trim()) {
      toast.warning("请输入API Key");
      return;
    }

    // 校验是否已配置该模型
    const isDuplicate = apiKeyConfigs.some(
      config => config.platform_name === formState.platform_name && config.model_name === formState.model_name
    );
    if (isDuplicate) {
      toast.warning(`已配置「${formState.platform_name} - ${formState.model_name}」，无需重复添加`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<ApiKeyConfig>('/api/keys', {
        model_id: formState.model_id,
        api_key: formState.api_key,
        base_url: formState.base_url || undefined
      });

      // 添加到配置列表
      const newConfigs = [...apiKeyConfigs, res.data];
      setApiKeyConfigs(newConfigs);
      setCurrentConfig(res.data);
      setIsEditing(false);
      // 重置表单
      setFormState({
        model_id: 0,
        api_key: '',
        base_url: '',
        model_name: '',
        platform_name: ''
      });
      toast.success("配置新增成功");
      onConfigChange && onConfigChange();
    } catch (error) {
      console.error("新增API配置失败:", error);
      toast.error("新增失败：API Key无效或系统不支持该模型");
    } finally {
      setLoading(false);
    }
  };

  // 9. 删除配置（DELETE /api/keys/{id}）
  const handleDelete = async (id: number, platformName: string, modelName: string) => {
    if (!confirm(`确认删除「${platformName} - ${modelName}」的API配置？`)) return;

    // 校验是否正在使用该配置
    if (currentConfig?.id === id) {
      toast.warning("无法删除当前正在使用的配置，请先切换其他配置");
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/api/keys/${id}`);
      
      // 更新配置列表
      const updatedConfigs = apiKeyConfigs.filter(config => config.id !== id);
      setApiKeyConfigs(updatedConfigs);
      // 若删除后无配置，清空当前选择
      if (updatedConfigs.length === 0) {
        setCurrentConfig(null);
      } else if (currentConfig?.id === id) {
        // 若删除的是之前选中的配置，切换到第一个
        setCurrentConfig(updatedConfigs[0]);
      }

      toast.success("配置删除成功");
      onConfigChange && onConfigChange();
    } catch (error) {
      console.error("删除API配置失败:", error);
      toast.error("删除失败：该配置正在被会话使用");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 标题区域 */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">API 配置管理</h3>
        
        {/* 当前配置 + 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!loading && currentConfig ? (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">当前使用：</span>
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {currentConfig.platform_name} - {currentConfig.model_name}
              </span>
              <button
                onClick={handleEdit}
                className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                编辑
              </button>
            </div>
          ) : (
            <span className="text-sm text-slate-500">未选择API配置</span>
          )}

          {/* 新增按钮 */}
          <button
            onClick={() => {
              setFormState({
                model_id: 0,
                api_key: '',
                base_url: '',
                model_name: '',
                platform_name: ''
              });
              setIsEditing(true);
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            disabled={loading}
          >
            新增配置
          </button>
        </div>
      </div>

      {/* 编辑/新增表单 */}
      {isEditing && (
        <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-4">
          <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            {formState.model_id ? '编辑配置' : '新增配置'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 平台选择（联动模型） */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                AI 平台
              </label>
              <select
                name="platform_id"
                onChange={async (e) => {
                  const platformId = Number(e.target.value);
                  const models = await fetchModelsByPlatform(platformId);
                  setSystemModels(models);
                  // 重置模型选择
                  setFormState(prev => ({
                    ...prev,
                    model_id: 0,
                    model_name: '',
                    platform_name: models[0]?.platform_name || ''
                  }));
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">选择平台</option>
                {/* 去重获取所有平台 */}
                {Array.from(new Set(systemModels.map(m => m.platform_id))).map(platformId => {
                  const platform = systemModels.find(m => m.platform_id === platformId);
                  return platform ? (
                    <option key={platformId} value={platformId}>
                      {platform.platform_name}
                    </option>
                  ) : null;
                })}
              </select>
            </div>

            {/* 模型选择（依赖平台） */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                AI 模型
              </label>
              <select
                name="model_id"
                value={formState.model_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
                required
              >
                <option value="">选择模型</option>
                {systemModels.map(model => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.name} {model.description ? `(${model.description})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key 输入 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                API Key
                <span className="ml-2 text-xs text-slate-500">（输入后将加密存储）</span>
              </label>
              <input
                type="password" // 密码类型隐藏输入
                name="api_key"
                value={formState.api_key}
                onChange={handleInputChange}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
                required
              />
            </div>

            {/* 自定义 BaseURL（可选） */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                自定义 BaseURL（可选）
                <span className="ml-2 text-xs text-slate-500">（默认使用平台官方地址）</span>
              </label>
              <input
                type="text"
                name="base_url"
                value={formState.base_url}
                onChange={handleInputChange}
                placeholder="如：https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
          
          {/* 表单操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded text-sm hover:bg-slate-300 transition-colors dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={formState.model_id && apiKeyConfigs.some(c => c.id === currentConfig?.id) ? handleSave : handleAddNew}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              {loading ? '处理中...' : (formState.model_id && apiKeyConfigs.some(c => c.id === currentConfig?.id) ? '保存修改' : '新增配置')}
            </button>
          </div>
        </div>
      )}

      {/* 已有配置列表 */}
      <div className="space-y-3">
        <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200">已有API配置</h4>
        
        {loading ? (
          <div className="flex justify-center items-center h-20">
            <p className="text-slate-500">加载配置列表中...</p>
          </div>
        ) : apiKeyConfigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
            <p className="text-slate-500 mb-2">暂无API配置</p>
            <p className="text-sm text-slate-400">点击「新增配置」添加AI模型密钥</p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    平台
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    模型名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    API Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    BaseURL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {apiKeyConfigs.map((config) => (
                  <tr 
                    key={config.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      currentConfig?.id === config.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">
                      {config.platform_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">
                      {config.model_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {config.api_key_mask}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {config.base_url || <span className="text-slate-400">默认</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                      {new Date(config.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {currentConfig?.id === config.id && (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          正在使用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleSelectConfig(config)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                      >
                        选择
                      </button>
                      <button
                        onClick={() => handleDelete(config.id, config.platform_name, config.model_name)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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