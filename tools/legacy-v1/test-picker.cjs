#!/usr/bin/env node
/*
 * 题源（pick 的 src）与「一题没做不留记录」的测试。
 *   node tools/test-picker.cjs
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
  ev(`createProfile("t2");CURRENT="t2";lsSet("b7_session","t2");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));

  // 造三道 R&W 的题：一道做错、一道做对、一道标记
  ev(`
    window.__q = BANK.filter(q=>q.sec===1).slice(0,3);
    const now=Date.now();
    attempts = [
      {aid:"a1", qid:__q[0].id, sec:1, dom:__q[0].dom, sk:__q[0].sk, df:__q[0].df, bd:__q[0].bd,
       ok:false, ms:1000, ts:now, session:"测试练习", sid:"stest"},
      {aid:"a2", qid:__q[1].id, sec:1, dom:__q[1].dom, sk:__q[1].sk, df:__q[1].df, bd:__q[1].bd,
       ok:true, ms:1000, ts:now, session:"测试练习", sid:"stest"}
    ];
    marks = {}; marks[__q[2].id] = {ts:now, sk:__q[2].sk, dom:__q[2].dom};
    mastered = {};
  `);

  console.log("=== 题源 ===");
  const ids = n => ev(`pick({sec:1,doms:[],skills:[],bands:[],diffs:[],n:50,src:"${n}"}).map(q=>q.id)`);
  step("只出我错过的", ()=>{
    const r = ids("wrong"), want = ev("__q[0].id");
    if(r.length!==1 || r[0]!==want) throw new Error(JSON.stringify(r));
    return "1 题，正是那道错题";
  });
  step("只出我标记的", ()=>{
    const r = ids("marked"), want = ev("__q[2].id");
    if(r.length!==1 || r[0]!==want) throw new Error(JSON.stringify(r));
    return "1 题，正是标记的那道";
  });
  step("错的+标记", ()=>{
    const r = ids("wm");
    if(r.length!==2) throw new Error(JSON.stringify(r));
    return "2 题";
  });
  step("打了「已掌握」的错题不再被抽", ()=>{
    ev(`mastered[__q[0].id]=Date.now()`);
    const r = ids("wrong");
    ev(`mastered={}`);
    if(r.length!==0) throw new Error(JSON.stringify(r));
    return "0 题";
  });
  step("没做过的会跳过做过的", ()=>{
    const r = ids("fresh");
    if(r.includes(ev("__q[0].id")) || r.includes(ev("__q[1].id")))
      throw new Error("抽到了做过的题");
    return r.length+" 题，都没做过";
  });
  step("全部：做过的也在池子里", ()=>{
    const base = `{sec:1,doms:[],skills:[],bands:[],diffs:[],n:1e9`;
    const all   = ev(`pick(${base},src:"all"}).length`);
    const fresh = ev(`pick(${base},src:"fresh"}).length`);
    if(all - fresh !== 2) throw new Error(`全部 ${all}，没做过的 ${fresh}，差 ${all-fresh}，应当差 2`);
    return `全部 ${all} 题，其中 2 题做过`;
  });
  step("老配置 fresh:true 仍然按「没做过的」走", ()=>{
    const r = ev(`pick({sec:1,doms:[],skills:[],bands:[],diffs:[],n:20,fresh:true}).map(q=>q.id)`);
    if(r.includes(ev("__q[0].id"))) throw new Error("没有向下兼容");
    return "兼容";
  });

  console.log("\n=== 一题没做的练习不留记录 ===");
  {
    const before = ev("sessions.length"), beforeA = ev("attempts.length");
    ev(`startRun(BANK.filter(q=>q.sec===1).slice(10,13), {label:"空跑", timed:false})`);
    await ev(`endRun()`);
    await new Promise(r=>setTimeout(r,200));
    const after = ev("sessions.length"), afterA = ev("attempts.length");
    ev(`closeRunSilent(); run=null;`);
    step("一题都没选就结束 → 不记场次、不写作答", ()=>{
      if(after!==before) throw new Error(`场次 ${before} -> ${after}`);
      if(afterA!==beforeA) throw new Error(`作答 ${beforeA} -> ${afterA}`);
      return "场次和作答都没变";
    });
  }

  console.log("\n=== 错题本 / 生词本的左边菜单 ===");
  step("错题本默认按题型分", ()=>{
    ev(`folder={by:"skill",val:""}; listTab="wrong"; gotoView("log")`);
    const on = D.querySelector('#app .folders .gtabs button[aria-current="page"]');
    if(!on || on.textContent!=="按题型") throw new Error(on? on.textContent : "没有分组菜单");
    return on.textContent;
  });
  step("错题本有「按作业」这一档", ()=>{
    const tabs=[...D.querySelectorAll("#app .folders .gtabs button")].map(b=>b.textContent);
    if(!tabs.includes("按作业")) throw new Error(tabs.join("/"));
    return tabs.join(" / ");
  });
  step("按作业能分出那一场的名字", ()=>{
    ev(`folder={by:"session",val:""}; render()`);
    const names=[...D.querySelectorAll("#app .folderitem .fname")].map(e=>e.textContent);
    if(!names.includes("测试练习")) throw new Error(names.join("/")||"空");
    return names.join(" / ");
  });
  step("生词本也有左边菜单", ()=>{
    ev(`vocab=[{w:"tacit",ctx:"a tacit agreement.",sk:"Words in Context",qid:__q[0].id,ts:Date.now()}];
        gotoView("vocab")`);
    const on = D.querySelector('#app .folders .gtabs button[aria-current="page"]');
    if(!on) throw new Error("生词本没有分组菜单");
    if(on.textContent!=="按题型") throw new Error("默认是 "+on.textContent);
    return "默认 "+on.textContent;
  });

  console.log("\n=== 结果 ===");
  console.log(bad? `失败 ${bad} 项` : "全部通过 ✓");
  process.exit(bad?1:0);
})();
