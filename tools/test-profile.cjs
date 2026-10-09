#!/usr/bin/env node
/*
 * 用户档案测试 —— 没有密码、没有登录，但几个人的记录必须真的分开。
 *   node tools/test-profile.cjs
 */
const fs=require("fs"),path=require("path"),{JSDOM}=require("jsdom");
const SITE=process.env.SITE_DIR||path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(SITE,"index.html"),"utf8");
const bank=fs.readFileSync(path.join(SITE,"bank.bin"));
const mk=(seed)=>{
  const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,{
    runScripts:"dangerously",pretendToBeVisual:true,url:"https://x.github.io/113114sat/",
    beforeParse(w){
      w.fetch=async()=>({ok:true,status:200,arrayBuffer:async()=>bank.buffer.slice(bank.byteOffset,bank.byteOffset+bank.byteLength)});
      w.DecompressionStream=DecompressionStream;w.Blob=Blob;w.Response=Response;
      w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
      Object.defineProperty(w,"crypto",{value:require("crypto").webcrypto,configurable:true});
      w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
      w.JSZip=function(){};w.pdfjsLib={};w.requestAnimationFrame=cb=>setTimeout(cb,0);
      w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;
      w.URL.createObjectURL=()=>"blob:";w.URL.revokeObjectURL=()=>{};
      // location.reload 在 jsdom 里会抛 Not implemented，换人用它，这里挡掉并记下来
      w.__reloaded=0;
      try{ Object.defineProperty(w.location,"reload",{value:()=>{w.__reloaded++;},configurable:true}); }catch(e){}
      if(seed) seed(w);
    }});
  return dom.window;
};
let bad=0;
const step=(n,f)=>{try{const r=f();console.log(`  ok  ${n}${r?" — "+r:""}`);}
                   catch(e){bad++;console.log(`  FAIL ${n}: ${e.message}`);}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  console.log("=== 空浏览器：打开就进，不问任何东西 ===");
  const w1 = mk(); await wait(3000);
  const D1 = w1.document, ev1 = s=>w1.eval(s);
  step("没有登录界面", ()=>{
    if(D1.querySelector("#gate")) throw new Error("弹了登录/选人界面");
    return "没有 #gate";
  });
  step("自动建了一个默认档案并进去了", ()=>{
    const cur = ev1("CURRENT");
    if(!cur) throw new Error("CURRENT 还是空的");
    if(cur !== ev1("DEFAULT_PROFILE")) throw new Error("进的是 "+cur);
    if(D1.querySelector("#topbar").classList.contains("hide")) throw new Error("顶栏还藏着");
    return "档案「"+cur+"」";
  });
  step("顶栏的名字就是换人按钮", ()=>{
    const b = D1.querySelector("#whobtn");
    if(!b) throw new Error("没有 #whobtn");
    if(D1.querySelector("#whoami").textContent !== ev1("CURRENT")) throw new Error("名字没显示");
    if(D1.querySelector("#logoutbtn")) throw new Error("还有「退出」按钮");
    return "点名字弹面板";
  });
  step("换人面板能弹出来，列出档案和新建", ()=>{
    ev1(`openProfilePop(document.querySelector("#whobtn"))`);
    const pop = D1.querySelector(".profilepop");
    if(!pop) throw new Error("面板没出来");
    if(!pop.querySelector(".ppadd")) throw new Error("没有「新建档案」");
    if(pop.querySelectorAll(".pprow").length !== 1) throw new Error("列了 "+pop.querySelectorAll(".pprow").length+" 个档案");
    ev1(`killProfilePop()`);
    return "1 个档案 + 新建";
  });
  step("密码那套东西全没了", ()=>{
    const gone = ["showAuth","loginUser","hashPw","changePw","resetPwLocal","registerUser","logout"]
      .filter(n=> ev1(`typeof ${n}`) !== "undefined");
    if(gone.length) throw new Error("还留着："+gone.join(", "));
    return "showAuth / loginUser / hashPw / changePw / registerUser 都没了";
  });
  step("设置页不再出现密码输入框", ()=>{
    ev1(`gotoView("settings")`);
    const pw = D1.querySelectorAll('#app input[type="password"]').length;
    if(pw) throw new Error(pw+" 个密码框");
    return "0 个密码框";
  });

  console.log("\n=== 多档案：记录真的分开 ===");
  step("建第二个档案", ()=>{
    ev1(`createProfile("小明")`);
    const names = ev1(`JSON.stringify(profileNames())`);
    if(JSON.parse(names).length !== 2) throw new Error(names);
    return names;
  });
  step("两个档案的数据互不相干", ()=>{
    // 当前档案写 3 条作答
    ev1(`attempts=[{aid:"x1",qid:BANK[0].id,sec:1,dom:BANK[0].dom,sk:BANK[0].sk,ok:false,ms:1,ts:Date.now()},
                   {aid:"x2",qid:BANK[1].id,sec:1,dom:BANK[1].dom,sk:BANK[1].sk,ok:true,ms:1,ts:Date.now()},
                   {aid:"x3",qid:BANK[2].id,sec:1,dom:BANK[2].dom,sk:BANK[2].sk,ok:true,ms:1,ts:Date.now()}];
          saveLocal();`);
    const sum = JSON.parse(ev1(`JSON.stringify(accountSummary())`));
    const me = sum.find(x=>x.name===ev1("CURRENT")), other = sum.find(x=>x.name==="小明");
    if(me.attempts !== 3) throw new Error("当前档案 "+me.attempts+" 条");
    if(other.attempts !== 0) throw new Error("新档案里凭空多了 "+other.attempts+" 条");
    return `${me.name} 3 条 / 小明 0 条`;
  });
  step("换人会记住新的档案并重新载入页面", ()=>{
    // jsdom 的 location.reload 是 Not implemented（会打一行日志、不抛异常），
    // 所以这里验的是能观察到的那半边：记住的档案改了。
    ev1(`switchProfile("小明")`);
    if(ev1(`lsGet("b7_session","")`) !== "小明") throw new Error("记住的档案没改");
    if(ev1(`lsGet("b7_last","")`) !== "小明") throw new Error("b7_last 没改");
    return "b7_session / b7_last → 小明";
  });
  step("切到不存在的档案什么也不做", ()=>{
    ev1(`switchProfile("查无此人")`);
    if(ev1(`lsGet("b7_session","")`) !== "小明") throw new Error("被改成了 "+ev1(`lsGet("b7_session","")`));
    return "没动";
  });
  step("改名把记录一起搬过去", ()=>{
    ev1(`CURRENT=${JSON.stringify(ev1("Object.keys(users()).find(n=>n!=='小明')"))}`);
    const cur = ev1("CURRENT");
    ev1(`renameProfile(${JSON.stringify(cur)}, "大明")`);
    const sum = JSON.parse(ev1(`JSON.stringify(accountSummary())`));
    const m = sum.find(x=>x.name==="大明");
    if(!m) throw new Error("改名后找不到「大明」");
    if(m.attempts !== 3) throw new Error("搬过去只剩 "+m.attempts+" 条");
    if(ev1(`CURRENT`) !== "大明") throw new Error("CURRENT 没跟着改");
    return "3 条作答跟着走了";
  });
  step("重名会被挡住", ()=>{
    let threw=false;
    try{ ev1(`createProfile("大明")`); }catch(e){ threw=true; }
    if(!threw) throw new Error("建出了同名档案");
    return "挡住了";
  });
  step("删档案连它的记录一起删，别人的不动", ()=>{
    ev1(`CURRENT="小明"`);
    ev1(`deleteProfile("大明")`);
    const names = JSON.parse(ev1(`JSON.stringify(profileNames())`));
    if(names.includes("大明")) throw new Error("档案还在");
    let left=0;
    for(let i=0;i<w1.localStorage.length;i++){
      if((w1.localStorage.key(i)||"").startsWith("b7:大明:")) left++;
    }
    if(left) throw new Error("还剩 "+left+" 个它的键");
    return "档案和它的 localStorage 键都清了";
  });

  console.log("\n=== 两个以上档案又不知道这次是谁：问一句，点一下就进 ===");
  const w2 = mk(w=>{
    w.localStorage.setItem("b7_users", JSON.stringify({
      "甲":{created:1,level:{rw:null,math:null,source:"unset"}},
      "乙":{created:2,level:{rw:null,math:null,source:"unset"}}}));
    // 故意不写 b7_session / b7_last
  });
  await wait(3000);
  const D2=w2.document, ev2=s=>w2.eval(s);
  step("弹出选人（不是登录）", ()=>{
    const g = D2.querySelector("#gate");
    if(!g) throw new Error("没弹");
    if(g.querySelector('input[type="password"]')) throw new Error("居然还要密码");
    const n = g.querySelectorAll(".recoveritem").length;
    if(n !== 2) throw new Error("列了 "+n+" 个");
    return "2 个名字，0 个密码框";
  });
  step("点一下就进去了", ()=>{
    D2.querySelectorAll("#gate .recoveritem")[0].click();
    if(D2.querySelector("#gate")) throw new Error("还没进去");
    if(!ev2("CURRENT")) throw new Error("CURRENT 还是空");
    return "进了「"+ev2("CURRENT")+"」";
  });

  console.log("\n=== 记住了上次是谁就不再问 ===");
  const w3 = mk(w=>{
    w.localStorage.setItem("b7_users", JSON.stringify({
      "甲":{created:1,level:{rw:null,math:null,source:"unset"}},
      "乙":{created:2,level:{rw:null,math:null,source:"unset"}}}));
    w.localStorage.setItem("b7_session", JSON.stringify("乙"));
  });
  await wait(3000);
  step("直接进上次那个", ()=>{
    if(w3.document.querySelector("#gate")) throw new Error("又问了一遍");
    if(w3.eval("CURRENT") !== "乙") throw new Error("进的是 "+w3.eval("CURRENT"));
    return "直接进「乙」";
  });

  console.log("\n=== 结果 ===");
  console.log(bad? `失败 ${bad} 项` : "全部通过 ✓");
  process.exit(bad?1:0);
})();
