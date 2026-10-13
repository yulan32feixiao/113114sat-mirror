#!/usr/bin/env node
/*
 * AI 侧栏测试 —— 用假供应商把整条链路跑通：
 * 上下文组装、按考点选框架、错题检索、流式解析、故障转移、会话持久化、界面渲染。
 * 真实模型的回答质量无法在这里验证，但「发出去的内容对不对」可以。
 *   node tools/test-ai.cjs
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const errs=[];
let captured=[];      // 捕获所有发出的请求

function sse(text){
  const chunks=text.match(/.{1,12}/gs)||[];
  const body=chunks.map(c=>`data: ${JSON.stringify({choices:[{delta:{content:c}}]})}\n\n`).join("")+"data: [DONE]\n\n";
  const bytes=new TextEncoder().encode(body);
  let sent=false;
  return {ok:true,status:200,body:{getReader:()=>({read:async()=>sent?{done:true}:(sent=true,{done:false,value:bytes})})}};
}

const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){
    w.fetch=async(url,init)=>{
      if(String(url).endsWith("bank.bin")||!init)
        return {ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)};
      const body=JSON.parse(init.body);
      captured.push({url:String(url),auth:init.headers.Authorization,body});
      if(String(url).includes("broken.invalid"))
        return {ok:false,status:401,json:async()=>({error:{message:"bad key"}})};
      if(body.stream===false)
        return {ok:true,status:200,json:async()=>({choices:[{message:{content:"非流式回复"}}]})};
      return sse("· 这道题考的是证据与结论的匹配。\n· 你选的那项只是和话题相关。");
    };
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
    w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>true;w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};
    w.addEventListener("error",e=>errs.push("onerror: "+(e.message||e.error)));
  }});
const w=dom.window,D=w.document,ev=s=>w.eval(s);
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){console.log(`  FAIL ${n}: ${e.message}`);errs.push(n+": "+e.message);}};

(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  ev(`createProfile("tester");CURRENT="tester";lsSet("b7_session","tester");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));

  console.log("=== 未配置模型时 ===");
  step("侧栏提示去配置",()=>{
    const q=ev(`BANK.find(x=>x.sk==="Command of Evidence")`);
    ev(`aiOpen=true; window.__q=BANK.find(x=>x.sk==="Command of Evidence")`);
    const p=ev(`aiPanel(window.__q,null)`);
    if(!p.textContent.includes("还没配置模型"))throw new Error(p.textContent.slice(0,60));
    return "提示正确";});
  step("hasKey 为假",()=>{if(ev("hasKey()"))throw new Error("居然为真");return "false";});

  console.log("\n=== 上下文组装（这道题模型到底看到什么）===");
  ev(`providers=[{id:"t",name:"Mock",base:"https://mock.test/v1",model:"mock-1",key:"sk-x",on:true}];saveProviders()`);
  step("hasKey 为真",()=>{if(!ev("hasKey()"))throw new Error("为假");return "1 个可用供应商";});
  step("四选一题的事实包完整",()=>{
    const t=ev(`serializeQuestion(window.__q, {picked:"A",ok:false,ms:45000})`);
    ["【考点】","【问题】","【选项】","A. ","B. ","C. ","D. ","【正确答案】","【我的作答】","官方解析"]
      .forEach(k=>{if(!t.includes(k))throw new Error("缺 "+k)});
    if(!t.includes("用时 45 秒"))throw new Error("缺用时");
    return t.length+" 字符，含题干/四选项/答案/作答/官方解析";});
  step("按考点选对框架",()=>{
    const rs=ev(`BANK.find(x=>x.sk==="Rhetorical Synthesis")`);
    const f=ev(`frameFor(BANK.find(x=>x.sk==="Rhetorical Synthesis"))`);
    if(!f.includes("specify how"))throw new Error("不是 Rhetorical Synthesis 的框架");
    const b=ev(`frameFor(BANK.find(x=>x.sk==="Boundaries"))`);
    if(!b.includes("标点规则"))throw new Error("不是 Boundaries 的框架");
    const m=ev(`frameFor(BANK.find(x=>x.sec===2))`);
    if(!m.includes("关键一步"))throw new Error("数学没走数学框架");
    return "三种考点各自命中专属框架";});
  step("系统指令禁止编造和顶撞官方解析",()=>{
    const sys=ev(`aiSystem(window.__q)`);
    ["不许补充","不得与【官方解析】冲突","不讲应试技巧"].forEach(k=>{
      if(!sys.includes(k))throw new Error("缺 "+k)});
    return "三条硬约束都在";});
  step("无图描述的题会警告模型",()=>{
    const noFig=ev(`BANK.find(x=>/官方未提供文字描述/.test(serializeQuestion(x,null)))`);
    if(!noFig)throw new Error("样本没找到");
    const sys=ev(`aiSystem(BANK.find(x=>/官方未提供文字描述/.test(serializeQuestion(x,null))))`);
    if(!sys.includes("你看不到它"))throw new Error("没警告");
    return "会明确告知看不到图";});

  console.log("\n=== 错题本联动 ===");
  step("无历史时不塞错题段",()=>{
    if(ev(`relatedMistakes(window.__q)`))throw new Error("凭空捏了历史");return "留空";});
  step("有历史时检索同考点",()=>{
    ev(`(function(){
      const qs=BANK.filter(x=>x.sk==="Command of Evidence"&&x.id!==window.__q.id).slice(0,3);
      qs.forEach((q,i)=>attempts.push({aid:"t"+i,qid:q.id,sec:q.sec,dom:q.dom,sk:q.sk,df:q.df,bd:q.bd,
        picked:"A",correct:q.an.join("|"),ok:false,ms:30000,ts:Date.now(),session:"测试"}));
      saveLocal();})()`);
    const h=ev(`relatedMistakes(window.__q)`);
    if(!h.includes("我的错题背景"))throw new Error("没生成");
    if(!h.includes("Command of Evidence"))throw new Error("没检索到同考点");
    if(h.includes(ev("window.__q.id")))throw new Error("把当前题也算进历史了");
    return h.split("\n").length+" 行错题背景";});
  step("整条消息链正确",()=>{
    const ms=ev(`buildMessages(window.__q,{picked:"A",ok:false},"这题考什么",[])`);
    if(ms[0].role!=="system")throw new Error("首条不是 system");
    if(!ms[1].content.includes("【本题分析框架】"))throw new Error("缺框架");
    if(!ms[1].content.includes("我的错题背景"))throw new Error("缺错题背景");
    if(!ms[1].content.includes("【我的问题】"))throw new Error("缺提问");
    return ms.length+" 条消息，约 "+ms.map(m=>m.content.length).reduce((a,b)=>a+b)+" 字";});

  console.log("\n=== 实际调用 ===");
  captured=[];
  await (async()=>{
    try{
      await ev(`sendAI(window.__q,{picked:"A",ok:false},"这道题考什么","这题考什么")`);
      await new Promise(r=>setTimeout(r,300));
      step("请求发到正确地址",()=>{
        if(!captured.length)throw new Error("没发出去");
        const c=captured[0];
        if(!c.url.includes("mock.test/v1/chat/completions"))throw new Error(c.url);
        if(c.auth!=="Bearer sk-x")throw new Error("鉴权头不对");
        if(c.body.model!=="mock-1")throw new Error("模型名不对");
        return c.url;});
      step("流式解析出完整回复",()=>{
        const th=ev(`aiThreads[window.__q.id]`);
        const last=th[th.length-1];
        if(last.role!=="assistant")throw new Error("最后一条不是回复");
        if(!last.content.includes("证据与结论的匹配"))throw new Error("内容不全: "+last.content);
        return last.content.replace(/\n/g," ").slice(0,40)+"…";});
      step("会话已持久化",()=>{
        const st=JSON.parse(w.localStorage.getItem("b7:tester:threads")||"{}");
        if(!st[ev("window.__q.id")])throw new Error("没存");
        return "已落盘";});
    }catch(e){console.log("  FAIL 调用:",e.message);errs.push("call");}
  })();

  console.log("\n=== 故障转移 ===");
  await (async()=>{
    try{
      ev(`providers=[{id:"a",name:"坏的",base:"https://broken.invalid/v1",model:"m",key:"sk-bad",on:true},
                    {id:"b",name:"好的",base:"https://mock.test/v1",model:"mock-2",key:"sk-ok",on:true}];saveProviders()`);
      captured=[];
      const t=await ev(`aiChat([{role:"user",content:"hi"}],{})`);
      step("第一个失败自动换第二个",()=>{
        if(captured.length!==2)throw new Error("只试了 "+captured.length+" 个");
        if(!captured[0].url.includes("broken.invalid"))throw new Error("顺序不对");
        if(captured[1].body.model!=="mock-2")throw new Error("没换到第二个");
        if(!t.includes("证据"))throw new Error("没拿到回复");
        return "坏的→好的，最终成功";});
      step("最后错误可追溯",()=>{
        if(!ev("aiLastError").includes("坏的"))throw new Error(ev("aiLastError"));
        return ev("aiLastError");});
      ev(`providers=[{id:"a",name:"坏的",base:"https://broken.invalid/v1",model:"m",key:"sk-bad",on:true}];saveProviders()`);
      let code="";
      try{ await ev(`aiChat([{role:"user",content:"hi"}],{})`); }catch(e){ code=e.code; }
      step("全失败时报具体原因",()=>{
        if(code!=="bad_key")throw new Error("code="+code);
        return "bad_key → " + ev(`aiErrText("bad_key")`);});
    }catch(e){console.log("  FAIL 故障转移:",e.message);errs.push("failover");}
  })();

  console.log("\n=== 界面 ===");
  ev(`providers=[{id:"t",name:"Mock",base:"https://mock.test/v1",model:"mock-1",key:"sk-x",on:true}];saveProviders()`);
  step("错题本能开侧栏",()=>{
    ev(`aiOpen=true; listTab="wrong"; folder={by:"all",val:""}; logFilter={sec:0,dom:"",onlyDue:false,hideMastered:false}; gotoView("log")`);
    if(!D.querySelector(".logpreview .aipanel"))throw new Error("没渲染");
    const b=[...D.querySelectorAll(".pvtop button")].map(x=>x.textContent);
    if(!b.some(x=>x.includes("AI 分析")))throw new Error(b.join(","));
    return "三栏：目录 / 题目 / AI";});
  step("预设提问齐全",()=>{
    const a=[...D.querySelectorAll(".aiasks .askchip")].map(x=>x.textContent);
    ["这题考什么","我为什么错","干扰项怎么设的","该记的词"].forEach(k=>{
      if(!a.includes(k))throw new Error("缺 "+k)});
    return a.join(" / ");});
  step("答题界面判分后可开",()=>{
    ev(`aiOpen=false; startRun([window.__q],{label:"t",timed:false,blind:false})`);
    let b=[...D.querySelectorAll(".runbar button")].find(x=>x.textContent==="✦ AI");
    if(!b)throw new Error("没有按钮");
    if(!b.disabled)throw new Error("未判分就可点");
    ev(`run.state[0].picked="A"`); ev(`submit()`);
    return "未判分时禁用（符合不提前泄题）";});
  step("设置页能管多个供应商",()=>{ev("closeRun()");ev(`gotoView("settings")`);
    const h=D.querySelector("#app").innerHTML;
    if(!h.includes("AI 模型"))throw new Error("没有分区");
    if(!D.querySelector(".provrow"))throw new Error("没列出供应商");
    const opts=[...D.querySelectorAll("#app select option")].map(x=>x.textContent);
    if(opts.length<4)throw new Error("预设太少");
    return D.querySelectorAll(".provrow").length+" 个已配置，预设 "+(opts.length-1)+" 家";});

  console.log("\n=== 结果 ===");
  console.log(errs.length?`失败 ${errs.length} 项:\n  `+errs.join("\n  "):"全部通过 ✓");
  process.exit(errs.length?1:0);
})();
