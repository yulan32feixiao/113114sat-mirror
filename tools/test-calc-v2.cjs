#!/usr/bin/env node
/*
 * 本地计算器引擎测试（v2.0）。
 * 引擎从 v1 移植（见 tools/legacy-v1/test-calc.cjs 的原始 26 条），
 * 关键点：白名单挡住任意代码执行、隐式乘法、结果必须是有限数。
 * 另外补了 v1 没有的 √9（不带括号）。
 */
const fs = require("fs");
const path = require("path");
const SITE = process.env.SITE_DIR || path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(SITE, "index.html"), "utf8");

const m = src.match(/function calcEval\(src\) \{[\s\S]*?\n    \}/);
if (!m) { console.log("FAIL 在 index.html 里找不到 calcEval"); process.exit(1); }
eval(m[0].replace(/^    /gm, ""));

let ok = 0, bad = 0;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const t = (expr, want) => {
  try {
    const v = +calcEval(expr).toPrecision(12);
    if (near(v, want)) { ok++; console.log(`  ok  ${expr} = ${v}`); }
    else { bad++; console.log(`  FAIL ${expr} 期望 ${want} 实际 ${v}`); }
  } catch (e) { bad++; console.log(`  FAIL ${expr} 抛错 ${e.message}`); }
};
const rej = (expr, why) => {
  try { calcEval(expr); bad++; console.log(`  FAIL ${expr} 应被拒绝却算出来了（${why}）`); }
  catch (e) { ok++; console.log(`  ok  ${expr} 已拒绝 — ${why}`); }
};

console.log("=== 基本运算 ===");
t("1+2*3", 7); t("(1+2)*3", 9); t("10/4", 2.5); t("2^10", 1024); t("50%", 0.5);

console.log("\n=== 函数与常数 ===");
t("sqrt(9)", 3); t("abs(-5)", 5); t("round(2.6)", 3);
t("ln(E)", 1); t("log(100)", 2);          // ln→自然对数、log→常用对数，别互相覆盖
t("π", Math.PI); t("E", Math.E);

console.log("\n=== 隐式乘法（真计算器都认）===");
t("2(3+1)", 8); t("(2)(3)", 6); t("3π", 3 * Math.PI); t("2√(9)", 6);

console.log("\n=== 根号不带括号（v1 不支持，v2 补上）===");
t("√9", 3); t("√16", 4); t("2(3+1)+√9", 11);

console.log("\n=== 必须拒绝的 ===");
rej("alert(1)", "白名单之外的名字");
rej("constructor", "不能靠原型链绕过白名单");
rej("globalThis", "不能拿到全局对象");
rej("1/0", "结果不是有限数");
rej("fetch('x')", "不能发网络请求");

console.log(`\n结果: ${ok} / ${ok + bad}`);
process.exit(bad ? 1 : 0);
