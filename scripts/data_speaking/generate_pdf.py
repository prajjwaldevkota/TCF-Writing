import json
import os
import html
import subprocess
import sys

RAW_FILE = 'scripts/data_speaking/speaking_2026_raw.json'
CACHE_FILE = 'scripts/data_speaking/translations_cache.json'
OUTPUT_HTML = 'scripts/data_speaking/tcf_speaking_2026.html'
OUTPUT_PDF = 'TCF_Canada_Expression_Orale_2026_Topics.pdf'

STANDARD_TASK1 = [
    {
        "num": 1,
        "category": "Présentation personnelle / Personal Introduction",
        "fr": "Pouvez-vous vous présenter brièvement ? (Votre nom, prénom, nationalité, âge, profession et situation familiale).",
        "en": "Could you briefly introduce yourself? (Your full name, nationality, age, occupation, and family status)."
    },
    {
        "num": 2,
        "category": "Lieu de vie et environnement / Living Environment",
        "fr": "Décrivez la ville ou le quartier où vous habitez actuellement. Qu'est-ce qui vous plaît le plus dans cet endroit ?",
        "en": "Describe the city or neighborhood where you currently live. What do you like most about this place?"
    },
    {
        "num": 3,
        "category": "Profession et études / Work & Studies",
        "fr": "Parlez-moi de votre métier ou de vos études. Quelles sont vos tâches principales au quotidien ?",
        "en": "Tell me about your job or your studies. What are your main daily responsibilities?"
    },
    {
        "num": 4,
        "category": "Loisirs et temps libre / Hobbies & Free Time",
        "fr": "Quels sont vos passe-temps favoris pendant vos fins de semaine ou pendant vos vacances ?",
        "en": "What are your favorite hobbies on weekends or during your vacations?"
    },
    {
        "num": 5,
        "category": "Projet d'immigration / Immigration Project to Canada",
        "fr": "Pourquoi apprenez-vous le français et pour quelles raisons souhaitez-vous vous installer au Canada ?",
        "en": "Why are you learning French and for what reasons do you wish to settle in Canada?"
    },
    {
        "num": 6,
        "category": "Habitudes et journée type / Daily Routine",
        "fr": "Racontez-moi une journée typique dans votre vie (du matin au soir).",
        "en": "Describe a typical day in your life (from morning until evening)."
    },
    {
        "num": 7,
        "category": "Cuisine et gastronomie / Food & Gastronomy",
        "fr": "Quel est votre plat préféré ou parlez-moi d'une spécialité culinaire de votre pays d'origine.",
        "en": "What is your favorite dish or tell me about a traditional culinary specialty from your home country."
    },
    {
        "num": 8,
        "category": "Voyages et souvenirs / Travel & Memories",
        "fr": "Aimez-vous voyager ? Racontez-moi votre dernier voyage marquant ou une fête mémorable.",
        "en": "Do you like traveling? Tell me about your last memorable trip or a special celebration."
    },
    {
        "num": 9,
        "category": "Moyens de transport / Transportation",
        "fr": "Comment vous déplacez-vous au quotidien ? Préférez-vous les transports en commun ou la voiture ?",
        "en": "How do you commute daily? Do you prefer public transit or driving a car?"
    },
    {
        "num": 10,
        "category": "Sport et santé / Sports & Health",
        "fr": "Pratiquez-vous une activité physique ou sportive régulièrement ? Quels en sont les bienfaits pour vous ?",
        "en": "Do you regularly participate in any physical or sports activities? What are the benefits for you?"
    }
]

MONTH_ORDER = [
    "Octobre 2026", "Septembre 2026", "Août 2026", "Juillet 2026",
    "Juin 2026", "Mai 2026", "Avril 2026", "Mars 2026",
    "Février 2026", "Janvier 2026"
]

def build_html():
    with open(RAW_FILE, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    cache = {}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)

    # Count totals
    total_months = len(raw_data)
    total_t2 = sum(len(m.get('tache2', [])) for m in raw_data.values())
    total_t3 = sum(len(m.get('tache3', [])) for m in raw_data.values())
    total_topics = total_t2 + total_t3

    html_parts = []
    html_parts.append("""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>TCF Canada — Expression Orale 2026 Topics Bank</title>
<style>
  @page {
    size: A4 portrait;
    margin: 14mm 12mm 14mm 12mm;
    @bottom-right {
      content: counter(page);
    }
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.45;
    font-size: 11pt;
    margin: 0;
    padding: 0;
  }
  .header-cover {
    background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
    color: #ffffff;
    padding: 24px 28px;
    border-radius: 10px;
    margin-bottom: 24px;
    page-break-after: avoid;
  }
  .header-cover h1 {
    font-size: 22pt;
    margin: 0 0 6px 0;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  .header-cover h2 {
    font-size: 13pt;
    color: #93c5fd;
    margin: 0 0 12px 0;
    font-weight: 600;
  }
  .header-cover p {
    font-size: 10pt;
    color: #cbd5e1;
    margin: 0 0 14px 0;
  }
  .stats-bar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .stat-pill {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 8.5pt;
    font-weight: 600;
    color: #ffffff;
  }
  .info-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #2563eb;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .info-box h3 {
    margin: 0 0 6px 0;
    font-size: 11pt;
    color: #1e3a8a;
    font-weight: 700;
  }
  .info-box p {
    margin: 0;
    font-size: 9.5pt;
    color: #475569;
  }
  .month-section {
    margin-bottom: 28px;
    page-break-inside: avoid;
  }
  .month-title {
    background: #1e293b;
    color: #ffffff;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24px;
    margin-bottom: 14px;
    page-break-after: avoid;
  }
  .month-badge {
    background: #3b82f6;
    color: #ffffff;
    font-size: 8.5pt;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
  }
  .task-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 10px 0;
    padding-bottom: 4px;
    border-bottom: 2px solid #cbd5e1;
    page-break-after: avoid;
  }
  .task-tag {
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    color: #ffffff;
  }
  .tag-t1 { background: #059669; }
  .tag-t2 { background: #2563eb; }
  .tag-t3 { background: #7c3aed; }
  .task-title-text {
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
  }
  .task-duration {
    margin-left: auto;
    font-size: 8.5pt;
    font-weight: 600;
    color: #64748b;
  }
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .card:nth-child(even) {
    background: #f8fafc;
  }
  .card-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }
  .card-num {
    font-size: 8.5pt;
    font-weight: 800;
    color: #64748b;
    min-width: 24px;
  }
  .card-fr {
    font-size: 9.5pt;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.4;
  }
  .card-en {
    font-size: 9pt;
    color: #2563eb;
    margin-left: 32px;
    line-height: 1.35;
    font-style: italic;
  }
  .footer-note {
    text-align: center;
    font-size: 8pt;
    color: #94a3b8;
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
  }
</style>
</head>
<body>
""")

    # Cover / Header
    html_parts.append(f"""
<div class="header-cover">
  <h1>TCF Canada — Expression Orale (Speaking)</h1>
  <h2>Banque Officielle des Sujets 2026 • Bilingual FR / EN Topics Bank</h2>
  <p>Recueil complet des questions d'examen par mois avec traductions intégrales en anglais.</p>
  <div class="stats-bar">
    <div class="stat-pill">📅 Année 2026 (10 Mois disponibles)</div>
    <div class="stat-pill">🗣️ {total_topics} Sujets Tâche 2 & Tâche 3</div>
    <div class="stat-pill">💬 Tâche 1 Questions officielles incluses</div>
    <div class="stat-pill">🇨🇦 Bilingue Français / Anglais</div>
  </div>
</div>

<div class="info-box">
  <h3>Structure de l'Épreuve d'Expression Orale (TCF Canada — 12 minutes au total)</h3>
  <p><strong>• Tâche 1 (2 min) :</strong> Entretien dirigé sans préparation. Questions personnelles familières (A1-A2).<br>
  <strong>• Tâche 2 (5 min 30 : 2 min préparation + 3 min 30 échange) :</strong> Interaction sous forme de jeu de rôle. Vous devez poser une dizaine de questions à l'examinateur (B1-B2).<br>
  <strong>• Tâche 3 (4 min 30 sans préparation) :</strong> Expression d'un point de vue argumenté sur un thème de société (B2-C2).</p>
</div>
""")

    # Section TACHE 1
    html_parts.append("""
<div class="month-section">
  <div class="month-title" style="background: #065f46;">
    <span>TÂCHE 1 — Entretien Dirigé (Questions Types Officielles)</span>
    <span class="month-badge" style="background: #10b981;">10 Thèmes Clés</span>
  </div>
  <div class="task-header">
    <span class="task-tag tag-t1">TÂCHE 1</span>
    <span class="task-title-text">Questions fréquentes posées par l'examinateur lors de l'entretien initial</span>
    <span class="task-duration">Durée : 2 minutes • Sans préparation</span>
  </div>
""")

    for item in STANDARD_TASK1:
        fr_esc = html.escape(item['fr'])
        en_esc = html.escape(item['en'])
        cat_esc = html.escape(item['category'])
        html_parts.append(f"""
  <div class="card">
    <div class="card-top">
      <span class="card-num">#{item['num']}</span>
      <div>
        <span style="font-size: 8pt; font-weight: 700; color: #047857; text-transform: uppercase;">[{cat_esc}]</span><br>
        <span class="card-fr">{fr_esc}</span>
      </div>
    </div>
    <div class="card-en">{en_esc}</div>
  </div>
""")
    html_parts.append("</div>")

    # Monthly Sections
    for mname in MONTH_ORDER:
        if mname not in raw_data:
            continue
        mdata = raw_data[mname]
        t2_list = mdata.get('tache2', [])
        t3_list = mdata.get('tache3', [])
        total_m = len(t2_list) + len(t3_list)

        html_parts.append(f"""
<div class="month-section">
  <div class="month-title">
    <span>Mois de {html.escape(mname)}</span>
    <span class="month-badge">{total_m} Sujets ({len(t2_list)} T2 + {len(t3_list)} T3)</span>
  </div>
""")

        # Tache 2
        if t2_list:
            html_parts.append("""
  <div class="task-header">
    <span class="task-tag tag-t2">TÂCHE 2</span>
    <span class="task-title-text">Exercice en interaction (Jeu de rôle / Poser des questions)</span>
    <span class="task-duration">2 min préparation + 3 min 30 interaction</span>
  </div>
""")
            for idx, q_fr in enumerate(t2_list, 1):
                q_clean = q_fr.strip()
                q_en = cache.get(q_clean, q_clean)
                html_parts.append(f"""
  <div class="card">
    <div class="card-top">
      <span class="card-num">#{idx}</span>
      <span class="card-fr">{html.escape(q_clean)}</span>
    </div>
    <div class="card-en">{html.escape(q_en)}</div>
  </div>
""")

        # Tache 3
        if t3_list:
            html_parts.append("""
  <div class="task-header">
    <span class="task-tag tag-t3">TÂCHE 3</span>
    <span class="task-title-text">Expression d'un point de vue (Débat d'opinion / Argumentation)</span>
    <span class="task-duration">4 min 30 • Sans préparation</span>
  </div>
""")
            for idx, q_fr in enumerate(t3_list, 1):
                q_clean = q_fr.strip()
                q_en = cache.get(q_clean, q_clean)
                html_parts.append(f"""
  <div class="card">
    <div class="card-top">
      <span class="card-num">#{idx}</span>
      <span class="card-fr">{html.escape(q_clean)}</span>
    </div>
    <div class="card-en">{html.escape(q_en)}</div>
  </div>
""")

        html_parts.append("</div>")

    html_parts.append("""
<div class="footer-note">
  TCF Canada — Expression Orale Question Bank 2026 • Source : formation-tcfcanada.com • Bilingue Français / Anglais
</div>
</body>
</html>
""")

    full_html = "".join(html_parts)
    with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print(f"Generated HTML at {OUTPUT_HTML} ({len(full_html)} bytes)")

    # Run Chrome headless to generate PDF
    chrome_cmd = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        f'--print-to-pdf={OUTPUT_PDF}',
        OUTPUT_HTML
    ]
    print("Converting HTML to PDF with Chrome headless...")
    res = subprocess.run(chrome_cmd, capture_output=True, text=True)
    if os.path.exists(OUTPUT_PDF):
        size_mb = os.path.getsize(OUTPUT_PDF) / (1024 * 1024)
        print(f"SUCCESS: Generated PDF at {OUTPUT_PDF} ({size_mb:.2f} MB)")
        
        # Copy to public folder
        import shutil
        public_dir = os.path.join(os.path.dirname(__file__), "..", "..", "public")
        if os.path.exists(public_dir):
            shutil.copy(OUTPUT_PDF, os.path.join(public_dir, OUTPUT_PDF))
            print(f"Copied to public/{OUTPUT_PDF}")
            
        # Copy to artifacts directory
        artifacts_dir = "/Users/Écriturepatel/.gemini/antigravity-ide/brain/b193b73a-dc50-4e8b-b083-d362c33be474"
        if os.path.exists(artifacts_dir):
            shutil.copy(OUTPUT_PDF, os.path.join(artifacts_dir, OUTPUT_PDF))
            print(f"Copied to artifacts: {artifacts_dir}/{OUTPUT_PDF}")
    else:
        print(f"Error generating PDF: {res.stderr}")

if __name__ == '__main__':
    build_html()
