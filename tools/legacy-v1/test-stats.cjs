#!/usr/bin/env node
/*
 * 掌握度统计口径测试。
 * 复现这个真实 bug：原来按「每次作答」计数，导致
 *   1) 重做错题让同一道题反复计入（重做的都是原本做错的，越练越低）
 *   2) 模考里时间到未作答的题以 ok:false 入库，全算错
 *   3) 同一道题做对多次重复计入
 * 正确口径：按题去重、取每题最近一次、未作答不计入。
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

  // 造一个能复现原 bug 的场景：
  // 同考点 4 道题。第 1 题先错后对（重做改对），第 2 题一直对，
  // 第 3 题模考时没作答（入库 ok:false），第 4 题错。
  ev(`(function(){
    const qs = BANK.filter(q=>q.sk==="Boundaries").slice(0,4);
    window.__qs = qs;
    const mk=(q,ok,picked,ts)=>({aid:"a"+Math.random(),qid:q.id,sec:q.sec,dom:q.dom,sk:q.sk,
      df:q.df,bd:q.bd,picked:picked,correct:q.an.join("|"),ok:ok,ms:40000,ts:ts});
    attempts = [
      mk(qs[0], false, "A", 1000),      // 第1题 初次错
      mk(qs[0], false, "A", 2000),      // 第1题 重做又错
      mk(qs[0], true,  qs[0].an[0], 3000), // 第1题 最后做对
      mk(qs[1], true,  qs[1].an[0], 1000), // 第2题 对
      mk(qs[1], true,  qs[1].an[0], 2000), // 第2题 又对（重复计入）
      mk(qs[2], false, "", 1000),       // 第3题 模考未作答，入库 ok:false
      mk(qs[3], false, "B", 1000),      // 第4题 错
    ];
    saveLocal();
  })()`);

  step("按次算会得出偏低的结果（复现原 bug）",()=>{
    const byTry = ev(`(function(){
      const rows=attempts.filter(r=>r.sk==="Boundaries");
      return [rows.length, rows.filter(r=>r.ok).length];
    })()`);
    const acc = Math.round(byTry[1]/byTry[0]*100);
    if(acc!==43) throw new Error(`按次算应为 3/7=43%，实为 ${byTry[1]}/${byTry[0]}=${acc}%`);
    return `按次算 = ${byTry[1]}/${byTry[0]} = ${acc}%（这就是你看到的偏低数字）`;});

  step("按题算得出正确结果",()=>{
    const st = ev(`skillStats("SEC","Boundaries")`);
    // 4 道题里第3题未作答不计入 → 分母 3；第1题取最近一次(对)、第2题对、第4题错 → 2/3
    if(st.n!==3) throw new Error(`分母应为 3（未作答的不计入），实为 ${st.n}`);
    if(st.ok!==2) throw new Error(`分子应为 2，实为 ${st.ok}`);
    if(st.acc!==67) throw new Error(`正确率应为 67%，实为 ${st.acc}%`);
    return `按题算 = ${st.ok}/${st.n} = ${st.acc}%（练了 ${st.tries} 次）`;});

  step("重做改对后按最近一次算",()=>{
    const st = ev(`skillStats("SEC","Boundaries")`);
    const first = ev(`window.__qs[0].id`);
    const hit = st.rows.find(r=>r.qid===first);
    if(!hit) throw new Error("第1题没进统计");
    if(!hit.ok) throw new Error("第1题最后做对了，却按错算");
    return "第1题错→错→对，取最后那次（对）";});

  step("未作答的题不计入",()=>{
    const st = ev(`skillStats("SEC","Boundaries")`);
    const third = ev(`window.__qs[2].id`);
    if(st.rows.some(r=>r.qid===third)) throw new Error("未作答的题被算进去了");
    return "模考未作答的题已排除";});

  step("练习次数单独保留",()=>{
    const st = ev(`skillStats("SEC","Boundaries")`);
    if(st.tries!==7) throw new Error(`tries 应为 7，实为 ${st.tries}`);
    return `tries=7 与 n=3 分开报告`;});

  step("卡片上写明两个口径",()=>{
    ev(`gotoView("home"); skillOpen="SEC|Boundaries"; render()`);
    const t = D.querySelector(".skcard.open .skline").textContent.replace(/\s+/g," ");
    if(!t.includes("道不同的题")) throw new Error(t);
    if(!t.includes("共练 7 次")) throw new Error("没写明练习次数: "+t);
    return t.trim().slice(0,58);});

  step("首页 band 条也按题算",()=>{
    const st = ev(`statsByQuestion(r=>r.sec===1 && r.dom!=="ZZ")`);
    if(st.n!==3) throw new Error(`应为 3，实为 ${st.n}`);
    return `R&W 做过 ${st.n} 道题，正确率 ${st.acc}%`;});

  console.log(errs.length?`\n失败 ${errs.length} 项`:"\n全部通过 ✓");
  process.exit(errs.length?1:0);
})();
