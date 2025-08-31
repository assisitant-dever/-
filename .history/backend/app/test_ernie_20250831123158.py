import time
from ernie_client import ErnieClient  # 假设ErnieClient定义在ernie_client.py中

def main():
    # 初始化客户端
    # 方式1: 使用API Key (如果已经通过平台获取了access_token)
    # client = ErnieClient(api_key="你的API_KEY")
    
    # 方式2: 使用AK/SK (推荐，自动生成token)
    client = ErnieClient(
        api_key="bce-v3/ALTAK-k80nyfTEn1ObgfUbsAphF/b8a17c6fd71e75d68c24c24696cdf7ad515738ad",    # 百度智能云控制台获取的API Key
        secret_key="你的SECRET_KEY"  # 百度智能云控制台获取的Secret Key
    )
    
    # 可选：更改模型（默认是ernie-bot-4）
    try:
        client.set_model("ernie-bot-turbo")  # 切换到轻量版模型
        print(f"已设置模型: {client.model}")
    except ValueError as e:
        print(f"设置模型失败: {e}")
        return
    
    # 测试全量生成
    try:
        print("\n===== 测试全量生成 =====")
        prompt = "请简要介绍一下文心一言的主要特点"
        result = client.generate(
            prompt=prompt,
            system_prompt="你是一位AI助手，擅长简明扼要地回答问题",
            temperature=0.5
        )
        print(f"问题: {prompt}")
        print(f"回答: {result}")
    except Exception as e:
        print(f"全量生成出错: {e}")
    
    # 等待一会儿，避免请求过于频繁
    time.sleep(2)
    
    # 测试流式生成
    try:
        print("\n===== 测试流式生成 =====")
        prompt = "请用3个要点说明人工智能的发展趋势"
        print(f"问题: {prompt}")
        print("回答: ", end="", flush=True)
        
        # 流式接收并打印结果
        for chunk in client.stream_generate(
            prompt=prompt,
            temperature=0.8,
            top_p=0.9
        ):
            print(chunk, end="", flush=True)
        print()  # 换行
    except Exception as e:
        print(f"\n流式生成出错: {e}")

if __name__ == "__main__":
    main()
