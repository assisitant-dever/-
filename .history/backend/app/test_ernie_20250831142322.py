import requests
import json
from typing import Iterator

def get_ernie_client(api_key: str, secret_key: str, model: str = "ernie-bot-4"):
    """创建文心一言客户端（封装核心请求逻辑，对齐官方文档）"""
    class ErnieQuickClient:
        def __init__(self, ak: str, sk: str, model: str):
            self.ak = ak  # 百度云API Key
            self.sk = sk  # 百度云Secret Key
            self.model = model  # 模型名（默认旗舰版ernie-bot-4）
            # 官方文档指定的接口地址（非流式+流式）
            self.non_stream_url = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions"
            self.stream_url = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/stream_completions"
            self.session = requests.Session()  # 复用连接

        def _get_auth_url(self, base_url: str) -> str:
            """按官方文档生成带认证参数的URL（ak/sk拼接到URL）"""
            return f"{base_url}?api_key={self.ak}&secret_key={self.sk}"

        def non_stream_generate(self, prompt: str, system_prompt: str = "你是一个 helpful 的助手。") -> str:
            """非流式调用（全量返回结果，适合快速验证）"""
            # 1. 构造官方文档要求的请求体
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7  # 官方默认推荐值
            }
            # 2. 发送请求
            auth_url = self._get_auth_url(self.non_stream_url)
            headers = {"Content-Type": "application/json"}
            try:
                response = self.session.post(
                    auth_url, headers=headers, data=json.dumps(payload), timeout=30
                )
                response.raise_for_status()  # 抛出HTTP错误（如404、500）
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"请求发送失败：{str(e)}") from e

            # 3. 按官方文档解析响应（优先处理错误）
            result = response.json()
            if "error_code" in result and result["error_code"] != 0:
                error_msg = result.get("error_msg", "未知错误")
                raise RuntimeError(f"API调用失败（错误码：{result['error_code']}）：{error_msg}")
            return result.get("result", "无返回内容").strip()

        def stream_generate(self, prompt: str, system_prompt: str = "你是一个 helpful 的助手。") -> Iterator[str]:
            """流式调用（分段返回，模拟实时交互）"""
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
            auth_url = self._get_auth_url(self.stream_url)
            headers = {"Content-Type": "application/json"}
            try:
                with self.session.post(
                    auth_url, headers=headers, data=json.dumps(payload), stream=True, timeout=60
                ) as response:
                    response.raise_for_status()
                    # 解析官方SSE格式（每行前缀"data:"）
                    for line in response.iter_lines(decode_unicode=True):
                        if not line:
                            continue
                        sse_data = line.lstrip("data: ").strip()
                        if not sse_data:
                            continue
                        # 解析单条流式片段
                        chunk = json.loads(sse_data)
                        if "error_code" in chunk and chunk["error_code"] != 0:
                            raise RuntimeError(f"流式错误（{chunk['error_code']}）：{chunk['error_msg']}")
                        # 提取有效内容并返回
                        content = chunk.get("result", "").strip()
                        if content:
                            yield content
                        # 官方结束标志：is_end=true
                        if chunk.get("is_end", False):
                            break
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"流式请求失败：{str(e)}") from e

    return ErnieQuickClient(api_key, secret_key, model)


# -------------------------- 以下为测试入口 --------------------------
if __name__ == "__main__":
    # 1. 请替换为你的百度云API Key和Secret Key（从控制台获取）
    YOUR_BAIDU_API_KEY = "替换为你的API Key"
    YOUR_BAIDU_SECRET_KEY = "替换为你的Secret Key"

    # 2. 初始化客户端（默认使用ernie-bot-4，可改为ernie-bot/ernie-bot-turbo）
    try:
        client = get_ernie_client(
            api_key=YOUR_BAIDU_API_KEY,
            secret_key=YOUR_BAIDU_SECRET_KEY,
            model="ernie-bot-4"
        )
        print("✅ 客户端初始化成功！")
    except Exception as e:
        print(f"❌ 客户端初始化失败：{str(e)}")
        exit(1)

    # 3. 测试非流式调用（快速验证核心功能）
    print("\n=== 测试非流式调用 ===")
    try:
        non_stream_result = client.non_stream_generate(prompt="你好，请简单介绍下自己（100字内）")
        print(f"✅ 非流式返回结果：\n{non_stream_result}")
    except Exception as e:
        print(f"❌ 非流式调用失败：{str(e)}")

    # 4. 测试流式调用（验证实时返回）
    print("\n=== 测试流式调用 ===")
    try:
        print("✅ 流式返回结果（实时输出）：")
        for chunk in client.stream_generate(prompt="请用3句话说明AI的作用"):
            print(chunk, end="", flush=True)  # 实时拼接输出
        print("\n✅ 流式调用结束")
    except Exception as e:
        print(f"❌ 流式调用失败：{str(e)}")