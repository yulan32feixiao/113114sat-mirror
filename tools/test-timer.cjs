#!/usr/bin/env node
/*
 * 计时开关测试。
 * 原 bug：run.timed 只被赋值、没有任何代码读它，deadline 只有模考和导入试卷会设，
 * 所以出题器里的「计时」勾选框无论勾不勾都是同一个累计计时器 —— 开关是死的。
 * 修复后：勾选 = 按官方配速（R&W 71 秒/题、Math 95 秒/题）给整组一个倒计时，到点自动交卷。
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const errs=[];
const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>true;w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};}});
const w=dom.window,D=w.document,ev=s=>w.eval(s);
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){console.log(`  FAIL ${n}: ${e.message}`);errs.push(n);}};
(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  ev(`createProfile("tester");CURRENT="tester";lsSet("b7_session","tester");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));

  step("不勾计时：不设 deadline，显示累计双计时器",()=>{
    ev(`startRun(pick({sec:1,doms:["SEC"],skills:[],bands:[],diffs:[],n:5,fresh:true}),{label:"x",timed:false})`);
    if(ev("run.deadline")) throw new Error("不该有 deadline");
    if(ev("run.timed")) throw new Error("run.timed 应为 false");
    if(!D.querySelector("#tq")||!D.querySelector("#tt")) throw new Error("缺累计计时器");
    if(D.querySelector("#timer")) throw new Error("不该出现倒计时");
    ev("closeRun()");
    return "无 deadline，本题+总计双计时";});

  step("勾计时：R&W 5 题 → 限时 5×71 秒",()=>{
    ev(`startRun(pick({sec:1,doms:["SEC"],skills:[],bands:[],diffs:[],n:5,fresh:true}),{label:"x",timed:true})`);
    const b = ev("run.budgetMs");
    if(b !== 5*71*1000) throw new Error(`budget 应为 ${5*71*1000}ms，实为 ${b}`);
    if(!ev("run.deadline")) throw new Error("没设 deadline");
    if(!ev("run.timed")) throw new Error("run.timed 应为 true");
    if(!D.querySelector("#timer")) throw new Error("没显示倒计时");
    if(D.querySelector("#tq")) throw new Error("不该同时出现累计计时器");
    return `${b/1000} 秒 = ${Math.round(b/60000)} 分钟，显示倒计时`;});

  step("倒计时提示写明配速来源",()=>{
    const t = D.querySelector("#timer").title;
    if(!t.includes("官方配速")) throw new Error(t);
    ev("closeRun()");
    return t;});

  step("勾计时：Math 4 题 → 限时 4×95 秒",()=>{
    ev(`startRun(pick({sec:2,doms:["H"],skills:[],bands:[],diffs:[],n:4,fresh:true}),{label:"x",timed:true})`);
    const b = ev("run.budgetMs");
    if(b !== 4*95*1000) throw new Error(`应为 ${4*95*1000}ms，实为 ${b}`);
    ev("closeRun()");
    return `${b/1000} 秒`;});

  step("混合 section 按各自配速累加",()=>{
    ev(`(function(){
      const a=BANK.filter(q=>q.sec===1)[0], b=BANK.filter(q=>q.sec===2)[0];
      startRun([a,b],{label:"mix",timed:true});
    })()`);
    const b = ev("run.budgetMs");
    if(b !== (71+95)*1000) throw new Error(`应为 ${(71+95)*1000}ms，实为 ${b}`);
    ev("closeRun()");
    return `71+95 = ${b/1000} 秒`;});

  step("倒计时归零自动交卷",async()=>{});
  await (async()=>{
    try{
      ev(`startRun([BANK[0],BANK[1]],{label:"expire",timed:true})`);
      ev(`run.state[0].picked = run.qs[0].an[0]`);          // 只答第一题
      ev(`run.deadline = Date.now() - 1`);                   // 把时间调到已过期
      await new Promise(r=>setTimeout(r,900));                // 等 tick 触发
      const finished = ev(`!run || run.finished`);
      if(!finished) throw new Error("到点没有自动交卷");
      const n = ev("attempts.length");
      if(n !== 1) throw new Error(`只答了 1 题，应入库 1 条，实为 ${n}`);
      console.log("  ok  倒计时归零自动交卷 — 已交卷，已答的 1 题入库、未答的不入库");
      ev(`run && closeRun()`);
    }catch(e){ console.log("  FAIL 倒计时归零自动交卷:", e.message); errs.push("expire"); }
  })();

  step("暂停会把 deadline 一起顺延",()=>{
    ev(`startRun([BANK[0],BANK[1]],{label:"p",timed:true})`);
    const d0 = ev("run.deadline");
    ev(`pauseRun(); run.pauseStart = Date.now() - 5000; resumeRun()`);
    const d1 = ev("run.deadline");
    if(d1 - d0 < 4500) throw new Error(`deadline 只顺延了 ${d1-d0}ms`);
    ev("closeRun()");
    return `暂停 5 秒，deadline 顺延 ${Math.round((d1-d0)/1000)} 秒`;});

  step("设置页的默认计时开关仍然可持久化",()=>{
    ev(`gotoView("settings")`);
    if(!D.querySelector("#app").innerHTML.includes("默认是否计时")) throw new Error("开关不在");
    ev(`cfg.timed=true; lsSet(K("timed"), true)`);
    if(!ev(`lsGet(K("timed"),false)`)) throw new Error("没存住");
    ev(`cfg.timed=false; lsSet(K("timed"), false)`);
    return "可开关且持久化";});

  console.log(errs.length?`\n失败 ${errs.length} 项`:"\n全部通过 ✓");
  process.exit(errs.length?1:0);
})();
