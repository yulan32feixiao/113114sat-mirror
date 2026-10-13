#!/usr/bin/env python3
"""
tools/test-custom-model.py
用于在沙盒/终端中测试任何兼容 OpenAI 格式的模型（DeepSeek、智谱、Qwen、Moonshot、Gemini、Claude、本地 Ollama 等）。

用法示例：
  python3 tools/test-custom-model.py --key "sk-..." --base "https://api.deepseek.com" --model "deepseek-chat"
  python3 tools/test-custom-model.py --key "sk-..." --base "https://open.bigmodel.cn/api/paas/v4" --model "glm-4-flash"
  python3 tools/test-custom-model.py --key "ollama" --base "http://localhost:11434/v1" --model "qwen2.5:7b"
"""
import sys, os, json, argparse, urllib.request

parser = argparse.ArgumentParser(description="Test any OpenAI-compatible LLM on real SAT questions")
parser.add_argument("--base", default="https://api.deepseek.com", help="Base URL (default: https://api.deepseek.com)")
parser.add_argument("--model", default="deepseek-chat", help="Model ID (default: deepseek-chat)")
parser.add_argument("--key", default="", help="API key")

args = parser.parse_args()
key = args.key or os.environ.get("LLM_API_KEY", "")

if not key:
    print("错误：未提供 API Key。")
    print("请使用 --key 参数或设置 LLM_API_KEY 环境变量。")
    print("示例：python3 tools/test-custom-model.py --key \"sk-xxxx\" --model \"deepseek-chat\"")
    sys.exit(1)

base = args.base.rstrip("/")
url = f"{base}/chat/completions"

payload = {
    "model": args.model,
    "messages": [
        {"role": "system", "content": "你是一位经验丰富的数字 SAT 备考导师。"},
        {"role": "user", "content": "【题目】2x + 3 = 11，求 2x - 1 的值。\n【我的作答】4（错）\n【正确答案】7\n【我的错因自述】求出了 x=4，直接填了 4，没看清题目求的是 2x-1。\n\n请用 120 字以内简短指出此题的核心坑点与避免复发的方法。"}
    ],
    "temperature": 0.3
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {key}"
}

print(f"正在测试接口连接: {url}")
print(f"测试模型: {args.model}")

try:
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        ans = res["choices"][0]["message"]["content"]
        print("\n=== 模型调用成功！解析返回示例 ===")
        print(ans.strip())
        print("===================================\n")
        print("验证结论：该模型与当前 SAT 平台的 OpenAI 兼容标准完全吻合，可直接在 Web「设置」页中填入使用。")
except Exception as e:
    print(f"\n接口调用失败: {e}")
    sys.exit(1)
