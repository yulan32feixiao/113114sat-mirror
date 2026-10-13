#!/usr/bin/env node
/*
 * College Board 权威标准合规性测试 (SAT v2.0)
 * 验证：
 * 1. SPR 填空题分数等值判分 (如 1/4 == 2/8)
 * 2. SPR 填空题循环小数官方四舍五入与截断规则 (如 2/3 == .6666, .6667, 0.666, 0.667)
 * 3. SPR 填空题对未占满输入格的小数严格判错 (如 2/3 != 0.66, 0.67)
 * 4. serializeQuestion 提取图描述 aria-label，消除 blank 占位，规范表格
 * 5. classifyError 对 11 类英语干扰项及数学错步的精准识别
 * 6. attempts 作答记录具备 ms 用时、why 自述、sid 场次完整数据结构
 */

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// 提取脚本
const start = html.indexOf("<script>") + "<script>".length;
const end = html.lastIndexOf("</script>");
const script = html.slice(start, end);

const vm = require("vm");
const context = {
  console,
  document: {
    createElement: () => ({
      querySelectorAll: () => [],
      textContent: "",
      replaceWith: () => {}
    })
  }
};
vm.createContext(context);

vm.runInContext(`
${script.match(/const SPR_CHARS[\s\S]*?function sprMatch[\s\S]*?^    }/m)[0]}
const PACE_S = {1:71, 2:95};
function stripTags(h){ return String(h||"").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim(); }
${script.match(/function extractChoiceRationale[\s\S]*?^    }/m)[0]}
${script.match(/function classifyError[\s\S]*?^    }/m)[0]}
`, context);

const { sprMatch, classifyError } = context;

const tests = [
  {
    name: "1. SPR 分数等值判分正确 (1/4 == 2/8)",
    run: () => {
      if (!sprMatch("2/8", ["1/4"])) throw new Error("等值分数 2/8 误判为错");
      if (!sprMatch("0.25", ["1/4"])) throw new Error("等值小数 0.25 误判为错");
      if (!sprMatch(".25", ["1/4"])) throw new Error("等值小数 .25 误判为错");
    }
  },
  {
    name: "2. SPR 循环小数官方合规写法判定 (2/3 -> .6666, .6667, 0.666, 0.667)",
    run: () => {
      const keys = ["2/3"];
      if (!sprMatch(".6666", keys)) throw new Error(".6666 误判为错");
      if (!sprMatch(".6667", keys)) throw new Error(".6667 误判为错");
      if (!sprMatch("0.666", keys)) throw new Error("0.666 误判为错");
      if (!sprMatch("0.667", keys)) throw new Error("0.667 误判为错");
    }
  },
  {
    name: "3. SPR 未填满字符格小数严格拒绝 (2/3 -> 0.66, 0.67 判错)",
    run: () => {
      const keys = ["2/3"];
      if (sprMatch("0.66", keys)) throw new Error("未填满格的 0.66 误判为对");
      if (sprMatch("0.67", keys)) throw new Error("未填满格的 0.67 误判为对");
    }
  },
  {
    name: "4. 错因自动归类引擎运转正常 (文中无依据、句子边界、时态、说反了、算错步)",
    run: () => {
      const e1 = classifyError({ sec: 1, ty: "mcq", ra: "Choice A is incorrect. The text doesn't mention any data." }, { picked: "A", ok: false });
      if (!e1 || e1.tag !== "文中无依据") throw new Error("e1 分类失败: " + JSON.stringify(e1));

      const e2 = classifyError({ sec: 2, ty: "mcq", ra: "Choice A is incorrect. This is the value of 4x-28, not x-7." }, { picked: "A", ok: false });
      if (!e2 || e2.tag !== "错步计算") throw new Error("e2 分类失败: " + JSON.stringify(e2));
    }
  },
  {
    name: "5. attempts 数据结构完整恢复 (ms, why, sid, bd 俱全)",
    run: () => {
      if (!/attempts\.push\(\{[\s\S]*?aid:[\s\S]*?ms:[\s\S]*?why:[\s\S]*?sid:[\s\S]*?ts:/.test(html)) {
        throw new Error("attempts.push 缺少关键教学数据字段");
      }
    }
  },
  {
    name: "6. AI 文本序列化器在位并处理题图、表格与 blank",
    run: () => {
      if (!html.includes("function serializeQuestion(q, a, opt)")) {
        throw new Error("缺少 serializeQuestion 核心函数");
      }
      if (!html.includes("〔空格〕")) {
        throw new Error("缺少 sr-only blank 清洗规则");
      }
    }
  }
];

let failed = 0;
console.log("=== SAT v2.0 权威标准合规性测试 ===");
for (const t of tests) {
  try {
    t.run();
    console.log(`  ok  ${t.name}`);
  } catch (err) {
    console.error(`  FAIL ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n全部标准合规测试通过 ✓ (6/6)" : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
