#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每月复核优惠码：从品牌官方页抓码，和 src/data/brands.ts 里现有的比对。

## 为什么需要这个脚本

银行合作码每月换一轮（KKday 官方页自己写着「此碼每月不同」），10 月 1 日那天
Klook 的 30 组、KKday 的 11 组会同时失效或换新。手工扒一遍要一个多小时，
而且 2026-09-21 那次手工扒就踩了两个坑（表格 rowspan 错位、把公开码当成禁转码），
所以把机械部分固化下来。

## 它做什么、不做什么

**做**：开浏览器抓页面 → 展开 rowspan 抽表格 → 列出候选码 → 和 brands.ts 比对，
       告诉你哪些是新增的、哪些从官方页上消失了、哪些内容变了。
       每次抓的原始快照存进 scripts/snapshots/，出了争议可以回头查。

**不做**：不自动改 brands.ts。收不收一个码需要判断——
       KKday 页上标 V 的是「部落格讀者優惠碼」，官方明文禁止转载（转了读者也核销不了）；
       Klook 的「週間限定」表 rowspan 展开后银行与码的对应有疑义。
       这些判断交给人，脚本只负责把证据摆齐。

## 用法

    # 1) 确保有一个带调试端口的 Chrome（家里机器关着就用公司笔记本 110）
    #    详见 personal-knowledge 的 laptop-110-cdp
    #    ⚠️ Chrome 153 只绑 IPv6，隧道要写 [::1] 不是 127.0.0.1：
    #    ssh -f -N -L 127.0.0.1:19223:[::1]:9222 -p 8022 gzitnirol@10.48.14.110
    #
    # 2) 跑
    python3 scripts/refresh-codes.py                       # 默认 CDP_BASE=http://127.0.0.1:19223
    python3 scripts/refresh-codes.py --brand klook         # 只看一家
    python3 scripts/refresh-codes.py --cdp http://127.0.0.1:19222

注意：curl / WebFetch / PowerShell 抓这些站一律 403（按 TLS 指纹拦的，换 UA 没用），
必须走真浏览器，所以这个脚本没有「不开浏览器」的模式。
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

try:
    from websocket import create_connection
except ImportError:
    sys.exit("缺 websocket-client：pip install websocket-client")

ROOT = Path(__file__).resolve().parent.parent
SNAP_DIR = ROOT / "scripts" / "snapshots"

SOURCES = {
    "klook": {
        "url": "https://www.klook.com/zh-TW/blog/klook-discount-collection/",
        # 认表头，不认表格序号——页面改版时序号会变，表头不会
        "table_headers": ["刷卡優惠碼"],
        "code_col_hint": "刷卡優惠碼",
    },
    "kkday": {
        "url": "https://www.kkday.com/zh-tw/blog/25229/kkday-bank-coupon",
        "table_headers": ["折扣碼"],
        "code_col_hint": "折扣碼",
    },
}

# 码可以数字开头（26TRANS / 26JCB09 / 26AWJPTOUR），但至少要有一个字母，
# 否则「2026」「9/30」这类数字也会被当成码。
CODE_RE = re.compile(r"^(?=.*[A-Z])[A-Z0-9]{4,20}$")


# ── CDP ───────────────────────────────────────────────────────────────────────
class Tab:
    def __init__(self, ws_url):
        self.ws = create_connection(ws_url, timeout=90)
        self.mid = 0

    def ev(self, expr, timeout=90):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({
            "id": mid, "method": "Runtime.evaluate",
            "params": {"expression": expr, "returnByValue": True, "awaitPromise": True},
        }))
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.ws.settimeout(max(1, deadline - time.time()))
            try:
                r = json.loads(self.ws.recv())
            except Exception:
                continue
            if r.get("id") == mid:
                res = r.get("result", {})
                if "exceptionDetails" in res:
                    raise RuntimeError(str(res["exceptionDetails"])[:300])
                return res.get("result", {}).get("value")
        raise TimeoutError("Runtime.evaluate")

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def cdp_http(base, path, method="GET"):
    req = urllib.request.Request(base + path, method=method)
    with urllib.request.urlopen(req, timeout=25) as r:
        body = r.read().decode("utf-8", "replace")
    try:
        return json.loads(body)
    except Exception:
        return body


def open_tab(base, url):
    d = cdp_http(base, "/json/new?" + url, method="PUT")
    return d["id"], Tab(d["webSocketDebuggerUrl"])


def close_tab(base, tid):
    try:
        cdp_http(base, "/json/close/" + tid)
    except Exception:
        pass


# 展开 rowspan / colspan 后再读表格。
# 不展开的话，被 rowspan 合并的「银行」列会整列上移一格，
# 银行和优惠码就对不上了——2026-09-21 差点因此发错码。
JS_TABLES = r"""(()=>{
  const out=[];
  [...document.querySelectorAll('table')].forEach((tb,idx)=>{
    const grid=[];
    [...tb.querySelectorAll('tr')].forEach((tr,r)=>{
      grid[r]=grid[r]||[]; let c=0;
      [...tr.children].forEach(td=>{
        while(grid[r][c]!==undefined) c++;
        const txt=(td.innerText||'').trim();
        const rs=parseInt(td.getAttribute('rowspan')||'1',10);
        const cs=parseInt(td.getAttribute('colspan')||'1',10);
        for(let dr=0;dr<rs;dr++) for(let dc=0;dc<cs;dc++){
          grid[r+dr]=grid[r+dr]||[]; grid[r+dr][c+dc]=txt;
        }
        c+=cs;
      });
    });
    out.push({i:idx, grid});
  });
  return JSON.stringify(out);
})()"""


def fetch(base, url, scrolls=14):
    """开页签、滚到底触发懒加载、抓表格和正文。"""
    tid, t = open_tab(base, url)
    try:
        time.sleep(12)
        for _ in range(scrolls):
            t.ev("window.scrollBy(0, window.innerHeight)")
            time.sleep(0.8)
        t.ev("window.scrollTo(0,0)")
        time.sleep(2)
        return {
            "final_url": t.ev("location.href"),
            "title": t.ev("document.title"),
            "text": t.ev("document.body ? document.body.innerText : ''") or "",
            "tables": json.loads(t.ev(JS_TABLES)),
        }
    finally:
        t.close()
        close_tab(base, tid)


# ── 抽码 ──────────────────────────────────────────────────────────────────────
def codes_from_tables(snap, cfg):
    """返回 [{code, context, expiry_raw, blog_only, table}]"""
    found = []
    for tb in snap["tables"]:
        grid = tb["grid"]
        if not grid:
            continue
        cols = [x or "" for x in grid[0]]
        header = " ".join(cols)
        if not any(h in header for h in cfg["table_headers"]):
            continue
        # 认表头定位「优惠码」那一列。不能用「第一个长得像码的格子」——
        # Klook 表里发卡机构写作 AFTEE，它自己就长得像码，会把银行列当成码列。
        code_idx = next((i for i, c in enumerate(cols) if cfg["code_col_hint"] in c), None)
        # 「是否為…部落格專用優惠碼」那一列：标 V = 禁止转载
        excl_idx = next((i for i, c in enumerate(cols) if "部落格" in c or "專用" in c), None)
        for row in grid[1:]:
            cells = [(x or "").strip() for x in row]
            if code_idx is not None and code_idx < len(cells):
                candidates = [(code_idx, cells[code_idx])]
            else:
                candidates = list(enumerate(cells))
            for ci, cell in candidates:
                # 先去掉「（每月不同）」这类附注，再按空白切。
                cell_clean = re.sub(r"[（(][^）)]*[）)]", " ", cell)
                toks = [t for t in re.split(r"[\s\u3000]+", cell_clean.strip("「」【】,、")) if t]
                # 整格必须**全是**码：一格可能有多个码（週間限定那种），
                # 但只要夹着中文说明就不算码列——否则
                # 「國泰世華銀行 CUBE 卡｜全球商品滿 $6,000 折 $600」会把 CUBE 当成一个码。
                if not toks or not all(CODE_RE.match(t) for t in toks):
                    continue
                for tok in toks:
                    ctx = " / ".join(c.replace("\n", " ") for i, c in enumerate(cells)
                                     if i != ci and c and len(c) < 120)
                    blog_only = False
                    if excl_idx is not None and excl_idx < len(cells):
                        blog_only = cells[excl_idx].strip().upper().startswith("V")
                    exp = next((c for c in cells
                                if re.fullmatch(r"\d{1,2}/\d{1,2}", c.strip())), "")
                    found.append({"code": tok, "context": ctx, "expiry_raw": exp,
                                  "blog_only": blog_only, "table": tb["i"]})
                break

    known = {f["code"] for f in found}

    def add(code, ctx, exp, where):
        if code in known:
            return
        known.add(code)
        found.append({"code": code, "context": ctx, "expiry_raw": exp,
                      "blog_only": False, "table": where})

    txt = snap["text"]
    # 表格外的码：KKday 银行码是「CODE ⏎ 描述 ⏎ 9/30」这种排版，
    # 且码后面可能跟着「（每月不同）」，所以不能用行尾锚点。
    pat = re.compile(r"^([A-Z0-9]{4,20})\s*(?:（[^）]*）)?\s*\n+\s*([^\n]{6,120})\s*\n+\s*(\d{1,2}/\d{1,2})\s*$",
                     re.M)
    for m in pat.finditer(txt):
        if CODE_RE.match(m.group(1)):
            add(m.group(1), m.group(2).strip(), m.group(3), "正文區塊")

    # 写在句子里的码：「APP90」、【WIN600】、輸入折扣碼 F1ZONE4。
    # 只认被引号/方括号包起来、或紧跟在「折扣碼/優惠碼」后面的，避免把正文里的普通大写词当成码。
    prose = re.compile(r"(?:[「【]([A-Z0-9]{4,20})[」】]|(?:折扣碼|優惠碼)\s*[「【]?([A-Z0-9]{4,20})[」】]?)")
    for m in prose.finditer(txt):
        code = m.group(1) or m.group(2)
        if not code or not CODE_RE.match(code):
            continue
        line = txt[max(0, m.start() - 90):m.start() + 90].replace("\n", " ").strip()
        add(code, line[:110], "", "正文句子")
    return found


def current_codes(brand):
    """从 brands.ts 读某个品牌现有的码。用文本解析，不引 TS 运行时。"""
    src = (ROOT / "src" / "data" / "brands.ts").read_text(encoding="utf-8")
    i = src.index("slug: '%s'" % brand)
    cs = src.index("codes: [", i)
    ce = src.index("\n    ],", cs)
    block = src[cs:ce]
    out = {}
    for m in re.finditer(r"code:\s*'([^']+)'[^}]*?benefit:\s*'([^']*)'", block, re.S):
        out[m.group(1)] = m.group(2)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cdp", default=os.environ.get("CDP_BASE", "http://127.0.0.1:19223"))
    ap.add_argument("--brand", choices=sorted(SOURCES), help="只跑一家")
    args = ap.parse_args()

    try:
        ver = cdp_http(args.cdp, "/json/version")
        print("浏览器：%s（%s）" % (ver.get("Browser"), args.cdp))
    except Exception as e:
        sys.exit("连不上 CDP（%s）：%s\n"
                 "起一个带调试端口的 Chrome，注意 Chrome 153 只绑 IPv6：\n"
                 "  ssh -f -N -L 127.0.0.1:19223:[::1]:9222 -p 8022 gzitnirol@10.48.14.110"
                 % (args.cdp, e))

    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    brands = [args.brand] if args.brand else sorted(SOURCES)
    exit_code = 0

    for brand in brands:
        cfg = SOURCES[brand]
        print("\n" + "=" * 70)
        print("【%s】%s" % (brand, cfg["url"]))
        try:
            snap = fetch(args.cdp, cfg["url"])
        except Exception as e:
            print("  ✗ 抓取失败：%s" % e)
            exit_code = 1
            continue
        if len(snap["text"]) < 2000:
            print("  ⚠️ 正文只有 %d 字，多半被挡了或没加载完——先人工打开看看" % len(snap["text"]))
            exit_code = 1
        print("  标题：%s" % snap["title"])

        snap_path = SNAP_DIR / ("%s-%s.json" % (brand, today))
        snap_path.write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
        print("  快照：%s" % snap_path.relative_to(ROOT))

        found = codes_from_tables(snap, cfg)
        have = current_codes(brand)
        found_map = {f["code"]: f for f in found}

        blocked = [f for f in found if f["blog_only"]]
        usable = [f for f in found if not f["blog_only"]]
        new = [f for f in usable if f["code"] not in have]
        gone = [c for c in have if c not in found_map]

        print("  官方页共 %d 组（可收录 %d，标为渠道专属 %d）｜我们现有 %d 组"
              % (len(found), len(usable), len(blocked), len(have)))

        if blocked:
            print("\n  ⛔ 渠道专属码，禁止收录（官方标 V「需透過此文才可使用」）：")
            for f in blocked:
                print("     %-18s %s" % (f["code"], f["context"][:70]))

        if new:
            print("\n  ➕ 官方页上有、我们没有的 %d 组：" % len(new))
            for f in new:
                exp = ("　失效 " + f["expiry_raw"]) if f["expiry_raw"] else ""
                print("     %-18s %s%s" % (f["code"], f["context"][:70], exp))

        if gone:
            print("\n  ➖ 我们有、官方页上已经找不到的 %d 组（多半已下架，该删）：" % len(gone))
            for c in gone:
                print("     %-18s %s" % (c, have[c][:60]))

        if not new and not gone:
            print("\n  ✅ 与官方页一致，没有需要改的")

    print("\n" + "-" * 70)
    print("脚本只摆证据，不自动改 brands.ts。收录前记得确认：")
    print("  1. 表格 rowspan 展开后银行与码是否真的对得上（对不上就别收）")
    print("  2. 有没有渠道专属标记（上面标 ⛔ 的一律不收）")
    print("  3. 失效日以官方标注为准，两处打架时取较早的")
    print("  4. 改完把这次变动写进 src/data/changelog.ts")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
