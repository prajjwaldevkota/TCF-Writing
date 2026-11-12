import urllib.request
import ssl
import json
import re
import os
import sys

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
}

def clean_doc_string(doc):
    if not doc:
        return ""
    if isinstance(doc, dict):
        return doc.get('contenu', '').strip()
    doc_str = str(doc).strip()
    if 'contenu' in doc_str:
        # Match contenu value between quotes
        m = re.search(r"['\"]contenu['\"]\s*:\s*(['\"])([\s\S]*?)\1\s*(?:,\s*['\"]opinion['\"]|})", doc_str)
        if m:
            val = m.group(2)
            val = val.replace('\\n', '\n').replace("\\'", "'").replace('\\"', '"')
            return val.strip()
        m2 = re.search(r"['\"]contenu['\"]\s*:\s*['\"](.*?)['\"]", doc_str, re.DOTALL)
        if m2:
            val = m2.group(1)
            val = val.replace('\\n', '\n').replace("\\'", "'").replace('\\"', '"')
            return val.strip()
    return doc_str

def parse_month_page(slug):
    url = f"https://www.formation-tcfcanada.com/epreuve/expression-ecrite/sujets-actualites/{slug}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=20) as resp:
            html = resp.read().decode('utf-8')
    except Exception as e:
        return {}

    results = {}

    # Method 1: Try JSON extraction
    pos = html.find('monthData')
    if pos != -1:
        brace_idx = html.rfind('{', 0, pos)
        depth = 0
        end_idx = brace_idx
        for i in range(brace_idx, len(html)):
            c = html[i]
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i + 1
                    break

        raw = html[brace_idx:end_idx]
        cleaned = raw.replace('\\"', '"')
        try:
            data = json.loads(cleaned)
            combos = data.get('monthData', {}).get('combinaisons', [])
            for c in combos:
                cid = c.get('id')
                t3 = c.get('tache3', {})
                titre = t3.get('titre', '').strip()
                d1_obj = t3.get('document1')
                d2_obj = t3.get('document2')
                d1 = d1_obj.get('contenu', '').strip() if isinstance(d1_obj, dict) else clean_doc_string(d1_obj)
                d2 = d2_obj.get('contenu', '').strip() if isinstance(d2_obj, dict) else clean_doc_string(d2_obj)
                if cid:
                    results[cid] = {'titre': titre, 'document1': d1, 'document2': d2}
        except Exception:
            pass

def safe_clean_rsc_text(val):
    if not val:
        return ''
    # Only decode unicode escapes \uXXXX without double-encoding existing UTF-8 characters
    val = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), val)
    val = val.replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'").replace('\\\\', '\\')
    return val.strip()

    # Method 2: Regex extraction as robust fallback
    # Match pattern: \"tache3\":{\"titre\":\"...\"
    pattern = re.compile(r'\\"tache3\\":\{\\"titre\\":\\"([^\\"]+)\\"')
    for m in pattern.finditer(html):
        titre = safe_clean_rsc_text(m.group(1))
        p = m.start()
        sub_chunk = html[max(0, p - 4000):p]
        m_ids = re.findall(r'\\"id\\":(\d+)', sub_chunk)
        if m_ids:
            cid = int(m_ids[-1])
            if cid not in results or not results[cid].get('titre'):
                # Also try to extract document1 and document2 in following chunk
                after_chunk = html[m.end():m.end() + 4000]
                m_d1 = re.search(r'\\"document1\\":\{\\"contenu\\":\\"([^\\"]+)\\"', after_chunk)
                m_d2 = re.search(r'\\"document2\\":\{\\"contenu\\":\\"([^\\"]+)\\"', after_chunk)
                d1 = safe_clean_rsc_text(m_d1.group(1)) if m_d1 else ''
                d2 = safe_clean_rsc_text(m_d2.group(1)) if m_d2 else ''
                results[cid] = {
                    'titre': titre,
                    'document1': d1,
                    'document2': d2
                }

    return results

def main():
    questions_file = os.path.join(os.path.dirname(__file__), "..", "src", "data", "questions.json")
    with open(questions_file, 'r', encoding='utf-8') as f:
        db = json.load(f)

    # All month slugs including specific abbreviations used by the source website
    slugs = [
        "httpsstaging-tcf-canada-nextbendevaiepreuveexpression-ecritesujets-actualitesjanvier-2026",
        "aot-2026", "fvrier-2026", "avril", "janvier-2026", "mars-2026", "mai-2026",
        "juin-2026", "juillet-2026", "septembre-2026", "octobre-2026", "novembre-2026", "decembre-2026",
        "janvier-2025", "fevrier-2025", "fvrier-2025", "mars-2025", "avril-2025", "mai-2025",
        "juin-2025", "juillet-2025", "aout-2025", "aot-2025", "septembre-2025", "octobre-2025",
        "novembre-2025", "decembre-2025",
        "juillet-2024", "aout-2024", "aot-2024", "septembre-2024", "octobre-2024", "novembre-2024", "decembre-2024"
    ]

    online_combos_by_id = {}
    print("Scraping all month slugs with dual JSON/Regex parser...")
    for s in slugs:
        res = parse_month_page(s)
        if res:
            print(f"  {s}: extracted {len(res)} combinations")
            online_combos_by_id.update(res)

    print(f"Total unique combinations scraped: {len(online_combos_by_id)}")

    updated_titles = 0
    cleaned_docs = 0

    for year, months in db.items():
        for month, combos in months.items():
            for c in combos:
                cid = c.get('combination')
                t3 = c.get('tasks', {}).get('task3', {})

                if cid in online_combos_by_id:
                    info = online_combos_by_id[cid]
                    if info.get('titre'):
                        t3['title'] = info['titre'].strip()
                        t3['instruction'] = info['titre'].strip()
                        updated_titles += 1
                    if info.get('document1'):
                        t3['document1'] = clean_doc_string(info['document1'])
                    if info.get('document2'):
                        t3['document2'] = clean_doc_string(info['document2'])

                # Always ensure document1 & document2 are completely clean of dictionary strings
                t3['document1'] = clean_doc_string(t3.get('document1'))
                t3['document2'] = clean_doc_string(t3.get('document2'))
                cleaned_docs += 1

    with open(questions_file, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print(f"DONE! {updated_titles} titles updated, {cleaned_docs} task3 docs cleaned in questions.json.")

if __name__ == '__main__':
    main()
