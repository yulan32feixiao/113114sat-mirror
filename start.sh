#!/bin/bash
# SAT 备考平台本地一键启动脚本
# 解决浏览器直接双击打开时因安全策略 (CORS) 无法加载 bank.bin 的问题
cd "$(dirname "$0")"

PORT=8000
# 如果 8000 被占用，尝试 8080
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    PORT=8080
fi

echo "正在启动本地服务 (端口: $PORT)..."
python3 -m http.server $PORT &
SERVER_PID=$!

# 等待服务就绪并自动在默认浏览器中打开
sleep 0.8
if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
fi

echo "================================================="
echo "  SAT 平台已成功启动！"
echo "  访问地址: http://localhost:$PORT"
echo "  按 Ctrl + C 可关闭本地服务"
echo "================================================="

trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
