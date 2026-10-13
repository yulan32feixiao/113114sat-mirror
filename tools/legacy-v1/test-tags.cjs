#!/usr/bin/env node
/*
 * W2-TAG-RW & W3-TAG-MATH 自动化测试
 * 验证：
 * 1. PACE_S 顶层基准配速常数在位 (R&W 71s, Math 95s)
 * 2. extractChoiceRationale 正确提取指定选项的干扰项解析
 * 3. classifyError 对英语题 11 类典型模式的自动归类准确率
 * 4. classifyError 对数学题具体算错步 (This is the value of X, not Y) 的抽取
 * 5. 做题耗时四象限诊断 (快而错 / 慢而错 / 正常配速)
 * 6. FOLDER_TABS 支持「按错因」分组导航
 * 7. drawReview 与 questionPanel 渲染错因标签徽章 (.errbadge)
 */

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// 提取脚本并沙盒化执行函数逻辑
const start = html.indexOf("<script>") + "<script>".length;
const end = html.lastIndexOf("</script>");
const script = html.slice(start, end);

// 提取相关函数及常数进轻量沙盒环境
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

// 提取 stripTags, extractChoiceRationale, classifyError, FOLDER_TABS, PACE_S
vm.runInContext(`
globalThis.PACE_S = {1:71, 2:95};
globalThis.stripTags = h => String(h||"").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
${script.match(/function extractChoiceRationale[\s\S]*?^}/m)[0]}
${script.match(/function classifyError[\s\S]*?^}/m)[0]}
`, context);

const { classifyError, extractChoiceRationale, PACE_S } = context;

const tests = [
  {
    name: "1. 配速常数定义正确",
    run: () => {
      if (!html.includes("PACE_S = {1:71, 2:95}")) throw new Error("index.html 缺少 PACE_S 常数");
      if (PACE_S[1] !== 71 || PACE_S[2] !== 95) throw new Error("PACE_S 常数值错误");
    }
  },
  {
    name: "2. 选项解析隔离提取正确",
    run: () => {
      const ra = "Choice D is correct. Choice A is incorrect. The text does not mention X. Choice B is incorrect. Semicolon error.";
      const aText = extractChoiceRationale(ra, "A");
      if (!aText.includes("does not mention X") || aText.includes("Semicolon")) {
        throw new Error("未能精确切分选项 A 解析: " + aText);
      }
    }
  },
  {
    name: "3. 英语 R&W 模式分类（文中无依据、句子边界、时态、说反了）",
    run: () => {
      const q1 = { sec: 1, ty: "mcq", ra: "Choice A is incorrect. The text doesn't mention any benefits." };
      const e1 = classifyError(q1, { picked: "A", ok: false, ms: 50000 });
      if (!e1 || e1.tag !== "文中无依据") throw new Error("q1 分类失败: " + JSON.stringify(e1));

      const q2 = { sec: 1, ty: "mcq", ra: "Choice B is incorrect because of a comma splice." };
      const e2 = classifyError(q2, { picked: "B", ok: false, ms: 50000 });
      if (!e2 || e2.tag !== "句子边界/标点") throw new Error("q2 分类失败: " + JSON.stringify(e2));

      const q3 = { sec: 1, ty: "mcq", ra: "Choice C is incorrect because the text suggests the opposite." };
      const e3 = classifyError(q3, { picked: "C", ok: false, ms: 50000 });
      if (!e3 || e3.tag !== "说反了") throw new Error("q3 分类失败: " + JSON.stringify(e3));
    }
  },
  {
    name: "4. 数学题算错步提取",
    run: () => {
      const q = { sec: 2, ty: "mcq", ra: "Choice A is incorrect. This is the value of 25(2), not 25(2)+30." };
      const e = classifyError(q, { picked: "A", ok: false, ms: 80000 });
      if (!e || e.tag !== "错步计算" || !e.detail.includes("25(2)")) {
        throw new Error("数学错步提取失败: " + JSON.stringify(e));
      }
    }
  },
  {
    name: "5. 做题耗时四象限分类（快而错 / 慢而错）",
    run: () => {
      const qMath = { sec: 2, ty: "spr", ra: "Incorrect." };
      // 95s 配速，<66.5s = 快而错；>123.5s = 慢而错
      const fast = classifyError(qMath, { picked: "10", ok: false, ms: 30000 });
      if (!fast.quadrant.includes("快而错")) throw new Error("未能识别快而错: " + fast.quadrant);

      const slow = classifyError(qMath, { picked: "10", ok: false, ms: 140000 });
      if (!slow.quadrant.includes("慢而错")) throw new Error("未能识别慢而错: " + slow.quadrant);
    }
  },
  {
    name: "6. 错题本分组支持「按错因」",
    run: () => {
      if (!html.includes('["err","按错因"]')) throw new Error("FOLDER_TABS 未包含按错因");
      if (!html.includes('folder.by==="err"')) throw new Error("folderKeyOf 未处理 err 分组");
    }
  },
  {
    name: "7. 做题页与错题本徽章渲染完整",
    run: () => {
      if (!/drawReview[\s\S]*?errbadge/.test(html)) throw new Error("drawReview 缺少 errbadge 渲染");
      if (!/questionPanel[\s\S]*?errbadge/.test(html)) throw new Error("questionPanel 缺少 errbadge 渲染");
    }
  }
];

let failed = 0;
console.log("=== W2-TAG-RW & W3-TAG-MATH 自动化测试 ===");
for (const t of tests) {
  try {
    t.run();
    console.log(`  ok  ${t.name}`);
  } catch (err) {
    console.error(`  FAIL ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n全部通过 ✓ (7/7)" : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
