import os
import requests
import json
import sqlite3
from datetime import datetime, timezone, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'yxl_management.db')

# --- 1. DB 초기화 로직 ---
def init_db_if_empty():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='Members'")
    if cur.fetchone()[0] == 0:
        cur.execute('''CREATE TABLE IF NOT EXISTS Positions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, theme_color TEXT, rank_order INTEGER)''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, soop_id TEXT NOT NULL, position_id INTEGER, img_url TEXT, age TEXT, join_date TEXT, stats TEXT, mbti TEXT, skill TEXT, FOREIGN KEY (position_id) REFERENCES Positions (id))''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Seasons (id INTEGER PRIMARY KEY AUTOINCREMENT, season_num INTEGER NOT NULL, rank_revenue INTEGER DEFAULT 0)''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Episodes (id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, title TEXT NOT NULL, revenue INTEGER NOT NULL, FOREIGN KEY (season_id) REFERENCES Seasons (id))''')
        
        # 기본 데이터 입력 (생략된 부분은 이전 코드를 참고하여 채우시면 됩니다)
        positions = [('대표', '#FFD700', 1), ('부장', '#C0C0C0', 3)] # 예시
        cur.executemany('INSERT INTO Positions (name, theme_color, rank_order) VALUES (?, ?, ?)', positions)
        conn.commit()
    conn.close()

# --- 2. 데이터 가져오기 로직 ---
def get_members_from_db():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('''SELECT m.name, m.soop_id, p.name, m.img_url, m.age, m.join_date, m.stats, m.mbti, m.skill FROM Members m JOIN Positions p ON m.position_id = p.id''')
    rows = cur.fetchall()
    conn.close()
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    members = []
    for r in rows:
        j_date = datetime.strptime(r[5].strip(), "%Y.%m.%d").replace(tzinfo=kst)
        d_day = (now - j_date).days + 1
        members.append({"name": r[0], "id": r[1], "pos": r[2], "img": r[3], "d_day": f"D+{d_day}"})
    return members

# --- 3. HTML 생성 로직 ---
def generate_full_system(members):
    status_html = "".join([f"<div>{m['name']} ({m['d_day']})</div>" for m in members]) # 간단화
    
    full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>YXL PORTAL</title>
    <style>
        body {{ background: #08080c; color: white; font-family: sans-serif; }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .section-header {{ color: #d4af37; font-weight: bold; margin: 20px 0; border-left: 4px solid #d4af37; padding-left: 10px; }}
    </style>
</head>
<body>
    <div style="display:flex; justify-content:center; gap:20px; padding:20px; border-bottom:1px solid #333;">
        <div onclick="switchTab(event, 'home')">홈</div>
        <div onclick="switchTab(event, 'status')">현황판</div>
        <div onclick="switchTab(event, 'data')">데이터</div>
        <div onclick="switchTab(event, 'bora')">보라방송</div>
    </div>

    <section id="home" class="tab-content active">
        <div class="section-header">공지</div>
        <div class="section-header">라이브</div>
        <div class="section-header">숏츠</div>
    </section>

    <section id="status" class="tab-content">
        {status_html}
    </section>

    <section id="data" class="tab-content">
        <div class="section-header">매출표/기여도/정산표</div>
    </section>

    <section id="bora" class="tab-content">
        <div class="section-header">보라방송</div>
    </section>

    <script>
        function switchTab(e, id) {{
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(id).style.display = 'block';
        }}
    </script>
</body>
</html>
"""
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

if __name__ == "__main__":
    init_db_if_empty()
    members = get_members_from_db()
    generate_full_system(members, {})
    print("성공적으로 index.html이 생성되었습니다.")