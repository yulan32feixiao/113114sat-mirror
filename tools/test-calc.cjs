#!/usr/bin/env node
/*
 * 计算器测试：算得对不对、键盘输入走不走得通。
 *   node tools/test-calc.cjs
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
    w.confirm=()=>true;w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};}});
const w=dom.window;
let bad=0,n=0;
const near=(a,b)=>Math.abs(a-b)<1e-9;
const calc=(expr,want,note)=>{
  n++;
  let got,err=null;
  try{ got=w.eval(`calcEval(${JSON.stringify(expr)})`); }catch(e){ err=e.message; }
  const ok = err===null && near(got,want);
  if(!ok) bad++;
  console.log(`  ${ok?"ok ":"FAIL"} ${expr}  期望 ${want}  实际 ${err?("报错："+err):got}${note?"  ("+note+")":""}`);
};
const rejects=(expr,note)=>{
  n++;
  let threw=false;
  try{ w.eval(`calcEval(${JSON.stringify(expr)})`); }catch(e){ threw=true; }
  if(!threw) bad++;
  console.log(`  ${threw?"ok ":"FAIL"} ${expr}  期望拒绝  实际${threw?"拒绝":"放行"}${note?"  ("+note+")":""}`);
};
const step=(name,fn)=>{ n++; try{ console.log("  ok  "+name+" — "+fn()); }
  catch(e){ bad++; console.log("  FAIL "+name+" — "+e.message); } };

(async()=>{
  await new Promise(r=>setTimeout(r,3000));

  console.log("=== 四则与优先级 ===");
  calc("1+2*3", 7, "先乘后加");
  calc("6÷2×3", 9, "同级从左到右");
  calc("6/2*3", 9);
  calc("(1+2)*3", 9);
  calc("10−3−2", 5, "面板上的减号是 U+2212");
  calc("2^10", 1024);
  calc("50%", 0.5, "原来 (\\d)%只吃一位数，50% 会算崩");
  calc("200*15%", 30);
  calc("(2+3)%", 0.05);

  console.log("\n=== 函数（ln 之前一直是坏的：Math.log 又被 log→log10 改了一遍）===");
  calc("ln(1)", 0);
  calc("ln(2.718281828459045)", 1, "ln e = 1");
  calc("log(1000)", 3, "log 是以 10 为底");
  calc("√(16)", 4);
  calc("sqrt(9)", 3);
  calc("π", Math.PI);
  calc("E", Math.E);

  console.log("\n=== 隐式乘法（真计算器都认）===");
  calc("2(3+1)", 8);
  calc("(2)(3)", 6);
  calc("2√(9)", 6);

  console.log("\n=== 拒绝不该放行的东西 ===");
  rejects("alert(1)", "白名单之外的名字");
  rejects("constructor", "不能靠原型链绕过白名单");
  rejects("1/0", "结果不是有限数");

  console.log("\n=== 键盘：计算器开着的时候归计算器 ===");
  step("数字键进的是计算器不是 ABCD", ()=>{
    w.eval(`calcExpr=""; calcAns=""; calcOpen=true;`);
    // calcKeydown 不碰 DOM，直接喂键
    ["1","2","+","3"].forEach(k=>w.eval(`calcKeydown({key:${JSON.stringify(k)}})`));
    const ex = w.eval("calcExpr");
    if(ex!=="12+3") throw new Error("calcExpr = "+ex);
    w.eval(`calcKeydown({key:"Enter"})`);
    const ans = w.eval("calcAns");
    if(ans!=="15") throw new Error("Enter 之后 calcAns = "+ans);
    return "12+3 → 15";
  });
  step("* 和 / 显示成 × ÷", ()=>{
    w.eval(`calcExpr=""; calcAns="";`);
    ["6","/","2","*","3"].forEach(k=>w.eval(`calcKeydown({key:${JSON.stringify(k)}})`));
    const ex = w.eval("calcExpr");
    if(ex!=="6÷2×3") throw new Error("calcExpr = "+ex);
    if(w.eval("calcAns")!=="9") throw new Error("边打边算的结果 = "+w.eval("calcAns"));
    return ex+" = 9";
  });
  step("Backspace / C 有用", ()=>{
    w.eval(`calcExpr="123"; calcAns="";`);
    w.eval(`calcKeydown({key:"Backspace"})`);
    if(w.eval("calcExpr")!=="12") throw new Error("退格后 = "+w.eval("calcExpr"));
    w.eval(`calcKeydown({key:"c"})`);
    if(w.eval("calcExpr")!=="") throw new Error("清空后 = "+w.eval("calcExpr"));
    return "退格清空都正常";
  });
  step("带修饰键的组合不被吃掉", ()=>{
    const got = w.eval(`calcKeydown({key:"1", metaKey:true})`);
    if(got!==false) throw new Error("Cmd+1 被计算器吃了");
    return "Cmd/Ctrl 组合放行";
  });

  console.log("\n=== 结果 ===");
  console.log(bad? `失败 ${bad} / ${n} 项` : `全部通过 ✓ (${n} 条)`);
  process.exit(bad?1:0);
})();
