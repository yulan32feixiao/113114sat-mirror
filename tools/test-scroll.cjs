#!/usr/bin/env node
/*
 * drawRun 滚动位置保护测试（防止选答案或切状态时长文章跳回顶部）。
 *   node tools/test-scroll.cjs
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
    w.confirm=()=>true;w.alert=()=>{};w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};}});
const w=dom.window,D=w.document,ev=s=>w.eval(s);
let bad=0;
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){bad++;console.log(`  FAIL ${n}: ${e.message}`);}};

(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  ev(`createProfile("tscroll");CURRENT="tscroll";lsSet("b7_session","tscroll");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));

  console.log("=== drawRun 滚动保护测试 ===");

  step("1. 初始化做题环境并存在左侧材料面板", ()=>{
    ev(`startRun(BANK.filter(q=>q.sti).slice(0,3), {label:"测试滚动"});`);
    const left = D.querySelector(".pane.left");
    if(!left) throw new Error("未找到左侧材料 pane.left");
  });

  step("2. 模拟长文滚动至 500px 后，点选项重新触发 drawRun，scrollTop 恢复为 500", ()=>{
    const left = D.querySelector(".pane.left");
    left.scrollTop = 500;
    // 模拟选答案并触发 drawRun
    ev(`run.state[run.i].picked = "B"; drawRun();`);
    const newLeft = D.querySelector(".pane.left");
    if(!newLeft) throw new Error("重绘后未找到左侧材料 pane.left");
    if(newLeft.scrollTop !== 500) throw new Error("重绘后滚动位置未恢复，预期 500，实际为 " + newLeft.scrollTop);
  });

  step("3. 模拟右键排除选项再次重绘，scrollTop 依然保持 500", ()=>{
    ev(`run.state[run.i].struck = ["A"]; drawRun();`);
    const newLeft = D.querySelector(".pane.left");
    if(newLeft.scrollTop !== 500) throw new Error("排除选项后滚动位置丢失，实际为 " + newLeft.scrollTop);
  });

  step("4. 切换至第 2 题，新题目默认从顶部 0 开始", ()=>{
    ev(`run.i = 1; drawRun();`);
    const newLeft = D.querySelector(".pane.left");
    if(newLeft.scrollTop !== 0) throw new Error("新题预期从 0 开始，实际为 " + newLeft.scrollTop);
  });

  step("5. 切回第 1 题，第 1 题的 500px 滚动位置依然得到记忆恢复", ()=>{
    ev(`run.i = 0; drawRun();`);
    const newLeft = D.querySelector(".pane.left");
    if(newLeft.scrollTop !== 500) throw new Error("切回原题后滚动记忆未恢复，实际为 " + newLeft.scrollTop);
  });

  console.log(`\n结果: ${5-bad}/5 测试通过`);
  process.exit(bad ? 1 : 0);
})();
