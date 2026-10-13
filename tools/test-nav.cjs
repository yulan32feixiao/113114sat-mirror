#!/usr/bin/env node
/*
 * 导航流转与错题对齐 (W0-NAV) 9 项断言测试。
 *   node tools/test-nav.cjs
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
  ev(`createProfile("tnav");CURRENT="tnav";lsSet("b7_session","tnav");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));

  console.log("=== W0-NAV 导航测试 ===");

  step("1. VIEWS 常量包含 7 个核心主视图", ()=>{
    const vs = ev(`VIEWS`);
    if(!Array.isArray(vs) || vs.length !== 7) throw new Error("VIEWS 数量不正确: " + vs);
    if(!["home","records","log","paper","settings","source","vocab"].every(v=>vs.includes(v)))
      throw new Error("缺少必要视图: " + vs);
  });

  step("2. startRun 自动记录来源视图 run.from", ()=>{
    ev(`view = "log"; startRun(BANK.slice(0,2), {label:"测试来源"});`);
    const f = ev(`run && run.from`);
    if(f !== "log") throw new Error("run.from 预期为 log，实际为 " + f);
  });

  step("3. closeRun() 无参调用安全返回来源视图", ()=>{
    ev(`closeRun();`);
    const v = ev(`view`);
    if(v !== "log") throw new Error("关闭练习后应返回 log，实际为 " + v);
  });

  step("4. closeRun(to) 指定目标视图准确跳转", ()=>{
    ev(`view = "home"; startRun(BANK.slice(0,2), {label:"测试目标"}); closeRun("records");`);
    const v = ev(`view`);
    if(v !== "records") throw new Error("指定 records 应跳转成功，实际为 " + v);
  });

  step("5. drawSummary 结果页在有错题时渲染「看这次的错题」按钮", ()=>{
    ev(`
      view = "home";
      startRun(BANK.slice(0,2), {label:"测试错题汇总"});
      run.state[0].sub = true; run.state[0].ok = false; run.state[0].picked = "A";
      run.state[1].sub = true; run.state[1].ok = true;  run.state[1].picked = "B";
      drawSummary(2, 1, 60);
    `);
    const btn = Array.from(D.querySelectorAll(".btnrow button")).find(b=>b.textContent.includes("看这次的错题"));
    if(!btn) throw new Error("未找到「看这次的错题」按钮");
    if(!btn.textContent.includes("1 道")) throw new Error("错题数量显示错误: " + btn.textContent);
  });

  step("6. 点击「看这次的错题」设置 pendingLogFocus 并定向跳转至 log", ()=>{
    const btn = Array.from(D.querySelectorAll(".btnrow button")).find(b=>b.textContent.includes("看这次的错题"));
    btn.click();
    const v = ev(`view`);
    if(v !== "log") throw new Error("点击后应跳转至 log，实际为 " + v);
  });

  step("7. renderLog 消费 pendingLogFocus 后自动对齐作业分组并清空过滤障碍", ()=>{
    const fBy = ev(`folder.by`);
    const domF = ev(`logFilter.dom`);
    const secF = ev(`logFilter.sec`);
    const hmF = ev(`logFilter.hideMastered`);
    if(fBy !== "session") throw new Error("分组方式预期为 session，实际为 " + fBy);
    if(domF !== "" || secF !== 0) throw new Error("过滤条件应已清空，实际为 dom:" + domF + " sec:" + secF);
    if(hmF !== false) throw new Error("刚错题目不应被 hideMastered 隐藏");
  });

  step("8. cancelRun 放弃练习返回来源视图 run.from", ()=>{
    ev(`view = "vocab"; startRun(BANK.slice(0,2), {label:"测试放弃"});`);
    ev(`run.state[0].picked = null; cancelRun();`);
    const v = ev(`view`);
    if(v !== "vocab") throw new Error("放弃练习后应返回 vocab，实际为 " + v);
  });

  step("9. popstate 后退拦截退出做题时返回 run.from", ()=>{
    ev(`view = "records"; startRun(BANK.slice(0,2), {label:"测试后退"});`);
    w.dispatchEvent(new w.PopStateEvent("popstate", {state:{v:"home"}}));
    const v = ev(`view`);
    if(v !== "records") throw new Error("后退退出做题后应返回 records，实际为 " + v);
  });

  console.log(`\n结果: ${9-bad}/9 测试通过`);
  process.exit(bad ? 1 : 0);
})();
