#!/usr/bin/env node
/*
 * 无头冒烟测试 —— 用 jsdom 把整个应用跑一遍，验证关键路径没坏。
 * 没有浏览器可用时，这是唯一能证明「改完还能跑」的手段。
 *
 *   npm install jsdom
 *   node tools/smoke.cjs
 *
 * 退出码 0 = 全过，1 = 有失败。改完代码、推送之前务必跑一次。
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR || path.resolve(__dirname, "..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const errs=[];
const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){
    w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
    w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>w.__confirm!==false; w.alert=()=>{};
    w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};
    w.addEventListener("error",e=>errs.push("onerror: "+(e.message||e.error)));
  }});
const w=dom.window,D=w.document,ev=s=>w.eval(s),CUR=()=>w.eval("CURRENT");
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){console.log(`  FAIL ${n}: ${e.message}`);errs.push(n+": "+e.message);}};

(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  console.log("=== 基础 ===");
  step("题库",()=>{const n=ev("BANK.length");if(n!==3311)throw new Error(n);return n+" 题";});
  step("打开就进，没有登录门",()=>{
    if(D.querySelector("#gate"))throw new Error("还有登录/选人界面");
    if(!CUR())throw new Error("没有自动进入任何档案");
    if(D.querySelector("#topbar").classList.contains("hide"))throw new Error("顶栏还藏着");
    return "自动进入档案「"+CUR()+"」";});
  ev(`createProfile("tester");CURRENT="tester";lsSet("b7_session","tester");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));
  step("进入应用",()=>D.querySelector("#whoami").textContent);
  for(const v of ["home","log","vocab","paper","settings","source"])
    step("渲染 "+v,()=>{ev(`gotoView("${v}")`);const h=D.querySelector("#app").innerHTML;
      if(h.length<120)throw new Error("空白");                       // 空状态本来就很短
      if(!D.querySelector("#app .pagehead h1"))throw new Error("没有标题");
      return D.querySelector("#app .pagehead h1").textContent+" / "+h.length+" 字符";});
  step("sr-only 规则在",()=>{if(!/\.sr-only\{[^}]*clip:rect\(0,0,0,0\)/.test(html))throw new Error("缺");
    return "题干 blank 已隐藏";});
  step("默认「该补的」只列重点",()=>{ev(`gotoView("home")`);
    const n=D.querySelectorAll(".skcard").length;
    if(!(n>0&&n<29))throw new Error("默认视图列了 "+n+" 张，应当少于 29 张");
    return n+" 张（29 个考点里挑出来的）";});
  step("切到按 domain 是 29 张",()=>{ev(`groupBy="domain";render()`);
    const n=D.querySelectorAll(".skcard").length;
    if(n!==29)throw new Error(n);ev(`groupBy="focus";render()`);return n+" 张";});

  console.log("\n=== 放弃：延迟判分模式（默认）===");
  await (async()=>{
    try{
      ev(`settings.reveal="end";saveSettings()`);
      const a0=ev("attempts.length"), r0=ev("Object.keys(reviewQ).length"), s0=ev("sessions.length");
      ev(`startRun(pick({sec:1,doms:["SEC"],skills:[],bands:[],diffs:[],n:4,fresh:true}),{label:"cancel-blind",timed:false})`);
      ev(`run.state.forEach((s,k)=>{const q=run.qs[k];s.picked="ABCD".split("").find(L=>!q.an.includes(L))})`);
      step("放弃按钮在答题栏",()=>{const b=[...D.querySelectorAll(".runbar button")].map(x=>x.textContent);
        if(!b.includes("放弃"))throw new Error(b.join(","));return b.join(" / ");});
      step("暂停面板也有放弃",()=>{ev("pauseRun()");
        const b=[...D.querySelectorAll("#pauseveil button")].map(x=>x.textContent);
        if(!b.includes("放弃这一场"))throw new Error(b.join(","));ev("resumeRun()");return b.join(" / ");});
      await ev("cancelRun()");
      await new Promise(r=>setTimeout(r,250));
      step("作答未入库",()=>{const n=ev("attempts.length");if(n!==a0)throw new Error(`${a0} -> ${n}`);return n+" 条（不变）";});
      step("错题集未变",()=>{const n=ev("Object.keys(reviewQ).length");if(n!==r0)throw new Error(`${r0} -> ${n}`);return n+" 题（不变）";});
      step("场次未记",()=>{const n=ev("sessions.length");if(n!==s0)throw new Error(`${s0} -> ${n}`);return n+" 场（不变）";});
      step("答题界面已关",()=>{if(!D.querySelector("#view-run").classList.contains("hide"))throw new Error("还开着");
        if(ev("run"))throw new Error("run 没清");return "已关闭";});
    }catch(e){console.log("  FAIL 延迟模式放弃:",e.message);errs.push("cancel-blind");}
  })();

  console.log("\n=== 放弃：即时判分模式（要真回滚）===");
  await (async()=>{
    try{
      ev(`settings.reveal="now";saveSettings()`);
      const a0=ev("attempts.length"), r0=ev("Object.keys(reviewQ).length");
      ev(`startRun(pick({sec:1,doms:["INI"],skills:[],bands:[],diffs:[],n:3,fresh:true}),{label:"cancel-now",timed:false})`);
      // 故意做错两题，让它们真的写进作答记录和错题集
      for(let i=0;i<2;i++){
        ev(`(function(){const q=run.qs[run.i];run.state[run.i].picked="ABCD".split("").find(L=>!q.an.includes(L))})()`);
        await ev("submit()"); await new Promise(r=>setTimeout(r,120));
        if(i===0) ev(`saveTime();unfreeze();run.i++;drawRun()`);
      }
      step("即时模式确实写了记录",()=>{const n=ev("attempts.length");
        if(n!==a0+2)throw new Error(`应为 ${a0+2}，实为 ${n}`);return `作答 ${a0} -> ${n}`;});
      step("错题确实进了错题集",()=>{const n=ev("Object.keys(reviewQ).length");
        if(n<=r0)throw new Error("没进");return `错题集 ${r0} -> ${n}`;});
      step("run.written 记下了",()=>{const n=ev("run.written.length");
        if(n!==2)throw new Error(n);return n+" 条待回滚";});
      await ev("cancelRun()");
      await new Promise(r=>setTimeout(r,250));
      step("作答已回滚",()=>{const n=ev("attempts.length");
        if(n!==a0)throw new Error(`应回到 ${a0}，实为 ${n}`);return `回到 ${n} 条`;});
      step("错题集已回滚",()=>{const n=ev("Object.keys(reviewQ).length");
        if(n!==r0)throw new Error(`应回到 ${r0}，实为 ${n}`);return `回到 ${n} 题`;});
      step("localStorage 也回滚了",()=>{
        const stored=JSON.parse(w.localStorage.getItem("b7:tester:attempts")||"[]");
        if(stored.length!==a0)throw new Error(`存储里还有 ${stored.length} 条`);return "已落盘";});
    }catch(e){console.log("  FAIL 即时模式放弃:",e.message);errs.push("cancel-now");}
  })();

  console.log("\n=== 放弃不误删别的收藏 ===");
  await (async()=>{
    try{
      ev(`settings.reveal="now";saveSettings();marks={};hls={};vocab=[]`);
      ev(`startRun(pick({sec:2,doms:["H"],skills:[],bands:[],diffs:[],n:2,fresh:true}),{label:"keepstuff",timed:false})`);
      ev(`toggleMark(run.qs[0].id); addHl(run.qs[0].id,"the"); vocab.push({w:"x",ctx:"y",qid:run.qs[0].id,sk:"s",ts:Date.now()});saveVocab()`);
      await ev("cancelRun()"); await new Promise(r=>setTimeout(r,200));
      step("标记保留",()=>{const n=ev("Object.keys(marks).length");if(n!==1)throw new Error(n);return "1 个";});
      step("高亮保留",()=>{const n=ev("Object.keys(hls).length");if(n!==1)throw new Error(n);return "1 题";});
      step("生词保留",()=>{const n=ev("vocab.length");if(n!==1)throw new Error(n);return "1 条";});
    }catch(e){console.log("  FAIL 收藏保留:",e.message);errs.push("keepstuff");}
  })();

  console.log("\n=== 放弃可取消（点了「否」不该动数据）===");
  await (async()=>{
    try{
      ev(`settings.reveal="now";saveSettings()`);
      ev(`startRun(pick({sec:2,doms:["P"],skills:[],bands:[],diffs:[],n:2,fresh:true}),{label:"nope",timed:false})`);
      ev(`(function(){const q=run.qs[0];run.state[0].picked=q.an[0]})()`);
      await ev("submit()"); await new Promise(r=>setTimeout(r,120));
      const a1=ev("attempts.length");
      w.__confirm=false;                       // 模拟用户点「取消」
      await ev("cancelRun()"); await new Promise(r=>setTimeout(r,150));
      w.__confirm=true;
      step("确认框点否则不动",()=>{
        if(!ev("run"))throw new Error("run 被清了");
        if(ev("attempts.length")!==a1)throw new Error("数据被改了");
        return "run 还在、数据不变";});
      await ev("endRun()"); await new Promise(r=>setTimeout(r,200)); ev("closeRun()");
    }catch(e){console.log("  FAIL 取消确认:",e.message);errs.push("confirm-no");}
  })();

  console.log("\n=== 正常保存路径仍然有效 ===");
  await (async()=>{
    try{
      ev(`settings.reveal="end";saveSettings()`);
      const a0=ev("attempts.length"), s0=ev("sessions.length");
      ev(`startRun(pick({sec:2,doms:["S"],skills:[],bands:[],diffs:[],n:3,fresh:true}),{label:"keep",timed:false})`);
      ev(`run.state.forEach((s,k)=>{s.picked=run.qs[k].an[0]})`);
      await ev("endRun()"); await new Promise(r=>setTimeout(r,300));
      step("结束仍会保存",()=>{const a=ev("attempts.length"),s=ev("sessions.length");
        if(a!==a0+3)throw new Error(`作答 ${a0}->${a}`);
        if(s!==s0+1)throw new Error(`场次 ${s0}->${s}`);
        return `作答 +3，场次 +1`;});
      ev("closeRun()");
    }catch(e){console.log("  FAIL 正常保存:",e.message);errs.push("normal-save");}
  })();


  console.log("\n=== 新账号默认值 ===");
  step("水平默认未设置",()=>{const lv=ev("userLevel()");
    if(lv.rw!==null||lv.math!==null)throw new Error(JSON.stringify(lv));
    if(lv.source!=="unset")throw new Error(lv.source);
    if(ev("levelSet()"))throw new Error("levelSet 说已设置");
    return "rw=null math=null source=unset";});
  step("首页 band 条显示未设置",()=>{ev(`gotoView("home")`);
    const t=[...D.querySelectorAll(".meter .now")].map(x=>x.textContent);
    if(!t.every(x=>x.includes("未设置")))throw new Error(t.join(" | "));
    if(D.querySelectorAll(".meter .band.on").length)throw new Error("不该点亮任何 band");
    if(!D.querySelector("#app").innerHTML.includes("做一次完整模考"))throw new Error("缺引导");
    return t.join(" | ");});
  step("未设水平时不限制分数段",()=>{const b=ev("cfgFromLevel()");
    if(b.length)throw new Error(JSON.stringify(b));return "bands=[]（不限制）";});
  step("默认不计时",()=>{if(ev("cfg.timed"))throw new Error("默认开着");return "cfg.timed=false";});
  step("设置里能开计时",()=>{ev(`gotoView("settings")`);
    const h=D.querySelector("#app").innerHTML;
    if(!h.includes("默认是否计时"))throw new Error("没有开关");
    ev(`cfg.timed=true; lsSet(K("timed"), true)`);
    if(!ev(`lsGet(K("timed"),false)`))throw new Error("没存住");
    ev(`cfg.timed=false; lsSet(K("timed"), false)`);
    return "可开关且持久化";});
  step("手动设水平",()=>{ev(`(function(){const c=userLevel();c.rw=5;c.source="manual";setUserLevel(c)})()`);
    const lv=ev("userLevel()");
    if(lv.rw!==5||lv.source!=="manual")throw new Error(JSON.stringify(lv));
    const b=ev(`cfg.sec=1; cfgFromLevel()`);
    if(JSON.stringify(b)!=="[5,6,7]")throw new Error(JSON.stringify(b));
    return "rw=5 -> bands "+JSON.stringify(b);});
  step("可清回未设置",()=>{ev(`(function(){const c=userLevel();c.rw=null;c.math=null;c.source="unset";setUserLevel(c)})()`);
    if(ev("levelSet()"))throw new Error("没清掉");return "已清空";});

  console.log("\n=== 结果 ===");
  console.log(errs.length?`失败 ${errs.length} 项:\n  `+errs.join("\n  "):"全部通过 ✓");
  process.exit(errs.length?1:0);
})();
