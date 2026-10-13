#!/usr/bin/env node
/*
 * W1-WHY (答错自述) 自动化测试
 * 验证：
 * 1. drawReview 在答错时渲染自述输入框 (el("div","whybox"))
 * 2. 输入自述并保存时，调用 patchAttempt 更新 attempts 记录
 * 3. 错题集 reviewQ[qid].lastWhy 同步记录
 * 4. questionPanel 错题回顾状态下提供自述编辑框
 * 5. 单题 AI 拆解 questionAsText 包含错因自述
 * 6. 完整题目序列化 serializeQuestion 包含错因自述
 * 7. 错题本侧栏列表项展示错因自述摘要
 */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const tests = [
  {
    name: "1. drawReview 答错时提供错因自述输入区",
    test: () => /function drawReview[\s\S]*?if\(!st\.ok\)[\s\S]*?el\("div",\s*"whybox"\)/.test(html)
  },
  {
    name: "2. 自述输入保存调用 patchAttempt 持久化到 attempts",
    test: () => /st\.why\s*=\s*val\s*\|\|\s*null;[\s\S]*?patchAttempt\(st\.aid,\s*\{why:\s*st\.why\}\)/.test(html)
  },
  {
    name: "3. 自述输入保存同步到错题集 reviewQ.lastWhy",
    test: () => /reviewQ\[q\.id\]\.lastWhy\s*=\s*st\.why/.test(html)
  },
  {
    name: "4. questionPanel 错题回顾状态下提供自述编辑框",
    test: () => /if\(a\s*&&\s*!a\.ok\)[\s\S]*?el\("div",\s*"whybox"\)/.test(html)
  },
  {
    name: "5. 单题 AI 拆解 questionAsText 包含错因自述",
    test: () => /if\(st\.why\s*&&\s*st\.why\.trim\(\)\)\s*s\s*\+=\s*`【我的错因自述】/.test(html)
  },
  {
    name: "6. 完整题目序列化 serializeQuestion 包含错因自述",
    test: () => /if\(a\.why\s*&&\s*a\.why\.trim\(\)\)\{[\s\S]*?【我的错因自述】/.test(html)
  },
  {
    name: "7. 错题本侧栏列表项展示错因自述摘要",
    test: () => /自述:\s*\$\{esc\(a\.why\.slice/.test(html)
  }
];

let failed = 0;
console.log("=== W1-WHY (答错自述) 规范与逻辑验证 ===");
for (const t of tests) {
  try {
    if (t.test()) {
      console.log(`  ok  ${t.name}`);
    } else {
      console.error(`  FAIL ${t.name}`);
      failed++;
    }
  } catch (err) {
    console.error(`  FAIL ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n全部通过 ✓ (7/7)" : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
