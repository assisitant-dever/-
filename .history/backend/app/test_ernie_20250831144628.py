import os
from .AI_client import ErnieClient  # 导入你的客户端类

def test_ernie_client():
    # 1. 配置你的百度千帆API密钥
    # 从环境变量读取或直接填写（仅测试用）
    api_key = os.getenv("QIANFAN_API_KEY","bce-v3/ALTAK-k80nyfTEn1ObgfUbsAphF/b8a17c6fd71e75d68c24c24696cdf7ad515738ad") 
    
    if not api_key:
        print("请设置QIANFAN_API_KEY环境变量或直接填写密钥")
        return

    try:
        # 2. 初始化客户端
        client = ErnieClient(
            api_key=api_key,
            model="deepseek-v3.1-250821",  # 使用参考示例中的模型
            base_url="https://qianfan.baidubce.com/v2/chat/completions"
        )
        print("客户端初始化成功")

        # 3. 测试全量生成
        print("\n===== 测试全量生成 =====")
        full_response = client.generate(prompt="你好，请简单介绍一下自己")
        print("生成结果:", full_response)

        # 4. 测试流式生成
        print("\n===== 测试流式生成 =====")
        print("生成结果:", end="")
        for chunk in client.stream_generate(prompt="请说一句欢迎词"):
            print(chunk, end="", flush=True)
        print()

    except Exception as e:
        print(f"\n验证失败: {str(e)}")
        return

    print("\n所有测试通过！")

if __name__ == "__main__":
    test_ernie_client()
