import json
import os
import time
import ssl
import urllib.request
import urllib.parse
import concurrent.futures

CACHE_FILE = 'scripts/data_speaking/translations_cache.json'
RAW_FILE = 'scripts/data_speaking/speaking_2026_raw.json'

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

with open(RAW_FILE, 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

unique_texts = set()
for month, tasks in raw_data.items():
    for q in tasks.get('tache2', []):
        q_clean = q.strip()
        if q_clean and len(q_clean) > 3:
            unique_texts.add(q_clean)
    for q in tasks.get('tache3', []):
        q_clean = q.strip()
        if q_clean and len(q_clean) > 3:
            unique_texts.add(q_clean)

# Start clean or check existing valid translations (where fr != en)
valid_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            old_cache = json.load(f)
        for k, v in old_cache.items():
            if k != v and not v.lower().startswith('my memory'):
                valid_cache[k] = v
    except Exception:
        pass

print(f"Total unique texts: {len(unique_texts)}")
print(f"Valid cached translations: {len(valid_cache)}")

to_translate = [t for t in unique_texts if t not in valid_cache]
print(f"To translate now: {len(to_translate)}")

def translate_gtx(text):
    url = f"https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=fr&tl=en&dt=t&q={urllib.parse.quote(text)}"
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                trans = ''.join(c[0] for c in data[0] if c and c[0])
                if trans:
                    return text, trans.strip()
        except Exception:
            time.sleep(0.5 + attempt * 0.5)
    return text, text

completed = 0
start_time = time.time()

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    futures = {executor.submit(translate_gtx, t): t for t in to_translate}
    for future in concurrent.futures.as_completed(futures):
        t, en = future.result()
        valid_cache[t] = en
        completed += 1
        if completed % 50 == 0 or completed == len(to_translate):
            elapsed = time.time() - start_time
            pct = completed / len(to_translate) * 100
            print(f"Progress: {completed}/{len(to_translate)} ({pct:.1f}%) in {elapsed:.1f}s")
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(valid_cache, f, ensure_ascii=False, indent=2)

print(f"FINISHED! Total cache size: {len(valid_cache)}")
