#!/usr/bin/env node
/*
 * 镜像站测试 —— 镜像和正式站同在 yulan32feixiao.github.io 下、共用一块 localStorage，
 * 必须做到：镜像第一次打开自动带上正式站的账号；之后镜像怎么折腾，正式站的键一个字节都不变。
 *   node tools/test-mirror.cjs
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const PROD="https://x.github.io/113114sat/", MIRROR="https://x.github.io/113114sat-mirror/";

// store: 一个普通对象，模拟「同一个浏览器」跨页面共享的 localStorage
const mk=(url, store, patch)=>{
  const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
    runScripts:"dangerously",pretendToBeVisual:true,url,
    beforeParse(w){
      w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
      w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
      w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
      Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
      w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
      w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
      w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;
      w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};
      w.__reloaded=0;
      try{ Object.defineProperty(w.location,"reload",{value:()=>{w.__reloaded++;},configurable:true}); }catch(e){}
      Object.entries(store||{}).forEach(([k,v])=>w.localStorage.setItem(k,v));
      if(patch) patch(w);
    }});
  return dom.window;
};
const dump=w=>{ const o={}; for(let i=0;i<w.localStorage.length;i++){ const k=w.localStorage.key(i); o[k]=w.localStorage.getItem(k);} return o; };
const pick=(o,re)=>Object.fromEntries(Object.entries(o).filter(([k])=>re.test(k)));
const isProd=k=>/^b7[_:]/.test(k), isMirror=k=>/^b7m[_:]/.test(k);
const same=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());

let bad=0;
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){bad++;console.log(`  FAIL ${n}: ${e.message}`);}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// 一份像样的正式站数据：两个档案、作答、错题、生词、标记、模型 key，外加同源别的项目的键
const att=(i,ok)=>({aid:"a"+i,qid:"q"+i,sec:1,dom:"INI",sk:"Inferences",bd:4,picked:"B",correct:"C",ok,ms:40000,ts:1759000000000+i*1000,sid:"s1"});
const PROD_DATA={
  "b7_users": JSON.stringify({"我":{created:1,level:{rw:5,math:6,source:"self"}},"同学":{created:2,level:{}}}),
  "b7_session": JSON.stringify("我"), "b7_last": JSON.stringify("我"), "b7_rs":"3", "b7_split":"62",
  "b7:我:attempts": JSON.stringify(Array.from({length:40},(_,i)=>att(i,i%3!==0))),
  "b7:我:review": JSON.stringify({q0:{box:1,due:1,adds:1}}),
  "b7:我:vocab": JSON.stringify([{w:"ubiquitous",ctx:"…",qid:"q1",ts:1}]),
  "b7:我:marks": JSON.stringify({q5:1}),
  "b7:我:providers": JSON.stringify([{id:"deepseek",name:"DeepSeek",base:"https://api.deepseek.com",model:"deepseek-v4-pro",key:"sk-REAL-SECRET",on:true}]),
  "b7:我:settings": JSON.stringify({key:"sk-OLD-SECRET",reveal:"end"}),
  "b7:同学:attempts": JSON.stringify([att(900,true)]),
  "thorp_bankroll": "1000"          // 同源下别的项目（21 点）的键，谁都不许碰
};

(async()=>{
  console.log("=== 正式站路径：命名空间不变 ===");
  {
    const w=mk(PROD, PROD_DATA); await wait(3000);
    step("正式站用 b7，不是镜像", ()=>{
      if(w.eval("NS")!=="b7" || w.eval("IS_MIRROR")) throw new Error("NS="+w.eval("NS"));
      if(w.document.querySelector(".mirrortag")) throw new Error("正式站出现了镜像角标");
      return "NS=b7";
    });
    step("正式站照常读到自己的数据", ()=>{
      if(w.eval("CURRENT")!=="我") throw new Error("CURRENT="+w.eval("CURRENT"));
      if(w.eval("attempts.length")!==40) throw new Error("attempts="+w.eval("attempts.length"));
      return "40 条作答";
    });
    step("正式站不会凭空长出镜像的键", ()=>{
      const m=Object.keys(dump(w)).filter(isMirror);
      if(m.length) throw new Error("多了 "+m.join(","));
    });
  }

  console.log("\n=== 镜像站第一次打开：自动复制正式站账号 ===");
  let after1;
  {
    const w=mk(MIRROR, PROD_DATA); await wait(3000);
    const D=w.document; after1=dump(w);
    step("镜像用 b7m", ()=>{ if(w.eval("NS")!=="b7m"||!w.eval("IS_MIRROR")) throw new Error("NS="+w.eval("NS")); });
    step("直接进了「我」，带着全部记录", ()=>{
      if(w.eval("CURRENT")!=="我") throw new Error("CURRENT="+w.eval("CURRENT"));
      if(w.eval("attempts.length")!==40) throw new Error("attempts="+w.eval("attempts.length"));
      if(w.eval("vocab.length")!==1) throw new Error("生词本没带过来");
      if(w.eval("Object.keys(marks).length")!==1) throw new Error("标记没带过来");
      if(w.eval("providers[0]&&providers[0].key")!=="sk-REAL-SECRET") throw new Error("同源复制应当连模型配置一起带上");
      return "40 作答 / 1 生词 / 1 标记 / 模型配置";
    });
    step("第二个档案、字号、分栏比例都过来了", ()=>{
      const u=JSON.parse(after1["b7m_users"]||"{}");
      if(!u["同学"]) throw new Error("没有「同学」");
      if(after1["b7m:同学:attempts"]!==PROD_DATA["b7:同学:attempts"]) throw new Error("同学的作答不一致");
      if(after1["b7m_rs"]!=="3"||after1["b7m_split"]!=="62") throw new Error("rs/split 没带");
      return "2 个档案";
    });
    step("正式站的键一个字节没变，别的项目的键也没动", ()=>{
      if(!same(pick(after1,/^b7[_:]/), pick(PROD_DATA,/^b7[_:]/))) throw new Error("正式站的键被改了");
      if(after1["thorp_bankroll"]!=="1000") throw new Error("21 点的键被动了");
      return Object.keys(pick(after1,/^b7[_:]/)).length+" 个正式站键原样";
    });
    step("一眼看得出是镜像", ()=>{
      if(!D.querySelector("#topbar .mirrortag")) throw new Error("顶栏没有「镜像」角标");
      if(!/镜像/.test(D.title)) throw new Error("标题没标镜像："+D.title);
      const t=D.querySelector("#toast"); return t? "提示："+t.textContent : "";
    });

    console.log("\n=== 在镜像里做题、改设置 ===");
    w.eval(`recordAttempt(${JSON.stringify(att(500,false))}); collect("q500","test"); flushReview();
            settings.reveal="now"; saveSettings(); marks.q9=1; saveMarks();`);
    await wait(50);
    const after2=dump(w);
    step("镜像的记录变了", ()=>{
      if(JSON.parse(after2["b7m:我:attempts"]).length!==41) throw new Error("镜像作答没写进去");
      if(!JSON.parse(after2["b7m:我:review"]).q500) throw new Error("镜像错题没写进去");
    });
    step("正式站依旧一个字节没变", ()=>{
      if(!same(pick(after2,/^b7[_:]/), pick(PROD_DATA,/^b7[_:]/))) throw new Error("正式站的键被改了");
    });
    after1=after2;
  }

  console.log("\n=== 再次打开镜像：不重复复制，镜像自己的进度保留 ===");
  {
    const changedProd=Object.assign({}, after1, {"b7:我:attempts": JSON.stringify([att(1,true)])});
    const w=mk(MIRROR, changedProd); await wait(3000);
    step("没有被正式站覆盖", ()=>{
      if(w.eval("attempts.length")!==41) throw new Error("attempts="+w.eval("attempts.length")+"（应保留镜像的 41）");
      return "41 条";
    });
    step("手动「从正式站重新复制」会整体换成正式站现在的样子", ()=>{
      const r=w.eval("copyFromProd()");
      if(!r.ok) throw new Error(r.why);
      const d=dump(w);
      if(d["b7m:我:attempts"]!==changedProd["b7:我:attempts"]) throw new Error("没换成正式站的");
      if(JSON.parse(d["b7m_settings"]||"null")) throw new Error("多出了奇怪的键");
      if(!same(pick(d,/^b7[_:]/), pick(changedProd,/^b7[_:]/))) throw new Error("正式站的键被改了");
      if(!d["b7m_mirror"]) throw new Error("没记下复制时间");
      return r.keys+" 项";
    });
  }

  console.log("\n=== 空间不够：拒绝复制，正式站不受影响 ===");
  {
    const big=Object.assign({}, PROD_DATA, {"b7:我:threads": JSON.stringify({x:"z".repeat(1600000)})});
    const w=mk(MIRROR, big); await wait(3000);
    const d=dump(w);
    step("超过安全线就不复制", ()=>{
      if(d["b7m:我:attempts"]) throw new Error("还是复制了");
      if(d["b7m_mirror"]) throw new Error("不该记录复制成功");
      const t=w.document.querySelector("#toast");
      if(!t || !/没能从正式站复制/.test(t.textContent)) throw new Error("没告诉用户为什么："+(t&&t.textContent));
      return t.textContent.slice(0,60)+"…";
    });
    step("正式站原样", ()=>{ if(!same(pick(d,/^b7[_:]/), pick(big,/^b7[_:]/))) throw new Error("正式站的键被改了"); });
  }

  console.log("\n=== 写到一半存储爆了：整体回滚 ===");
  {
    const w=mk(MIRROR, after1); await wait(3000);
    const before=dump(w);
    let n=0;
    const orig=w.Storage.prototype.setItem;
    // 第 4 次写镜像键时报满（只报这一次：回滚时先删掉写了一半的键，空间就腾出来了，和真浏览器一样）
    w.Storage.prototype.setItem=function(k,v){ if(/^b7m:/.test(k) && ++n===4) throw new w.DOMException("full","QuotaExceededError"); return orig.call(this,k,v); };
    const r=w.eval("copyFromProd()");
    w.Storage.prototype.setItem=orig;
    const d=dump(w);
    step("报告失败", ()=>{ if(r.ok) throw new Error("应当失败"); return r.why; });
    step("镜像回到复制前的样子", ()=>{ if(!same(pick(d,/^b7m[_:]/), pick(before,/^b7m[_:]/))) throw new Error("镜像没回滚干净"); });
    step("正式站原样", ()=>{ if(!same(pick(d,/^b7[_:]/), pick(before,/^b7[_:]/))) throw new Error("正式站的键被改了"); });
  }

  console.log("\n=== 原样备份 / 恢复 ===");
  {
    const w=mk(MIRROR, after1); await wait(3000);
    const b=w.eval("rawBackup()");
    step("备份带全部数据、不带 API key", ()=>{
      const txt=JSON.stringify(b);
      if(/sk-REAL-SECRET|sk-OLD-SECRET/.test(txt)) throw new Error("API key 漏进了备份");
      for(const t of [":我:attempts",":我:vocab",":我:marks",":同学:attempts","_users"])
        if(!(t in b.data)) throw new Error("缺 "+t);
      if(Object.keys(b.data).some(t=>/^b7/.test(t))) throw new Error("尾巴里不该带前缀");
      return Object.keys(b.data).length+" 项";
    });
    // 换一个干净的本地开发环境（不同源）恢复
    const w2=mk("http://localhost:8080/", {"b7m:我:providers": JSON.stringify([{id:"deepseek",key:"sk-LOCAL",on:true,base:"b",model:"m"}])});
    await wait(3000);
    const r=w2.eval(`restoreRaw(${JSON.stringify(b)})`);
    const d2=dump(w2);
    step("恢复成功，数据一致", ()=>{
      if(!r.ok) throw new Error(r.why);
      if(d2["b7m:我:attempts"]!==after1["b7m:我:attempts"]) throw new Error("作答不一致");
      if(d2["b7m:我:vocab"]!==after1["b7m:我:vocab"]) throw new Error("生词本不一致");
      return r.keys+" 项";
    });
    step("本机已配的 API key 没被空 key 冲掉", ()=>{
      const p=JSON.parse(d2["b7m:我:providers"]);
      if(p[0].key!=="sk-LOCAL") throw new Error("key="+p[0].key);
    });
    step("不是原样备份的文件会被拒绝", ()=>{
      const r2=w2.eval(`restoreRaw({_format:"band-seven-progress",attempts:[]})`);
      if(r2.ok) throw new Error("居然接受了");
      return r2.why;
    });
  }

  console.log("\n=== 没有正式站数据的浏览器打开镜像 ===");
  {
    const w=mk(MIRROR, {}); await wait(3000);
    step("和空浏览器一样，建默认档案直接进", ()=>{
      if(w.document.querySelector("#gate")) throw new Error("弹了选人界面");
      if(w.eval("CURRENT")!==w.eval("DEFAULT_PROFILE")) throw new Error("CURRENT="+w.eval("CURRENT"));
      if(Object.keys(dump(w)).some(isProd)) throw new Error("凭空写了正式站的键");
    });
  }

  console.log("\n=== 结果 ===");
  console.log(bad? `${bad} 项失败 ✗` : "全部通过 ✓");
  process.exit(bad?1:0);
})();
