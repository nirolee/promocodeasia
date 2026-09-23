#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""往 Threads（@promocodeasia）发一条帖子。走家里 Chrome 的 CDP（Meta 在公司网络被掐，只能这台）。

用法：
  python3 scripts/threads-post.py --text "帖子内容"
  npx tsx scripts/threads-drafts.ts --json | python3 scripts/threads-post.py --from-drafts   # 发今天该发的
  加 --dry-run 只贴进编辑器不点发布（看排版用）

登录态在 D:\\chrome-cdp 这个 profile 里，掉了就让用户在那个窗口点一下「用 Instagram 登录」——
那是跨站授权按钮，CDP 点不动（2026-09-22 实测真鼠标 + JS click 都失败）。

结构（2026-09-22 抓的，改版了就重新 probe）：
  左栏 aria-label=创建（2026-09-24 改叫「新建帖子」，正则兼容）→ 弹出编辑器；编辑器 div[role=textbox][contenteditable]（Lexical）；发布按钮文字「发布」。
  Lexical 不认 value setter，必须 focus 后用 CDP Input.insertText 逐段塞（换行用 Input.dispatchKeyEvent Enter）。
"""
import argparse, json, os, sys, time, urllib.request
from websocket import create_connection

BASE = os.environ.get("CDP_BASE", "http://127.0.0.1:19222")
HANDLE = "promocodeasia"

class Tab:
    def __init__(s, ws): s.ws = create_connection(ws, timeout=60); s.mid = 0
    def send(s, m, p=None, timeout=60):
        s.mid += 1; mid = s.mid
        s.ws.send(json.dumps({"id": mid, "method": m, "params": p or {}}))
        dl = time.time() + timeout
        while time.time() < dl:
            s.ws.settimeout(max(1, dl - time.time()))
            try: r = json.loads(s.ws.recv())
            except Exception: continue
            if r.get("id") == mid: return r
        raise TimeoutError(m)
    def ev(s, expr):
        r = s.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        res = r.get("result", {})
        if "exceptionDetails" in res: raise RuntimeError(str(res["exceptionDetails"])[:300])
        return res.get("result", {}).get("value")
    def goto(s, url, wait=10):
        s.send("Page.navigate", {"url": url}); time.sleep(wait)
    def click(s, x, y):
        for typ in ("mouseMoved", "mousePressed", "mouseReleased"):
            s.send("Input.dispatchMouseEvent", {"type": typ, "x": x, "y": y, "button": "left",
                   "clickCount": 0 if typ == "mouseMoved" else 1, "buttons": 1 if typ == "mousePressed" else 0})
            time.sleep(0.15)

def http(path, method="GET"):
    req = urllib.request.Request(BASE + path, method=method)
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read().decode())

def center(t, js):
    r = t.ev("(()=>{const e=%s; if(!e) return null; e.scrollIntoView({block:'center'}); const q=e.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2};})()" % js)
    return r

def post(text, dry=False):
    # 从自己的主页进：首页 / 有时渲染成空白（2026-09-24 实测 innerText 为空），主页稳定得多
    d = http("/json/new?https://www.threads.com/@%s" % HANDLE, method="PUT"); tid = d["id"]; t = Tab(d["webSocketDebuggerUrl"])
    try:
        for _ in range(6):
            time.sleep(5)
            if (t.ev("(document.body.innerText||'').length") or 0) > 100: break
        if t.ev("!!document.querySelector('[role=dialog]') && /Instagram 登录/.test(document.body.innerText)"):
            return {"ok": False, "why": "Threads 未登录：让用户在家里 Chrome 窗口点「用 Instagram 登录」"}
        p = center(t, "(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(x=>/^(创建|新建帖子|建立|發佈|Create)$/.test(x.getAttribute('aria-label').trim())); return e? (e.closest('a,button,div[role=button]')||e):null;})()")
        if p:
            t.click(p["x"], p["y"]); time.sleep(3)
        # 2026-09-24：aria-label=新建帖子 的元素尺寸是 0（真按钮的可见壳在别处），真鼠标点不到；JS click 能拉起编辑器
        if not t.ev("!!document.querySelector('div[role=textbox][contenteditable=true]')"):
            hit = t.ev("(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(x=>/^(创建|新建帖子|建立|發佈|Create)$/.test(x.getAttribute('aria-label').trim())); if(!e) return false; (e.closest('a,button,div[role=button]')||e).click(); return true;})()")
            if not hit: return {"ok": False, "why": "找不到「创建／新建帖子」按钮"}
            time.sleep(3)
        box = center(t, "[...document.querySelectorAll('div[role=textbox][contenteditable=true]')].find(e=>e.getBoundingClientRect().width>0)")
        if not box: return {"ok": False, "why": "编辑器没出现"}
        t.click(box["x"], box["y"]); time.sleep(0.6)
        for i, line in enumerate(text.split("\n")):
            if i: 
                t.send("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13})
                t.send("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13})
                time.sleep(0.15)
            if line: t.send("Input.insertText", {"text": line}); time.sleep(0.25)
        time.sleep(1.5)
        got = t.ev("(()=>{const e=[...document.querySelectorAll('div[role=textbox][contenteditable=true]')].find(e=>e.getBoundingClientRect().width>0); return e? e.innerText : '';})()") or ""
        if got.replace("\n", "").strip() != text.replace("\n", "").strip():
            return {"ok": False, "why": "编辑器回读和输入不一致", "got": got[:200]}
        if dry: return {"ok": True, "dry": True, "got": got}
        # 「发布」只在编辑器所在的容器里找——主页上还有个同名的内联「发布」，全局找会点错。
        # 2026-09-22 第一次就是这么发空的：主页 0 帖。
        BTN = ("(()=>{const box=[...document.querySelectorAll('div[role=textbox][contenteditable=true]')].find(e=>e.getBoundingClientRect().width>0); if(!box) return null;"
               " let root=box.closest('[role=dialog]'); if(!root){root=box; for(let i=0;i<8&&root.parentElement;i++){root=root.parentElement; if([...root.querySelectorAll('button,div[role=button]')].some(e=>/^发布$|^發佈$|^Post$/.test((e.innerText||'').trim()))) break;}}"
               " return [...root.querySelectorAll('button,div[role=button]')].find(e=>/^发布$|^發佈$|^Post$/.test((e.innerText||'').trim())&&e.getBoundingClientRect().width>0)||null;})()")
        time.sleep(2)
        st = t.ev("(()=>{const b=%s; if(!b) return 'none'; return JSON.stringify({dis: b.getAttribute('aria-disabled')||b.disabled||false, tag:b.tagName});})()" % BTN)
        if st == 'none': return {"ok": False, "why": "编辑器容器里找不到「发布」按钮"}
        btn = center(t, BTN)
        t.click(btn["x"], btn["y"]); time.sleep(6)
        still = t.ev("(()=>{const e=[...document.querySelectorAll('div[role=textbox][contenteditable=true]')].find(e=>e.getBoundingClientRect().width>0); return e? e.innerText.length : 0;})()")
        if still and still > 0:
            # 真鼠标没生效，编辑器还开着且有字 → JS click 再试一次
            t.ev("(()=>{const b=%s; if(b) b.click();})()" % BTN); time.sleep(6)
        # 回读：去主页看最新一条是不是它（主页帖子懒加载，多等、多滚）
        t.goto("https://www.threads.com/@%s" % HANDLE, wait=12)
        for _ in range(3): t.ev("window.scrollBy(0,500)"); time.sleep(1.5)
        head = text.split("\n")[0][:20]
        found = t.ev("(()=>{const b=document.body.innerText||''; return b.indexOf(%s)>=0;})()" % json.dumps(head))
        link = t.ev("(()=>{const a=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).find(h=>/^\\/@%s\\/post\\//.test(h)); return a? 'https://www.threads.com'+a : '';})()" % HANDLE)
        return {"ok": bool(found), "why": "" if found else "发布后主页上没看到这条", "url": link}
    finally:
        try: http("/json/close/" + tid)
        except Exception: pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text"); ap.add_argument("--from-drafts", action="store_true"); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    texts = []
    # 已发记录：每行 "YYYY-MM-DD kind"。同一天同一栏目只发一次——
    # 手动发过一条之后 cron 再跑，或者 cron 跑到一半失败重跑，都不能把同一条再发一遍。
    POSTED = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".threads-posted")
    done = set()
    if os.path.exists(POSTED):
        done = {ln.strip() for ln in open(POSTED, encoding="utf-8") if ln.strip()}
    items = []   # (text, key)
    if a.from_drafts:
        data = json.load(sys.stdin)
        for d in data.get("drafts", []):
            if d["text"].startswith("（"): continue   # 括号开头的是提示，不是帖子
            key = "%s %s" % (data.get("date", ""), d.get("kind", ""))
            if key in done: print("⏭ 今天这栏已发过，跳过：" + key); continue
            items.append((d["text"], key))
    elif a.text: items = [(a.text, None)]
    if not items: sys.exit("没有要发的内容")
    rc = 0
    for tx, key in items:
        r = post(tx, a.dry_run)
        print(("✅ " if r.get("ok") else "❌ ") + json.dumps(r, ensure_ascii=False))
        if r.get("ok") and key and not a.dry_run:
            with open(POSTED, "a", encoding="utf-8") as f: f.write(key + "\n")
        if not r.get("ok"): rc = 1
        time.sleep(3)
    sys.exit(rc)

if __name__ == "__main__": main()
