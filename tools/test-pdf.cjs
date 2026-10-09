#!/usr/bin/env node
/*
 * PDF 导入测试。
 * 原 bug：workerSrc 直接指向 cdnjs 的跨域地址。浏览器同源策略禁止用跨域 URL
 * 构造 Worker，pdf.js 退回主线程「假 worker」而那条退路在 3.x 上常常也失败 ——
 * 文档对象建出来了、不报错，但每页 getTextContent() 返回空，表现为「没读到文字」。
 * 修复：用 blob 包一层，worker 内部 importScripts() 允许跨域。
 *
 * jsdom 没有 Worker，真实 worker 路径测不了。这里测两件能测的：
 *   A. blob 包装是否正确构造（拿到的是 blob: 开头的 URL，内容是 importScripts(真实地址)）
 *   B. 提取算法在真 College Board PDF 上是否确实出文字（用 node 版 pdfjs 跑）
 * 需要 /tmp/cb.pdf，没有就跳过 B。
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const errs=[];
let blobSource = null;
const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
  runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
  beforeParse(w){
    w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
    w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
    w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
    w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
    w.JSZip=function(){};w.requestAnimationFrame=cb=>setTimeout(cb,0);
    w.confirm=()=>true;
    // 捕获 blob 内容
    w.URL.createObjectURL=(b)=>{ blobSource = b; return "blob:mock-"+Math.random().toString(36).slice(2,7); };
    w.URL.revokeObjectURL=()=>{};
    w.pdfjsLib = {GlobalWorkerOptions:{workerSrc:null}, getDocument:()=>({promise:Promise.reject(new Error("stub"))})};
  }});
const w=dom.window,ev=s=>w.eval(s);
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){console.log(`  FAIL ${n}: ${e.message}`);errs.push(n);}};

(async()=>{
  await new Promise(r=>setTimeout(r,3000));
  console.log("=== A. worker 用 blob 包装 ===");
  step("不再直接把跨域 URL 当 workerSrc",()=>{
    if(/workerSrc\s*=\s*\n?\s*"https:/.test(html)) throw new Error("源码里还有直接赋跨域 URL 的写法");
    return "已改为 blob 包装";});
  step("setupPdfWorker 产出 blob: URL",()=>{
    ev(`setupPdfWorker()`);
    const src = ev(`pdfjsLib.GlobalWorkerOptions.workerSrc`);
    if(!String(src).startsWith("blob:")) throw new Error("workerSrc = "+src);
    return src;});
  step("blob 内容是 importScripts(真实 worker 地址)",async()=>{});
  await (async()=>{
    try{
      if(!blobSource) throw new Error("没捕获到 blob");
      const txt = await blobSource.text();
      if(!txt.startsWith("importScripts(")) throw new Error(txt.slice(0,40));
      if(!txt.includes("pdf.worker.min.js")) throw new Error("没引用 worker 脚本: "+txt);
      console.log("  ok  blob 内容是 importScripts(真实 worker 地址) — "+txt.trim());
    }catch(e){ console.log("  FAIL blob 内容:", e.message); errs.push("blob"); }
  })();
  step("重复调用只构造一次",()=>{
    const before = ev(`pdfjsLib.GlobalWorkerOptions.workerSrc`);
    ev(`setupPdfWorker(); setupPdfWorker()`);
    if(ev(`pdfjsLib.GlobalWorkerOptions.workerSrc`) !== before) throw new Error("被重复覆盖");
    return "幂等";});
  step("诊断信息会被记录",()=>{
    if(!html.includes("window.__pdfDiag")) throw new Error("没有诊断变量");
    if(!html.includes("各页文字块数")) throw new Error("错误提示里没有逐页块数");
    return "记录页数与逐页文字块数，失败时报出来";});

  console.log("\n=== B. 提取算法跑真 College Board PDF ===");
  const pdfPath = "/tmp/cb.pdf";
  if(!fs.existsSync(pdfPath)){
    console.log("  skip 没有 /tmp/cb.pdf，跳过（下载：curl -sL -o /tmp/cb.pdf https://satsuite.collegeboard.org/media/pdf/sat-practice-test-11-digital.pdf）");
  }else{
    try{
      const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
      const buf = new Uint8Array(fs.readFileSync(pdfPath));
      const pdf = await pdfjs.getDocument({data:buf}).promise;
      // 与线上 extractPdf 相同的分行逻辑
      const out=[], itemCounts=[];
      for(let p=1;p<=Math.min(pdf.numPages,6);p++){
        const page=await pdf.getPage(p), tc=await page.getTextContent();
        itemCounts.push(tc.items.length);
        let last=null,line="";const lines=[];
        tc.items.forEach(it=>{
          const y=it.transform[5];
          if(last!==null && Math.abs(y-last)>3){ lines.push(line.trim()); line=""; }
          line += it.str + (it.hasEOL?" ":""); last=y;
        });
        if(line.trim()) lines.push(line.trim());
        out.push(lines.filter(Boolean).join("\n"));
      }
      const text = out.join("\n\n");
      step("真 PDF 能提取出文字",()=>{
        if(text.length < 500) throw new Error("只提取到 "+text.length+" 字符");
        return `前 6 页共 ${text.length} 字符，各页文字块数 ${itemCounts.join("/")}`;});
      step("提取内容像 SAT 试卷",()=>{
        if(!/DIRECTIONS|CONTINUE|practice test/i.test(text)) throw new Error("内容不像试卷");
        const hit = (text.match(/DIRECTIONS|CONTINUE|practice test/ig)||[]).slice(0,3);
        return "命中关键词 "+hit.join(", ");});
      step("分行正确（不是糊成一行）",()=>{
        const lines = text.split("\n").filter(x=>x.trim());
        if(lines.length < 20) throw new Error("只有 "+lines.length+" 行");
        return lines.length+" 行";});
    }catch(e){
      console.log("  FAIL 真 PDF 提取:", e.message); errs.push("realpdf");
    }
  }
  console.log(errs.length?`\n失败 ${errs.length} 项`:"\n全部通过 ✓");
  process.exit(errs.length?1:0);
})();
