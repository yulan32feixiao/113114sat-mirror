#!/usr/bin/env node
/*
 * 填空题判题测试 —— 用官方 Bluebook 考试指令里那张接受表逐条验证。
 * 来源：satsuite.collegeboard.org/media/pdf/english-sat-test-directions-bb.pdf
 *   node tools/test-spr.cjs
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>true;w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};}});
const w=dom.window;
let bad=0, n=0;
const chk=(keys, input, want, note)=>{
  n++;
  const got = w.eval(`sprMatch(${JSON.stringify(input)}, ${JSON.stringify(keys)})`);
  const ok = got===want;
  if(!ok) bad++;
  console.log(`  ${ok?"ok ":"FAIL"} 答案 ${JSON.stringify(keys)} ← 输入 ${JSON.stringify(input)}  期望${want?"接受":"拒绝"}  实际${got?"接受":"拒绝"}${note?"  ("+note+")":""}`);
};
(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  console.log("=== 官方接受表：答案 3.5 ===");
  ["3.5","3.50","7/2"].forEach(v=>chk(["3.5"], v, true));
  ["31/2","3 1/2"].forEach(v=>chk(["3.5"], v, false, "官方明确不接受"));
  console.log("\n=== 官方接受表：答案 2/3 ===");
  ["2/3",".6666",".6667","0.666","0.667"].forEach(v=>chk(["2/3"], v, true));
  ["0.66",".66","0.67",".67"].forEach(v=>chk(["2/3"], v, false, "没占满输入格"));
  console.log("\n=== 官方接受表：答案 -1/3 ===");
  ["-1/3","-.3333","-0.333"].forEach(v=>chk(["-1/3"], v, true));
  ["-.33","-0.33"].forEach(v=>chk(["-1/3"], v, false, "没占满输入格"));
  console.log("\n=== 字符上限 ===");
  chk(["12345"], "12345", true, "正数 5 位刚好");
  chk(["123456"], "123456", false, "正数超过 5 位");
  chk(["-12345"], "-12345", true, "负数含负号 6 位刚好");
  chk(["-123456"], "-123456", false, "负数超过 6 位");
  console.log("\n=== 禁用符号 ===");
  chk(["1000"], "1,000", false, "逗号");
  chk(["50"], "50%", false, "百分号");
  chk(["20"], "$20", false, "美元符号");
  console.log("\n=== 多个正确答案（官方：可能有多个，填一个即可）===");
  chk(["4","-4"], "4", true);
  chk(["4","-4"], "-4", true);
  chk(["4","-4"], "5", false);
  console.log("\n=== 等值分数 ===");
  chk(["1/2"], "2/4", true, "等值");
  chk(["1/2"], "0.5", true, "有限小数写全");
  chk(["1/2"], ".5", true);
  chk(["7"], "7.00", true, "整数写成小数");
  console.log("\n=== 输入形式校验 ===");
  [["3.5",true],["-1/3",true],[".6666",true],["3 1/2",false],["1,000",false],["abc",false],
   ["123456",false],["--3",false],["",false]].forEach(([v,want])=>{
    n++; const got=w.eval(`sprFormat(${JSON.stringify(v)}).ok`);
    const ok=got===want; if(!ok) bad++;
    console.log(`  ${ok?"ok ":"FAIL"} 形式 ${JSON.stringify(v)} 期望${want?"合法":"非法"} 实际${got?"合法":"非法"}`+
      (got?"":"  → "+w.eval(`sprFormat(${JSON.stringify(v)}).why`)));
  });
  console.log(`\n${bad?`失败 ${bad}/${n}`:`全部通过 ✓ (${n} 条)`}`);
  process.exit(bad?1:0);
})();
