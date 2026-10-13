#!/usr/bin/env node
/*
 * 划词高亮 / 生词本 归属测试。
 * 原 bug：弹窗取当前题用的是 (run && run.qs[run.i]) || (previewQid && BYID[previewQid])，
 * 而 openFullscreen / openBrowse 两个视图都不设这两者 —— 在那里划词拿不到题：
 * 高亮按钮报「这里不能高亮」，存进生词本的条目 qid 为 null，「看原题」跟着失效。
 * 修复：给 DOM 打 data-qid，从选中位置反查所属题目。
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

/* 在某个 .qtext 里模拟一次划词，返回弹窗解析出的题号 */
function simulateSelect(container){
  const box = container.querySelector(".qtext");
  if(!box) throw new Error("容器里没有 .qtext");
  const tw = D.createTreeWalker(box, 4 /*TEXT*/, null);
  let node=null;
  while((node=tw.nextNode())) if(node.nodeValue.trim().length>8) break;
  if(!node) throw new Error("找不到可选中的文字");
  const word = node.nodeValue.trim().split(/\s+/).find(x=>x.length>5) || node.nodeValue.trim().slice(0,8);
  // 复刻 initVocabSelection 里的归属逻辑
  const host = node.parentElement;
  if(!host.closest(".qtext")) throw new Error("不在 .qtext 内");
  const holder = host.closest("[data-qid]");
  const qid = holder ? holder.dataset.qid : null;
  return {qid, word, hasHolder: !!holder};
}

(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  ev(`createProfile("tester");CURRENT="tester";lsSet("b7_session","tester");enterApp("")`);
  await new Promise(r=>setTimeout(r,300));
  const withStim = ev(`BANK.findIndex(q=>q.sti && q.sec===1)`);

  step("答题界面能反查题号",()=>{
    ev(`startRun([BANK[${withStim}]],{label:"h",timed:false})`);
    const body = D.querySelector("#view-run .runbody");
    if(!body.dataset.qid) throw new Error("runbody 没有 data-qid");
    const r = simulateSelect(body);
    if(r.qid !== ev(`BANK[${withStim}].id`)) throw new Error("题号不对: "+r.qid);
    return `材料里划词 → ${r.qid}`;});

  step("答题界面选项区也能反查",()=>{
    ev(`run.state[0].picked = run.qs[0].an[0]`);
    const opts = D.querySelector("#view-run .opts");
    if(opts){
      const r = simulateSelect(opts.closest("[data-qid]") ? opts : D.querySelector("#view-run .runbody"));
      if(!r.qid) throw new Error("选项区反查不到");
      return "选项区 → "+r.qid;
    }
    return "此题无选项区（填空题）";});
  ev("closeRun()");

  step("全屏模式能反查题号（原来是 null）",()=>{
    ev(`openFullscreen([BANK[${withStim}]],"t",0,{reveal:true})`);
    const body = D.querySelector("#view-run .runbody");
    if(!body.dataset.qid) throw new Error("全屏 runbody 没有 data-qid");
    const r = simulateSelect(body);
    if(!r.hasHolder) throw new Error("反查不到归属");
    if(r.qid !== ev(`BANK[${withStim}].id`)) throw new Error("题号不对: "+r.qid);
    return `全屏划词 → ${r.qid}`;});
  step("全屏注册了就地重绘",()=>{
    if(!ev("typeof redrawOverlay === 'function'")) throw new Error("没注册");
    return "redrawOverlay 已挂上";});

  step("只看不做：多张卡各自反查到自己的题",()=>{
    ev(`document.querySelector("#view-run").innerHTML=""`);
    ev(`openBrowse(BANK.filter(q=>q.sti&&q.sec===1).slice(0,3),"b")`);
    const cards = [...D.querySelectorAll("#view-run .viewcard")];
    if(cards.length!==3) throw new Error("卡片数 "+cards.length);
    const ids = cards.map(c=>c.dataset.qid);
    if(ids.some(x=>!x)) throw new Error("有卡片没打 data-qid");
    if(new Set(ids).size!==3) throw new Error("题号重复");
    const r0 = simulateSelect(cards[0]), r2 = simulateSelect(cards[2]);
    if(r0.qid!==ids[0]) throw new Error("第1张卡反查错");
    if(r2.qid!==ids[2]) throw new Error("第3张卡反查错");
    return `3 张卡分别归属 ${ids[0].slice(0,6)} / ${ids[1].slice(0,6)} / ${ids[2].slice(0,6)}`;});

  step("只看不做里的高亮会被渲染出来（原来一个都不渲染）",()=>{
    const cards = [...D.querySelectorAll("#view-run .viewcard")];
    const qid = cards[1].dataset.qid;
    const r = simulateSelect(cards[1]);
    ev(`addHl(${JSON.stringify(qid)}, ${JSON.stringify(r.word)})`);
    ev(`openBrowse(BANK.filter(q=>q.sti&&q.sec===1).slice(0,3),"b")`);
    const marks = D.querySelectorAll("#view-run .viewcard mark.hl");
    if(!marks.length) throw new Error("高亮没渲染");
    const owner = marks[0].closest(".viewcard").dataset.qid;
    if(owner !== qid) throw new Error("高亮跑到别的卡上了");
    return `${marks.length} 处高亮，落在正确的那张卡`;});

  step("错题本右栏能反查题号",()=>{
    ev(`document.querySelector("#view-run").innerHTML="";
        document.querySelector("#view-run").classList.add("hide");
        redrawOverlay=null;
        attempts=[{aid:"a1",qid:BANK[${withStim}].id,sec:1,dom:BANK[${withStim}].dom,sk:BANK[${withStim}].sk,
          df:"M",bd:4,picked:"A",correct:"B",ok:false,ms:1000,ts:Date.now()}];
        saveLocal(); listTab="wrong"; folder={by:"all",val:""};
        logFilter={sec:0,dom:"",onlyDue:false,hideMastered:false}; gotoView("log")`);
    const pv = D.querySelector(".logpreview .qpanel");
    if(!pv) throw new Error("右栏没渲染");
    if(!pv.dataset.qid) throw new Error("qpanel 没有 data-qid");
    const r = simulateSelect(pv);
    if(r.qid !== ev(`BANK[${withStim}].id`)) throw new Error("题号不对");
    return `错题本右栏 → ${r.qid}`;});

  step("生词本条目带上了正确的 qid",()=>{
    const qid = ev(`BANK[${withStim}].id`);
    ev(`vocab=[]; vocab.push({w:"test",ctx:"ctx",qid:${JSON.stringify(qid)},sk:"s",ts:Date.now()}); saveVocab();
        gotoView("vocab")`);
    const b=[...D.querySelectorAll(".vcard button")].map(x=>x.textContent);
    if(!b.includes("看原题")) throw new Error("看原题按钮没出现，说明 qid 为空");
    return "qid 有值，「看原题」可用";});

  console.log(errs.length?`\n失败 ${errs.length} 项`:"\n全部通过 ✓");
  process.exit(errs.length?1:0);
})();
