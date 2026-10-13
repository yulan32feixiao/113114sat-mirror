#!/usr/bin/env node
/*
 * 序列化审计 —— 把全部 3,311 道题跑一遍 serializeQuestion()，
 * 检查喂给模型的纯文本有没有失真。这是「AI 不会看错题目」的验收手段。
 *   node tools/audit-serializer.cjs
 * 任何一项不为 0 就退出码 1。
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){
    w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
    w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>true;w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};
  }});
const w=dom.window,ev=s=>w.eval(s);
(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  const B=ev("BANK"), N=B.length;
  const checks={
    // 只查结构性残留：官方解析里 "inserted into the blank" 是正常英文，不算失真
    'sr-only 占位残留': t=>/[_]{3,}\s*blank|blank\s*[_]{3,}/i.test(t),
    'HTML 实体未解码':      t=>/&(nbsp|amp|lt|gt|rsquo|ldquo|rdquo|#\d+);/.test(t),
    '标签泄漏':             t=>/<\/?[a-zA-Z][^>]*>/.test(t),

    '公式降级为占位':       t=>/〔公式〕/.test(t),
    '题干为空':             t=>!/【问题】\s*\S/.test(t),
    '选项为空':             t=>{
      const m=t.match(/【选项】\n([\s\S]*?)\n\n【正确答案】/);
      if(!m) return false;
      return m[1].split(/\n(?=[A-D]\. )/).some(b=>!b.replace(/^[A-D]\.\s*/,"").trim());
    },
  };
  const counts={}, firstBad={};
  Object.keys(checks).forEach(k=>counts[k]=0);
  // 表格必须以 markdown 形式出现
  let tableQ=0, tableOk=0;
  for(let i=0;i<N;i++){
    const q=B[i];
    const t=ev(`serializeQuestion(BANK[${i}], null)`);
    for(const [k,f] of Object.entries(checks)){
      if(f(t)){ counts[k]++; if(!firstBad[k]) firstBad[k]=[q.id, t.replace(/\n/g,"⏎").slice(0,200)]; }
    }
    if(/<table/i.test(q.sti||"")){ tableQ++; if(/\n\|.*\|\n\|[-|]+\|/.test(t)) tableOk++; }
  }
  console.log(`扫描 ${N} 道题\n`);
  let fail=0;
  // College Board 本身没给 aria-label 的图：已知恰好 3 道，多了说明是新的回归
  let noDesc=0;
  for(let i=0;i<N;i++) if(/官方未提供文字描述/.test(ev(`serializeQuestion(BANK[${i}], null)`))) noDesc++;
  const NO_DESC_KNOWN = 3;
  const descBad = noDesc !== NO_DESC_KNOWN;
  if(descBad) fail++;
  console.log(`  ${descBad?"✗":"✓"} 官方未提供图描述的题: ${noDesc}（已知 ${NO_DESC_KNOWN} 道，`
    + `这些题系统提示会明确告知模型看不到图）`);
  for(const [k,v] of Object.entries(counts)){
    const bad=v>0; if(bad) fail++;
    console.log(`  ${bad?"✗":"✓"} ${k}: ${v}`);
    if(bad&&firstBad[k]) console.log(`      例 ${firstBad[k][0]}: ${firstBad[k][1]}`);
  }
  const tblBad = tableQ!==tableOk;
  if(tblBad) fail++;
  console.log(`  ${tblBad?"✗":"✓"} 表格保留为结构化形式: ${tableOk}/${tableQ}`);
  // 抽查一道带图带表的题，人眼可读
  const demo=B.findIndex(q=>/<table/i.test(q.sti||""));
  console.log("\n--- 抽样（含表格的题，模型将看到的原文）---\n");
  console.log(ev(`serializeQuestion(BANK[${demo}], null, {rationale:false})`).slice(0,900));
  console.log(fail?`\n不达标：${fail} 项`:"\n全部达标");
  process.exit(fail?1:0);
})();
