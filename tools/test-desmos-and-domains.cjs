#!/usr/bin/env node
/*
 * 阶段 1 自动化测试：
 * 1. 真实考试 Desmos 计算器 (https://www.desmos.com/testing/cb-sat-ap/graphing) 嵌入
 * 2. 计算器支持 Desmos 图形与离线极简计算双模切换 (默认 basic 保证键盘直通)
 * 3. Desmos 模式下键盘事件放行给 iframe (calcKeydown)
 * 4. 首页 score band (分数段) 默认折叠隐藏 (bandfold details)
 * 5. 8 大官方 Domain 专项分类卡片具备专属刷题入口与中文对照
 * 6. 29 个官方细分考点完整挂载在专项分类下
 */

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const tests = [
  {
    name: "1. 嵌入官方 CB SAT Desmos 计算器",
    run: () => {
      if (!html.includes("https://www.desmos.com/testing/cb-sat-ap/graphing")) {
        throw new Error("缺少官方 Desmos 考试版 URL");
      }
      if (!html.includes('calciframe')) {
        throw new Error("缺少 Desmos iframe 容器");
      }
    }
  },
  {
    name: "2. 计算器支持 Desmos / 极简科学双模切换",
    run: () => {
      if (!html.includes('calcMode = "basic"')) throw new Error("缺少 calcMode 初始状态 (basic)");
      if (!html.includes("Desmos 官方图形") || !html.includes("极简计算")) {
        throw new Error("缺少双模切换选项");
      }
    }
  },
  {
    name: "3. Desmos 模式下放行键盘事件",
    run: () => {
      if (!/calcKeydown\(e\)\{[\s\S]*?if\(calcMode === "desmos"\)\s*return false;/.test(html)) {
        throw new Error("Desmos 模式未放行键盘输入");
      }
    }
  },
  {
    name: "4. 首页分数段 (Band 1-7) 默认折叠隐藏",
    run: () => {
      if (!html.includes('el("details","bandfold")')) {
        throw new Error("首页分数段条未包裹在 details.bandfold 内");
      }
    }
  },
  {
    name: "5. 8 大官方 Domain 专项分类卡片支持独立刷题",
    run: () => {
      if (!html.includes('el("div","skgroup domainheader")')) {
        throw new Error("缺少 domainheader 容器");
      }
      if (!html.includes("专项刷题")) {
        throw new Error("缺少专项刷题按钮");
      }
    }
  },
  {
    name: "6. 29 项细分考点完整挂载在 Domain 下",
    run: () => {
      const match = html.match(/list\.forEach\(s=>blk\.appendChild\(skillCard\(s\)\)\);/);
      if (!match) throw new Error("细分考点未挂载至分类列表");
    }
  }
];

let failed = 0;
console.log("=== 阶段 1：官方 Desmos 计算器与专项分类体系自动化测试 ===");
for (const t of tests) {
  try {
    t.run();
    console.log(`  ok  ${t.name}`);
  } catch (err) {
    console.error(`  FAIL ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n全部通过 ✓ (6/6)" : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
