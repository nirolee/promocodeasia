#!/usr/bin/env python3
"""优惠证据采集与持久化队列；只输出核验材料，不把候选冒充可发布数据。"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
VERSION = 1
TAIPEI = ZoneInfo('Asia/Taipei')
CODE = re.compile(r'(?<![A-Z0-9])[A-Z0-9]{4,64}(?![A-Z0-9])')
COUPON = re.compile(r'折扣|優惠|折抵|訂購|出發|限量|限用|帳號|付款|AFTEE|coupon', re.I)


def utcnow():
    return datetime.now(timezone.utc)


def stamp(value):
    return value.isoformat(timespec='seconds')


def parse_time(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('证据时间必须包含时区')
    return result


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix='.write-')
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def locked(directory):
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / 'lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError('已有采集进程或遗留锁；先核实进程，不自动抢锁')
    try:
        os.write(descriptor, str(os.getpid()).encode())
        os.close(descriptor)
        yield
    finally:
        lock.unlink()


def load_state(directory):
    path = directory / 'state.json'
    if not path.exists():
        return {'version': VERSION, 'sources': {}, 'candidates': {}, 'checkpoints': {}}
    state = json.loads(path.read_text(encoding='utf-8'))
    if state.get('version') != VERSION:
        raise ValueError('状态文件版本不匹配，禁止覆盖')
    return state


def canonical(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.username or parts.password or parts.fragment:
        raise ValueError('快照必须是登记的公开 HTTPS 来源，不允许嵌入身份信息或片段')
    return parts.hostname, parts.path.rstrip('/'), tuple(sorted(parts.query.split('&')))


def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


def evidence(snap):
    sections = [normalize(item['text']) for item in snap.get('sections', [])
                if re.search(r'活動內容|注意事項|使用條款|優惠說明|活動辦法', item.get('heading', ''))]
    tables = snap.get('tables', [])
    cards = [normalize(card) for card in snap.get('cards', [])]
    if not sections and not cards and not tables:
        sections = [normalize(line) for line in snap.get('text', '').splitlines() if COUPON.search(line)]
    context = [normalize(line) for line in snap.get('text', '').splitlines()
               if re.search(r'限用|限量|每帳號|每個帳號|折扣碼|優惠碼|折扣券|訂購|出發|使用條款|付款|不得|不可|不適用|排除|期限|有效|幣別|活動期間|活動時間', line)]
    return {'sections': sections, 'cards': cards, 'tables': tables, 'context': context,
            'links': snap.get('links', [])}


def candidate_rows(snap):
    rows = []
    for card in snap.get('cards', []):
        match = re.search(r'(?:折扣券|折扣碼|優惠碼)\s*[:：]?\s*([A-Z0-9]{4,64})', card)
        if match:
            rows.append({'code': match[1], 'context': normalize(card), 'status': 'needs_terms'})
    for table in snap.get('tables', []):
        if not table:
            continue
        header = table[0]
        index = next((position for position, cell in enumerate(header)
                      if re.search(r'折扣碼|優惠碼', cell) and not re.search(r'專用|部落格', cell)), None)
        if index is None:
            continue
        blocked = next((position for position, cell in enumerate(header) if '部落格' in cell), None)
        for row in table[1:]:
            if index >= len(row):
                continue
            content = re.sub(r'[（(][^）)]*[）)]', '', row[index]).strip()
            tokens = re.split(r'\s+', content)
            if not tokens or not all(CODE.fullmatch(token) and re.search('[A-Z]', token) for token in tokens):
                continue
            private = blocked is not None and blocked < len(row) and row[blocked].strip().upper().startswith('V')
            for token in tokens:
                rows.append({'code': token, 'context': normalize(' | '.join(row)),
                             'status': 'excluded' if private else 'needs_terms'})
    text = snap.get('text', '')
    explicit = re.compile(r'(?:[「【]([A-Z0-9]{4,64})[」】]|(?:折扣券|折扣碼|優惠碼)[：:\s]*([A-Z0-9]{4,64})(?![A-Z0-9]))')
    for match in explicit.finditer(text):
        token = match[1] or match[2]
        context = text[max(0, match.start() - 80):match.end() + 100]
        private = '部落格讀者' in context or '需透過此文' in context
        if re.search('[A-Z]', token):
            rows.append({'code': token, 'context': normalize(context),
                         'status': 'excluded' if private else 'needs_terms'})
    copy_button = re.compile(r'^([^\n]{2,60})\n+([A-Z0-9]{4,64})\s*\n+複製\s*\n+([^\n]{4,200})', re.M)
    for match in copy_button.finditer(text):
        title, token, detail = match.groups()
        private = '部落格讀者' in title or '需透過此文' in detail
        rows.append({'code': token, 'context': normalize(title + ' ' + detail),
                     'status': 'excluded' if private else 'needs_terms'})
    unique = {}
    for row in rows:
        if row['code'] not in unique or row['status'] == 'excluded':
            unique[row['code']] = row
    return list(unique.values())


def offer_signature(text):
    text = re.sub(r'[\s,$，]', '', text)
    fixed = re.search(r'(?:滿)?(?:NT\$?)?(\d+)折(?:NT\$?)?(\d+)', text)
    if fixed:
        return ('fixed', int(fixed[1]), int(fixed[2]))
    rate = re.search(r'(\d{2})折', text)
    return ('rate', int(rate[1])) if rate else None


def parse_aftee(snap, today):
    rows = candidate_rows(snap)
    periods = []
    for section in snap.get('sections', []):
        if normalize(section.get('heading', '')) != 'KKday X AFTEE 活動內容':
            continue
        text = section['text']
        match = re.search(r'訂購時間[：:]\s*(\d{4}/\d{2}/\d{2})\s*[~～–-]\s*(\d{4}/\d{2}/\d{2})[；;]\s*出發時間至\s*(\d{4}/\d{2}/\d{2})', text)
        if not match:
            continue
        start, end, travel = [datetime.strptime(value, '%Y/%m/%d').date() for value in match.groups()]
        if start <= today <= end:
            periods.append((start, end, travel, text))
    if len(periods) != 1:
        return rows, '没有唯一覆盖今天的明确订购/出发活动期'
    start, end, travel, text = periods[0]
    activities = re.findall(r'活動\d+[：:]\s*(.*?)(?=活動\d+[：:]|$)', text, flags=re.S)
    for row in rows:
        if row['status'] == 'excluded':
            continue
        title = row['context'].split('折扣券')[0]
        if not re.search(rf'【{start.month}月', title):
            row['reason'] = '券卡未明确标注本期月份'
            continue
        matches = [item.strip() for item in activities if offer_signature(item) == offer_signature(title)
                   and offer_signature(title) is not None]
        if len(matches) != 1:
            row['reason'] = '券卡优惠值不能唯一对应本期条款'
            continue
        clause = matches[0]
        if '會員日' in title or '會員日' in clause:
            row['reason'] = '会员日子活动日期另需核验，禁止沿用整月期限'
            continue
        cap = re.search(r'上限\s*\$\s*([\d,]+)', clause)
        quota = re.search(r'限量\s*([\d,]+)\s*組', clause)
        uses = re.search(r'每個帳號限用\s*(\d+)\s*次', clause)
        if not quota or not uses or 'AFTEE支付' not in re.sub(r'\s', '', clause):
            row['reason'] = '缺少支付方式、限量或每账户次数'
            continue
        signature = offer_signature(title)
        if signature[0] == 'rate' and not cap:
            row['reason'] = '折扣率缺少最高折抵金额'
            continue
        row.update(status='terms_complete', booking_start=str(start), expiresAt=str(end),
                   travel_end=str(travel), quota=int(quota[1].replace(',', '')), uses=int(uses[1]),
                   payment='AFTEE', offer=list(signature), clause=normalize(clause),
                   evidence_text=normalize(text), verification='官方条款核对，非付款实测',
                   commissionable='unknown')
        if cap:
            row['cap'] = int(cap[1].replace(',', ''))
    return rows, None


def ingest(source, snap, state, directory, now):
    if canonical(snap['url']) != canonical(source['url']):
        raise ValueError('快照 URL 与登记来源不一致')
    captured = parse_time(snap['capturedAt'])
    if captured > now + timedelta(minutes=5) or now - captured > timedelta(hours=6):
        raise ValueError('快照时间不可信或超过六小时，禁止用旧证据续期')
    if 'text' not in snap:
        snap['text'] = '\n'.join(snap.get('cards', []) + [item['text'] for item in snap.get('sections', [])])
    if not snap.get('title') or len(snap.get('text', '')) < 200:
        raise ValueError('正文太短，可能只有 iframe、错误页或未加载')
    if re.search(r'Just a moment|Access Denied|驗證您是真人|验证您是真人', snap['title'], re.I):
        raise ValueError('访问挑战，不当作官方条款，不绕过')
    focused = evidence(snap)
    fingerprint = digest(focused)
    previous = state['sources'].get(source['id'], {})
    changed = previous.get('fingerprint') != fingerprint
    if source['parser'] == 'aftee':
        rows, issue = parse_aftee(snap, now.astimezone(TAIPEI).date())
    else:
        rows, issue = candidate_rows(snap), '通用提取仅为候选，须补齐官方限制后才能发布'
    for row in rows:
        key = source['id'] + ':' + row['code']
        old = state['candidates'].get(key, {})
        row.update(source=source['url'], observedAt=stamp(captured))
        semantic = {key: value for key, value in row.items() if key != 'observedAt'}
        row_hash = digest(semantic)
        row['changed'] = old.get('fingerprint') != row_hash
        same = old.get('fingerprint') == row_hash
        next_review = old.get('next_review') if same else None
        if not next_review:
            next_review = stamp(now + timedelta(days=7 if row['status'] == 'needs_terms' else 2))
        row['review_due'] = not same or parse_time(next_review) <= now
        row['next_review'] = next_review
        state['candidates'][key] = {
            'fingerprint': row_hash, 'status': row['status'],
            'first_seen': old.get('first_seen', stamp(captured)), 'last_seen': stamp(captured),
            'next_review': next_review,
            'reason': row.get('reason', issue), 'repeat_count': old.get('repeat_count', 0) + 1 if same else 0,
        }
    status = 'readable' if any(row['status'] == 'terms_complete' for row in rows) else 'needs_terms'
    failures = previous.get('failures', 0)
    hours = source['interval_hours'] if status == 'readable' else (168 if changed else 24 * [7, 14, 30][min(failures, 2)])
    state['sources'][source['id']] = {
        'status': status, 'fingerprint': fingerprint, 'last_attempt': stamp(now),
        'last_read': stamp(captured), 'next_retry': stamp(now + timedelta(hours=hours)),
        'failures': 0 if status == 'readable' else failures + 1,
        'reason': issue, 'transport': 'browser', 'parser_version': VERSION,
    }
    report = {'source_id': source['id'], 'source': source['url'], 'capturedAt': stamp(captured),
              'fingerprint': fingerprint, 'changed': changed, 'status': status, 'issue': issue,
              'terms_complete': sum(row['status'] == 'terms_complete' for row in rows),
              'pending': sum(row['status'] == 'needs_terms' for row in rows), 'records': rows,
              'note': 'terms_complete 仅代表已实现适配器的字段完整；发布前仍须核对币种、地区、领取入口及全站排除项。'}
    atomic_json(directory / 'evidence' / (source['id'] + '-' + fingerprint[:16] + '.json'),
                {'url': source['url'], 'title': snap['title'], 'capturedAt': stamp(captured), **focused})
    atomic_json(directory / 'reports' / (source['id'] + '.json'), report)
    return report


def defer(source, state, now, reason, status):
    old = state['sources'].get(source['id'], {})
    count = old.get('failures', 0) + 1
    days = [1, 3, 7, 14][min(count - 1, 3)] if status == 'fetch_failed' else [7, 14, 30][min(count - 1, 2)]
    record = {**old, 'status': status, 'failures': count, 'last_attempt': stamp(now),
              'reason': reason, 'next_retry': stamp(now + timedelta(days=days)), 'parser_version': VERSION}
    if status == 'needs_user':
        record['next_retry'] = None
    state['sources'][source['id']] = record
    return record


def plan(sources, state, now):
    due, skipped = [], []
    for source in sources:
        previous = state['sources'].get(source['id'], {})
        status, retry = previous.get('status'), previous.get('next_retry')
        item = {**source, 'last_status': status, 'next_retry': retry, 'reason': previous.get('reason')}
        if status == 'needs_user' or (retry and parse_time(retry) > now):
            skipped.append(item)
        else:
            due.append(item)
    return {'due': due, 'skipped': skipped, 'checkpoints': state.get('checkpoints', {})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir', type=Path, default=ROOT / '.cache' / 'coupon-sync')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('plan')
    read = sub.add_parser('ingest')
    read.add_argument('source_id')
    read.add_argument('--input', type=Path, required=True)
    failure = sub.add_parser('defer')
    failure.add_argument('source_id')
    failure.add_argument('--status', choices=['fetch_failed', 'needs_terms', 'needs_user'], default='needs_terms')
    failure.add_argument('--reason', required=True)
    wake = sub.add_parser('wake')
    wake.add_argument('source_id')
    wake.add_argument('--reason', required=True)
    checkpoint = sub.add_parser('checkpoint')
    checkpoint.add_argument('key', choices=['mail_after', 'discovery_after'])
    checkpoint.add_argument('value')
    review = sub.add_parser('review')
    review.add_argument('source_id')
    review.add_argument('--reason', required=True)
    args = parser.parse_args()
    sources = json.loads((ROOT / 'scripts' / 'coupon-sources.json').read_text(encoding='utf-8'))
    with locked(args.state_dir):
        state = load_state(args.state_dir)
        now = utcnow()
        if args.command == 'plan':
            result = plan(sources, state, now)
        elif args.command == 'checkpoint':
            parse_time(args.value)
            state['checkpoints'][args.key] = args.value
            result = state['checkpoints']
        else:
            source = next((source for source in sources if source['id'] == args.source_id), None)
            if not source:
                raise ValueError('来源未登记，先核实官方 URL 再加入配置')
            if args.command == 'ingest':
                result = ingest(source, json.loads(args.input.read_text(encoding='utf-8-sig')),
                                state, args.state_dir, now)
            elif args.command == 'defer':
                result = defer(source, state, now, args.reason, args.status)
            elif args.command == 'review':
                report_path = args.state_dir / 'reports' / (source['id'] + '.json')
                report = json.loads(report_path.read_text(encoding='utf-8'))
                if now - parse_time(report['capturedAt']) > timedelta(hours=6):
                    raise ValueError('核验材料已过六小时，请重新采集')
                previous = state['sources'][source['id']]
                if previous.get('fingerprint') != report['fingerprint']:
                    raise ValueError('当前材料与状态中的证据哈希不同')
                previous.update(status='reviewed', failures=0, last_review=stamp(now),
                                review_reason=args.reason, reviewed_fingerprint=report['fingerprint'],
                                next_retry=stamp(now + timedelta(hours=source['interval_hours'])))
                result = previous
            else:
                previous = state['sources'].setdefault(source['id'], {})
                previous.update(next_retry=stamp(now), status='woken', wake_reason=args.reason)
                result = previous
        atomic_json(args.state_dir / 'state.json', state)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as error:
        sys.exit('采集未完成：' + str(error))
