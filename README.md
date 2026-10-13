# SAT v2.0 · 镜像站

> **这是开发用的镜像站**，从正式站 [`113114sat`](https://github.com/yulan32feixiao/113114sat)（[在线](https://yulan32feixiao.github.io/113114sat/)）完整复制而来，包括全部提交历史。
> 新功能先在这里改、在这里验，稳定了再合回正式站。镜像地址：<https://yulan32feixiao.github.io/113114sat-mirror/>
>
> **你的账号怎么过来的**：正式站和镜像站都在 `yulan32feixiao.github.io` 这个域名下，浏览器把它们当成同一个「源」，共用一块 localStorage。
> 所以在平时做题的那个浏览器里第一次打开镜像站，它会把正式站的全部档案和记录（作答、错题、笔记、标记、划线、生词本、AI 对话、模型配置、设置）**原样复制一份**到自己名下。
>
> - 镜像的键前缀是 `b7m`，正式站是 `b7`。镜像**只读**正式站的键、从不写它们 —— 在镜像上做题、改设置、改出 bug，都碰不到正式站的记录（`tools/test-mirror.cjs` 逐字节验证）
> - 只在第一次（镜像这边还空着时）自动复制；之后想用正式站的最新数据，去「设置 → 数据体检 → 从正式站重新复制」
> - 复制前先算空间：复制后整个域名的存储超过 3 MB 就不复制（怕挤掉正式站继续长的空间），写到一半爆了整体回滚
> - 个人记录**不进仓库**。仓库里只有代码和题库；`band-seven-*.json` 之类的导出文件已在 `.gitignore` 里
> - 换浏览器 / 本地开发（`localhost` 是另一个源，看不到正式站的数据）：在镜像站「设置 → 练习数据 → 原样备份」导出，到那边「从原样备份恢复」。原样备份带全部数据、不带 API key
>
> 命名空间按路径自动判断：路径是 `/113114sat/` 就用 `b7`，其它任何地方（镜像、本地、改名后的仓库）一律 `b7m`。所以同一份代码合回正式站时不用改任何一行。

# SAT v2.0

数字 SAT 定向刷题工具。3,311 道 College Board 官方题，按考点和官方分数段出题，带官方逐选项解析、错题集间隔复习、AI 逐题拆解和 Word 导出。

纯静态页面，没有后端。打开就能用。

## 题目来源

全部来自 College Board 公开发布的 [SAT Suite Educator Question Bank](https://satsuiteeducatorquestionbank.collegeboard.org/)（无需登录）。抓取接口：

```
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question
```

抓取日期 2026-09-09，接口返回 3,770 条。其中 459 条 `external_id` 为空的 legacy 纸质书题目结构不同、公式以 base64 图片内嵌，已排除。保留 3,311 道数字 SAT 原生题，每道都带官方 rationale。

| Domain | 题数 | | Domain | 题数 |
|---|---|---|---|---|
| Information and Ideas | 555 | | Algebra | 616 |
| Craft and Structure | 471 | | Advanced Math | 540 |
| Standard English Conventions | 421 | | Problem-Solving and Data Analysis | 421 |
| Expression of Ideas | 398 | | Geometry and Trigonometry | 287 |

**题目与官方解析版权归 College Board 所有。** 本仓库仅作个人备考使用，不作任何商业用途。

## 参考资料

分数段、考点占比等数据的出处：

- [Skills Insight for the SAT Suite](https://satsuite.collegeboard.org/media/pdf/skills-insight-digital-sat-suite.pdf)（2026 年 7 月版）— 七个 performance score band 的分数区间
- [Digital SAT Suite Specifications Overview](https://satsuite.collegeboard.org/media/pdf/digital-sat-test-spec-overview.pdf) — domain 占比与题数
- [Assessment Framework for the Digital SAT Suite](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf) v3.01 — 考点定义
- [How the SAT Is Structured](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure)

## 功能

- **考点卡片** — 29 个官方考点每个一张卡：一句话说清考什么、规则型还是理解型、一道样题、你自己的正确率/均时/失分集中在哪个分数段，卡上直接配难度和题量开练
- **按考点出题** — 4 个 section domain、29 个官方考点、难度 E/M/H、官方 score band 1–7 任意组合
- **题源** — 每一组题都能选从哪儿抽：没做过的 / 全部 / **我错过的** / **我标记的** / 错的+标记。
  想把某个考点里「以前错过的那些」重刷一遍，选一下就出题，不用先去错题本挑
- **考点卡默认只列该补的** — 首页不再一次铺开 29 张卡：先列正确率不到 75% 的、再列样本太少的和没摸过底的，
  要看全部切「按 domain」
- **答案提交前不可见** — 官方题库网页版一打开答案就在旁边，这里不是
- **多用户档案** — **没有密码、没有登录，打开就进**。几个人共用一台电脑时，顶栏点名字就能换人、新建、改名、删除；每个档案的进度、错题、标记、API key、水平完全独立
- **错题集** — 自动收录，Leitner 间隔重复（1 / 3 / 7 / 16 天）。左右双栏：左边列表、右边直接预览题目和官方解析，可全屏翻阅；点「批量」才出勾选框，选完可预览、做题或导出 Word。
  左边菜单按 **题型（默认）/ 作业 / 月份 / 全部** 分组 —— 「作业」就是哪一场练习
- **标记** — 答题时标记的题单独成类，每道题可一键找同考点的题继续练
- **只看不做** — 任何一组题都能摊开只读：题目、答案、官方解析一次看全
- **带索引的预览** — 摊开一组题时左边一条小索引栏：第几题、当时对还是错、标没标记，点哪道跳哪道；
  中间是文章、右边是题目和解析。考点卡上的「我错过的 N 题」「band 5 错的 N 题」直接跳到这里
- **中途放弃** — 练到一半可以放弃且不留记录；即时判分模式下已写入的作答和错题集条目会真正回滚（划的重点、标记、生词本保留）
- **一题没做就不留记录** — 没作答的题不写作答记录、不进错题集；整场一题没做（练习或模考）不记这一场
- **划词高亮** — 文章和选项都能划重点，按题保存，重开这道题还在；点高亮处取消
- **生词本** — 做题时划选不认识的词或短语存下来，连同它出现的那句原话；点「看原题」回到完整语境。
  和错题本一样有左边菜单：按题型（默认）/ 作业 / 月份 / 全部，还能把一组生词的原题一次摊开翻
- **可拖拽分栏** — 答题和全屏预览时左右两栏宽度可拖，双击复位，比例记住
- **答案时机可选** — 默认整组做完才统一判分（中途能自由改答案，和真考一样）；也可切成交一题出一题，此时看解析的时间不计入答题用时
- **AI 强化练习** — 薄弱点分析可以一键变成题组放到首页，指定考点、难度和 Hard 题下限
- **AI 分析侧栏** — 错题本三栏（目录 / 题目 / AI），答题判分后也能开。按考点套用专属分析框架，自动带上你在该考点的历史错题；可配多个模型供应商，前一个失败自动换下一个
- **AI 拆解** — 讲这道题考什么能力、干扰项怎么设计的、你缺哪一块。可以写长期偏好，也可以逐条反馈，反馈会拼进后续请求
- **Bluebook 风格答题** — 双栏、计时、标记、右键划掉选项、暂停、字号调节
- **练习记录** — 每一场练过什么、哪些对哪些错哪些标记了，一格一题看得见；可重命名、重做错题、练标记的、整场重做、导出
- **数据体检** — 设置里列出浏览器里实际存了什么，档案系统上线前的旧数据可一键搬进当前档案
- **模考模式** — 按官方规格：R&W 两模块各 27 题 / 32 分钟，Math 两模块各 22 题 / 35 分钟，中间休息 10 分钟，第二模块按第一模块表现自适应路由。全部交卷后一次性出报告
- **学习时长** — 每场净答题时长（不含暂停），今天 / 本周 / 累计 / 练习天数；答题时同时显示本题用时和本组总用时
- **导入试卷** — 上传 PDF / .docx / .txt / .md / .csv，或**直接粘贴文字**，DeepSeek 整理成可作答的试卷，按 SAT 标准配速计时。
  **这些题只进你自己的试卷和练习记录，不进官方题库、不计入 29 个考点的统计**
- **Word 导出** — 练习记录、模考报告或错题本导出为 .docx，含表格和图形（原题 SVG 会转成 PNG 嵌进文档），标记过的题带【已标记】前缀

## 用法

打开网站即可刷题。**AI 拆解需要自己的 DeepSeek API key**：

1. 到 [platform.deepseek.com](https://platform.deepseek.com/) 创建一个 API key
2. 网站里进「设置」，填进去，点「测试连接」
3. key 只存在你自己浏览器的 localStorage 里 — 不在本仓库代码中，不经过任何中间服务器

不填 key 也能用：刷题、官方解析、错题集、Word 导出都不受影响。

### 用户档案（没有登录）

**打开网站就能用，不需要注册，也不需要密码。**

密码在一个纯前端、没有后端的页面里挡不住任何人 —— 数据就明文躺在 localStorage 里，能打开开发者工具的人随时能看。所以它唯一的作用是让每次打开都多一步，已经取消了。

留下来的是**档案**：几个人共用一台电脑时，把各自的记录分开存。

- 第一次打开自动建一个叫「我」的档案，直接进去
- 顶栏点自己的名字 → 换人 / 新建 / 改名 / 删除
- 改名会把该档案的全部记录一起搬过去；删除会把它的记录一并删掉（不可撤销），且不允许删掉最后一个
- 这台浏览器上**有好几个档案、又没记住上次是谁**时，才会问一句「这次是谁在练」，点一下名字就进
- 档案之间的进度、错题、标记、生词、API key、水平完全独立

新档案默认**不计时**、**不预设水平**。水平只有两个来源：做一次完整模考由它评出来，或在设置里自己指定；没有水平时出题器不会替你限制分数段。

**档案不是账号**：同一台浏览器上谁都能切，没有任何访问控制。不同设备之间也不同步，换设备要用「设置 → 导出进度」。

### 换电脑

没有账号系统，记录存在浏览器本地。换设备用「设置 → 导出进度」拿到一个 JSON，到新设备导入。清缓存 / 换浏览器 / 无痕窗口都会丢记录，建议每周导出一次。

## 重新生成题库

```bash
cd tools
python3 fetch_bank.py      # 拉取 3,770 条 -> raw.json
python3 normalize.py       # 清洗、修 MathML mfenced -> bank.json
python3 build_bank.py      # gzip -> bank.bin
```

`normalize.py` 会把 MathML 里的 `<mfenced>` 重写成 `<mrow><mo>(</mo>…<mo>)</mo></mrow>` —— Chrome 的 MathML Core 已经不支持 `mfenced`，不改的话公式里的括号会整个消失，含义就错了。

## 这里的模考和真考差在哪

一句话：**题是真的，考法接近，分数是估的，自适应是假的。**

| | 本工具的模考 | 真考（Bluebook） |
|---|---|---|
| 题目 | College Board 公开题库的练习题 | 从未公开的保密题库 |
| 结构 | R&W 27×2 题 / 32 分钟，Math 22×2 题 / 35 分钟，中间休息 10 分钟 | 相同（官方规格） |
| 模块 2 路由 | 模块 1 正确率 ≥60% 走难组 —— **这个阈值是估的** | 官方算法，未公开 |
| 分数 | 原始分按题数等比折算后查 Practice Test 11 的表，**折算是本工具的近似** | IRT 等值，换算表从未公开 |
| 单题难度 | 靠题库自带的 `difficulty` 和 `score_band_range_cd` 凑 | 按 IRT 参数精确组卷 |
| 计算器 | 自带科学计算器，不含作图 | 内置 Desmos 图形计算器 |
| 参考公式表 | 没有 | Math 部分随时可查 |
| 划线/划掉选项 | 有（划重点、右键划掉选项） | 有 |
| 未答题 | 不写作答记录、不进错题集 | 计 0 分 |
| 环境 | 浏览器标签页，可暂停、可放弃 | 锁定的考试客户端，不能暂停 |

所以：**模考出来的原始分（对了几题）是实打实的，换算出来的那个分数区间只能当参考。**
要一个能当真的分数，只有 Bluebook 的官方全真模考。

## 已知局限

- 题库题是官方发布的练习题，**不是某一次真考的原题**
- 考点数按题库的 `skill_desc` 标签算是 29 个（R&W 10 + Math 19）。官方规格文档写 R&W 有 14 个 testing point，是因为把 Command of Evidence 拆成 Textual / Quantitative 两条，题库标签没拆
- `score_band_range_cd` 是题目属性（这道题主要区分哪个分数段的考生），**不是你的预测分**。要分数只能做 Bluebook 完整自适应模考
- 日常刷题模式**不自适应**（定向练考点，用途不同）；模考模式会按第一模块表现路由第二模块，但路由阈值是估的
- 刷题模式的计时器按 R&W 每题 ≈71 秒、Math ≈95 秒的平均配速提示，真考不按单题计时
- 几何图形是内嵌 SVG、线条为黑色，因此一律放在白底板上，深色主题下也是白底
- Word 导出里数学公式用 College Board 自带的 `alttext` 英文读法还原（MathML 无法转进 Word）；几何图形会用 canvas 转成 PNG 嵌进文档，转换失败的标为「[图形转换失败，见原题]」
- AI 拆解由模型生成，**可能出错**；与官方解析冲突时以官方为准
- 模考的分数区间用官方 [Practice Test 11 评分表](https://satsuite.collegeboard.org/media/pdf/scoring-sat-practice-test-11-digital.pdf) 换算，但那张表对应纸质线性版（R&W 66 题 / Math 54 题），本工具模考是 54 / 44 题，**原始分按题数等比折算后再查表——这步折算是本工具的近似，不是 College Board 的算法**。真考用 IRT、换算表从未公开。第二模块 60% 的路由阈值同样是估的。原始分实打实，区间是估的
- 计算器是自带的科学计算器，**不含作图**。数字 SAT 的 Math 全程允许用计算器（官方规格原文），真考内置 Desmos，界面上有官方版链接。
  键盘可以直接打（数字、`+ - * /`、括号、`^`、Enter 算、Backspace 退格、C 清空、Esc 收起）；
  计算器开着的时候键盘归计算器，不会被 1/2/3/4 的选项快捷键抢走
- 导入试卷里的题由模型从你的文件整理而来，可能整理错；不计入官方考点统计。扫描件 / 图片 PDF 需要先 OCR，老的 .doc 要先另存为 .docx

## AI 分析的准确性是怎么保证的

模型只能看到我喂给它的文本，所以「题目提取对不对」是这件事的地基。`tools/audit-serializer.cjs` 把全部 3,311 道题跑一遍，检查转成纯文本后有没有失真：

```bash
node tools/audit-serializer.cjs
```

已经修掉的真实失真（都有题目为证）：

| 问题 | 影响 | 处理 |
|---|---|---|
| 311 个 SVG 中 308 个带官方 `aria-label` 图描述，被整块删掉 | 13.3% 的题丢图信息 | 提取描述写进文本 |
| 71 个表格全部包在 `<figure>` 内，随 figure 一起被删 | 数据题读不到表 | 先抽表格，figure 改为拆包装而非删除 |
| 2 道题的选项是嵌套四层 figure 包的表格 | 选项全空 | 同上 |
| 76 个 `<math>` 无 `alttext` | 公式变占位符 | 线性化 MathML |
| `<span class="sr-only">blank</span>` | 模型读到一个叫 blank 的单词 | 转成「〔空格〕」 |

剩下 3 道题的图 College Board 本身没给描述——这种情况系统提示里会明确告诉模型「你看不到这张图，涉及它的判断必须说明」，而不是让它猜。

其它约束：系统指令禁止使用原文之外的信息、禁止与官方解析冲突、禁止讲应试套路；每个考点有专属分析框架（比如 Rhetorical Synthesis 要求先分类写作任务再给选项标功能），不是通用提示词。

`tools/test-ai.cjs` 用假供应商验证整条链路（上下文组装、框架选择、错题检索、流式解析、故障转移、持久化）。**真实模型的回答质量无法在本地验证**，需要你配好 key 实际用。

## 填空题判题

按官方 [Bluebook 考试指令](https://satsuite.collegeboard.org/media/pdf/english-sat-test-directions-bb.pdf) 的规则实现，不是简单的数值容差：正数最多 5 字符、负数 6 字符（含负号）；分数等值即可；小数必须等于真值在某一位的截断或四舍五入，且**占满输入格**或本身是有限小数。

官方接受表被逐条写成了测试（`node tools/test-spr.cjs`，42 条）：答案 2/3 时 `.6666` `.6667` `0.666` `0.667` 接受，`0.66` `.66` `0.67` `.67` 拒绝。旧实现用 1e-6 容差，会把官方明确接受的 `.6666` 判成错 —— 这是真 bug，已修。

输入框配官方式键盘（数字、`.`、`/`、正负号），解决手机上打不出斜杠和负号的问题。**SPR 答案永远是数字，π 和根号要换算成小数填** —— 官方规则如此。

## 测试

改完代码、推送之前跑一次无头冒烟测试：

```bash
npm install jsdom pdfjs-dist@3.11.174   # pdfjs 要和页面里 CDN 加载的版本一致，test-pdf 才有意义
node tools/smoke.cjs            # 整体回归
node tools/audit-serializer.cjs # 喂给 AI 的题目文本有没有失真（全量 3311 道）
node tools/test-spr.cjs         # 填空题判题 vs 官方接受表
node tools/test-calc.cjs        # 计算器算得对不对、键盘输入
node tools/test-picker.cjs      # 题源（错过的/标记的）、一题没做不留记录、左边分组菜单
node tools/test-profile.cjs     # 打开就进、没有密码、几个档案的记录真的分开
node tools/test-ai.cjs          # AI 侧栏整条链路（假供应商）
node tools/test-mirror.cjs      # 镜像站：自动复制账号、正式站的键逐字节不变、空间不够拒绝、写爆回滚、原样备份
```

全部跑一遍：`for t in tools/smoke.cjs tools/test-*.cjs; do node $t || echo "FAIL $t"; done`

本地预览：`python3 -m http.server 8123`，打开 <http://localhost:8123/>。

它用 jsdom 把整个应用真跑一遍（解压题库、进入档案、出题答题、各视图渲染、数据回滚），退出码 0 表示全过。没有浏览器时这是唯一能证明「改完还能跑」的手段。

**它测不到的部分**（需要真浏览器）：视觉布局、拖拽手柄的鼠标交互、Word 导出里 SVG 转 PNG（jsdom 没有 canvas）、PDF 导入、DeepSeek 实际调用。

## 出问题了怎么回退

每个验证通过的版本都打了 tag。线上出问题时，一条命令回到上一个好版本：

```bash
git reset --hard stable-v1     # 换成要回退到的 tag
git push --force origin main
```

GitHub Pages 会在一分钟内重新构建成那个版本。查看所有可回退的版本：

```bash
git tag -l -n1
```

回退不会动你的练习记录 —— 记录存在浏览器 localStorage 里，和网站代码是两回事。

## 浏览器要求

题库解压用 `DecompressionStream`：Chrome 80+ / Safari 16.4+ / Firefox 113+。
