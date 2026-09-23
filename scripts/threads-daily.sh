#!/usr/bin/env bash
# 每天跑一次：按台北当天该发什么（today / week / month / fun）算草稿，然后经家里 Chrome 的 CDP 代发到 Threads。
#
# 为什么内容不会旧：草稿是**发的那一刻**从 brands.ts 算出来的，不是提前写好存着；
# fun 栏目是常青闲聊，本来就没有时效。用户 2026-09-24 要求「坚持发 + 偶尔娱乐内容」，
# 之前反对定时的理由是怕拿到旧内容——这个设计正是为了绕开那个问题。
#
# 依赖：家里 Chrome 的 CDP 隧道（127.0.0.1:19222）。隧道断了就只记日志不重试，
# 别在这里起新隧道——那条隧道是别的会话/脚本维护的，两个人抢会更糟。
# 日志：scripts/threads.log（已 gitignore）。crontab 见 README 或 `crontab -l`。
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/current/bin:$PATH"
LOG=scripts/threads.log
DRY="${1:-}"
stamp() { TZ=Asia/Shanghai date '+%F %T'; }
if ! curl -s -m 5 http://127.0.0.1:19222/json/version >/dev/null; then
  echo "$(stamp) SKIP 家里 Chrome CDP 隧道不通（19222）" >> "$LOG"; exit 2
fi
DRAFTS=$(npx tsx scripts/threads-drafts.ts --json 2>/dev/null)
N=$(printf '%s' "$DRAFTS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len([x for x in d["drafts"] if not x["text"].startswith("（")]))' 2>/dev/null || echo 0)
if [ "$N" = "0" ]; then echo "$(stamp) NONE 今天没有该发的栏目" >> "$LOG"; exit 0; fi
if [ "$DRY" = "--dry-run" ]; then
  echo "$(stamp) DRY $N 条：" >> "$LOG"; printf '%s\n' "$DRAFTS" >> "$LOG"; exit 0
fi
printf '%s' "$DRAFTS" | python3 scripts/threads-post.py --from-drafts 2>&1 | while IFS= read -r line; do echo "$(stamp) $line" >> "$LOG"; done
