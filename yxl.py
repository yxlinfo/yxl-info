import os
import requests
import json
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'yxl_management.db')

# ==========================================
# [DB 연동 1] 멤버 데이터 불러오기
# ==========================================
def get_members_from_db():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('''
        SELECT m.name, m.soop_id, p.name, m.img_url, m.age, m.join_date, m.stats, m.mbti, m.skill
        FROM Members m
        JOIN Positions p ON m.position_id = p.id
        ORDER BY p.rank_order, m.id
    ''')
    rows = cur.fetchall()
    conn.close()
    
    members = []
    for r in rows:
        members.append({
            "name": r[0], "id": r[1], "pos": r[2], "img": r[3],
            "age": r[4], "join_date": r[5], "stats": r[6], "mbti": r[7], "skill": r[8]
        })
    return members

# ==========================================
# [DB 연동 2] 매출(시즌/회차) 데이터 불러오기
# ==========================================
def get_history_from_db():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('SELECT id, season_num, rank_revenue FROM Seasons ORDER BY season_num')
    seasons = cur.fetchall()
    
    history_db = {}
    for sid, snum, srev in seasons:
        cur.execute('SELECT title, revenue FROM Episodes WHERE season_id=? ORDER BY id', (sid,))
        episodes = cur.fetchall()
        history_db[f"시즌{snum}"] = {
            "직급전": srev,
            "contents": [[ep[0], ep[1]] for ep in episodes]
        }
    conn.close()
    return history_db

# ==========================================
# 1. 생방송 상태 체크 API
# ==========================================
def get_yxl_status(name, user_id, position, profile_url):
    url = f"https://api-channel.sooplive.com/v1.1/channel/{user_id}/home/section/broad"
    headers = {"User-Agent": "Mozilla/5.0"}
    colors = {
        "대표": "#FFD700", "비서실장": "#E5E4E2", "부장": "#C0C0C0", "차장": "#99A3A4",
        "과장": "#CD7F32", "대리": "#5DADE2", "주임": "#48C9B0",
        "선임사원": "#58D68D", "사원": "#F7DC6F", "인턴장": "#F08080", "시급이": "#F5B041", 
        "신입": "#EB984E", "웨이터": "#AF7AC5"
    }
    theme = colors.get(position, "#eee")
    try:
        res = requests.get(url, headers=headers, timeout=5).json()
        if res and "broadNo" in res:
            safe_title = res.get("broadTitle", "").replace('"', '&quot;').replace("'", "&#39;")
            return {
                "is_live": True, "name": name, "id": user_id, "pos": position,
                "theme": theme, "profile": profile_url, "title": safe_title,
                "viewers": format(res.get("currentSumViewer", 0), ','),
                "thumb": f"https://liveimg.sooplive.com/h/{res['broadNo']}.webp",
                "live_link": f"https://play.sooplive.com/{user_id}/{res['broadNo']}",
                "home_link": f"https://www.sooplive.com/station/{user_id}"
            }
    except: pass
    return {"is_live": False, "name": name, "id": user_id, "pos": position, "theme": theme, "profile": profile_url, "title": "OFFLINE", "viewers": "0", "thumb": "", "live_link": "#", "home_link": f"https://www.sooplive.com/station/{user_id}"}

# ==========================================
# 2. VOD 진짜 정보 SOOP API 호출 
# ==========================================
def fetch_vod_data_by_api(vid):
    api_url = "https://api.m.sooplive.co.kr/station/video/a/view"
    headers = {"User-Agent": "Mozilla/5.0"}
    data = {"nTitleNo": vid}
    try:
        res = requests.post(api_url, headers=headers, data=data, timeout=5).json()
        if res.get("result") == 1 and "data" in res:
            v_data = res["data"]
            title = v_data.get("title", f"VOD ({vid})").replace('"', '&quot;').replace("'", "&#39;")
            date = str(v_data.get("broad_start", "2026-00-00"))[:10].replace("-", ".")
            thumb = v_data.get("thumb", "")
            if thumb and thumb.startswith("//"): thumb = "https:" + thumb
            return {"id": vid, "title": title, "date": date, "views": int(v_data.get("view_cnt", 0)), "thumb": thumb}
    except: pass
    return {"id": vid, "title": "정보 없음", "date": "-", "views": 0, "thumb": ""}

# ==========================================
# 3. 메인 대시보드 시스템 생성
# ==========================================
def generate_full_system(members, history_db):
    print("\n[1/3] 생방송 상태를 체크합니다...")
    data_map = {m['name']: get_yxl_status(m['name'], m['id'], m['pos'], m['img']) for m in members}
    js_member_data = json.dumps({m['name']: m for m in members}, ensure_ascii=False)
    
    # 💡 직급 기반 층(Tier) 맵핑
    tier_mapping = {
        "대표": "EXECUTIVE",
        "비서실장": "LEAD", "부장": "LEAD",
        "차장": "SENIOR", "과장": "SENIOR", "대리": "SENIOR",
        "주임": "JUNIOR", "선임사원": "JUNIOR", "사원": "JUNIOR", "인턴장": "JUNIOR", "시급이": "JUNIOR",
        "신입": "ROOKIE",
        "웨이터": "WAITER"
    }
    
    tiers_order = ["EXECUTIVE", "LEAD", "SENIOR", "JUNIOR", "ROOKIE", "WAITER"]
    tier_groups = {tier: [] for tier in tiers_order}
    
    for m in members:
        tier = tier_mapping.get(m['pos'], "JUNIOR")
        tier_groups[tier].append(m)

    status_html = ""
    for tier_name in tiers_order:
        tier_members = tier_groups[tier_name]
        if not tier_members: continue
        
        # 💡 고급스러운 티어 헤더 추가
        status_html += f'''
        <div class="tier-section">
            <div class="tier-header">
                <div class="tier-line"></div>
                <div class="tier-title">{tier_name}</div>
                <div class="tier-line"></div>
            </div>
            <div class="row">
        '''
        
        for m in tier_members:
            info = data_map[m['name']]
            live_class = "on-air" if info['is_live'] else ""
            status_html += f"""
            <div class="member-unit {live_class}" data-thumb="{info['thumb']}" data-title="{info['title']}" data-viewers="{info['viewers']}">
                <div class="aura-container">
                    <div class="purple-aura"></div>
                    <div class="circle-frame" onclick="openProfile('{m['name']}')">
                        <img src="{info['profile']}" class="profile-img">
                        <div class="embedded-info">
                            <div class="pos-tag" style="color: {info['theme']};">{info['pos']}</div>
                            <div class="name-label">{info['name']}</div>
                        </div>
                        <div class="overlay-menu" onclick="event.stopPropagation()">
                            <div class="click-guide" onclick="openProfile('{m['name']}')">PROFILE</div>
                            <div class="btn-group">
                                <a href="{info["home_link"]}" target="_blank" class="btn btn-home">방송국</a>
                                {f'<a href="{info["live_link"]}" target="_blank" class="btn btn-live">LIVE</a>' if info['is_live'] else ''}
                            </div>
                        </div>
                    </div>
                    <div class="live-indicator">LIVE</div>
                </div>
            </div>"""
        status_html += '</div></div>'

    print("[2/3] 매출 데이터를 처리합니다...")
    js_labels = [f"시즌{i}" for i in range(1, len(history_db) + 1)]
    js_rank_rev = [history_db.get(f"시즌{i}", {"직급전":0})["직급전"] for i in range(1, len(history_db) + 1)]
    js_norm_rev = [sum(item[1] for item in history_db.get(f"시즌{i}", {"contents":[]})["contents"]) for i in range(1, len(history_db) + 1)]
    all_season_sum = sum(js_rank_rev) + sum(js_norm_rev)
    current_season_sum = sum([4343316, 2164822, 3135452])

    print("[3/3] SOOP VOD 데이터를 가져옵니다...")
    vod_ids = ["139389129", "140474073", "145078781", "145395293", "145430667", "145686859", "145694247", "146665451", "149341401", "149372371"]
    vod_ids.reverse() 
    vod_list = [fetch_vod_data_by_api(vid) for vid in vod_ids]
    valid_vods = [v for v in vod_list if v["views"] > 0]
    top_5_vods = sorted(valid_vods, key=lambda x: x['views'], reverse=True)[:5]
    main_vod = valid_vods[0] if valid_vods else {"id":"", "title":"", "date":"", "views":0, "thumb":""}

    print("\n✅ 모든 데이터 수집 완료! HTML 생성 중...")

    full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <title>YXL VIP LOUNGE</title>
    <!-- 💡 고급스러운 영문 폰트 (Cinzel) 추가 -->
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <style>
        body {{ background: #08080c; color: #fff; font-family: 'Pretendard', sans-serif; margin: 0; overflow-x: hidden; box-sizing: border-box; }}
        h1, h2, h3, h4, p, span, div {{ font-weight: 900; box-sizing: border-box; }}
        
        /* 네비게이션바 고급화 */
        .nav-header {{ position: sticky; top: 0; background: rgba(8, 8, 12, 0.85); border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.8); flex-wrap: wrap; gap: 10px; }}
        .logo-section {{ display: flex; align-items: center; cursor: pointer; }}
        .update-timer {{ font-size: 13px; font-weight: 900; color: #d4af37; margin-left: 15px; letter-spacing: 2px; font-family: 'Cinzel', serif; }}
        
        .tab-menu {{ display: flex; gap: 20px; flex-wrap: wrap; }}
        .tab-item {{ font-size: 14px; font-weight: 900; cursor: pointer; color: rgba(255,255,255,0.4); padding: 8px 5px; position: relative; text-transform: uppercase; transition: 0.4s; letter-spacing: 1px; }}
        .tab-item.active {{ color: #d4af37; text-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }}
        .tab-item.active::after {{ content: ''; position: absolute; bottom: -2px; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #d4af37, transparent); box-shadow: 0 0 10px #d4af37; }}
        
        .main-container {{ padding: 30px 15px; width: 100%; max-width: 950px; margin: 0 auto; min-height: 100vh; }}
        .tab-content {{ display: none; animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); width: 100%; }}
        .tab-content.active {{ display: block; }}
        @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(15px); }} to {{ opacity: 1; }} }}

        /* 💡 현황판 티어(층) UI 고급화 */
        .tier-section {{ margin-bottom: 50px; }}
        .tier-header {{ display: flex; align-items: center; justify-content: center; margin-bottom: 30px; gap: 20px; }}
        .tier-title {{ font-family: 'Cinzel', serif; font-size: 22px; color: #f5f5dc; letter-spacing: 4px; text-shadow: 0 2px 15px rgba(212, 175, 55, 0.4); }}
        .tier-line {{ height: 1px; flex: 1; max-width: 250px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent); }}

        .row {{ display: flex; flex-wrap: wrap; gap: 25px; justify-content: center; }}
        .member-unit {{ position: relative; width: 130px; transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }}
        .member-unit:hover {{ transform: translateY(-8px) scale(1.05); z-index: 50; }}
        
        /* 프레임 디자인 럭셔리화 */
        .circle-frame {{ position: relative; width: 120px; height: 120px; border-radius: 50%; padding: 3px; background: #111; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.8); margin: 0 auto; transition: 0.3s; }}
        .member-unit:hover .circle-frame {{ border-color: rgba(212, 175, 55, 0.5); box-shadow: 0 15px 35px rgba(212, 175, 55, 0.2); }}
        .profile-img {{ width: 100%; height: 100%; border-radius: 50%; object-fit: cover; filter: contrast(1.1) saturate(1.1); transition: 0.5s; }}
        .member-unit:hover .profile-img {{ transform: scale(1.1); }}
        
        .embedded-info {{ position: absolute; bottom: 0; width: 100%; height: 50%; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 12px; z-index: 3; }}
        .pos-tag {{ font-size: 10px; margin-bottom: 3px; font-weight: 800; letter-spacing: 0.5px; }}
        .name-label {{ font-size: 14px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.9); }}
        
        .overlay-menu {{ position: absolute; inset: 0; background: rgba(8,8,12,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: 0.3s; z-index: 10; border-radius: 50%; backdrop-filter: blur(3px); }}
        .member-unit:hover .overlay-menu {{ opacity: 1; }}
        .click-guide {{ font-size: 9px; color: #000; background: #d4af37; padding: 4px 10px; border-radius: 12px; margin-bottom: 8px; font-weight: 900; }}
        .btn {{ width: 75px; padding: 5px 0; border-radius: 15px; font-size: 10px; color: #fff; border: 1px solid rgba(255,255,255,0.2); text-decoration: none; text-align: center; margin-bottom: 5px; transition: 0.3s; }}
        .btn:hover {{ background: rgba(255,255,255,0.1); border-color: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.3); }}
        .btn-live {{ background: rgba(220, 20, 60, 0.2); border-color: #dc143c; color: #ff4d4d; }}
        .btn-live:hover {{ background: #dc143c; color: #fff; box-shadow: 0 0 15px rgba(220, 20, 60, 0.6); }}
        
        .live-indicator {{ position: absolute; top: -5px; right: -5px; background: #dc143c; color: #fff; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 10px rgba(220, 20, 60, 0.5); z-index: 15; display: none; border: 1px solid rgba(255,255,255,0.3); }}
        .on-air .live-indicator {{ display: block; animation: pulseRed 2s infinite; }}
        .on-air .circle-frame {{ border: 2px solid #dc143c; box-shadow: 0 0 20px rgba(220, 20, 60, 0.4); }}
        @keyframes pulseRed {{ 0% {{ box-shadow: 0 0 0 0 rgba(220, 20, 60, 0.7); }} 70% {{ box-shadow: 0 0 0 10px rgba(220, 20, 60, 0); }} 100% {{ box-shadow: 0 0 0 0 rgba(220, 20, 60, 0); }} }}

        /* 미리보기 툴팁 */
        #preview {{ position: fixed; pointer-events: none; display: none; z-index: 9999; width: 320px; background: #0a0a0f; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.95); overflow: hidden; }}
        .p-thumb {{ width: 100%; aspect-ratio: 16/9; display: block; object-fit: cover; border-bottom: 1px solid #222; }}
        .p-info {{ padding: 15px; text-align: center; }}
        .p-title {{ font-size: 14px; color: #f5f5dc; margin-bottom: 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
        .p-live-badge {{ font-size: 12px; color: #ff4d4d; letter-spacing: 1px; }}

        /* 모달 및 기타 UI (색상 톤 다운 및 골드 포인트 추가) */
        .sales-section {{ background: rgba(255,255,255,0.015); border: 1px solid rgba(212, 175, 55, 0.15); border-radius: 15px; padding: 25px; margin-bottom: 30px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5); }}
        .sales-main-title {{ font-size: 18px; color: #d4af37; letter-spacing: 1px; border-left: 3px solid #d4af37; padding-left: 12px; }}
        .total-sum-badge {{ font-size: 13px; color: #000; background: linear-gradient(135deg, #d4af37, #aa801e); padding: 6px 16px; border-radius: 20px; }}
        
        .timeline-title {{ font-size: 18px; color: #d4af37; font-family: 'Cinzel', serif; letter-spacing: 2px; margin-bottom: 20px; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 10px; }}
        .timeline-item {{ background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid #333; }}
        .timeline-item:hover {{ border-color: rgba(212, 175, 55, 0.5); border-left: 4px solid #d4af37; background: rgba(212, 175, 55, 0.03); }}
        
        #sales-modal, #p-modal {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 6000; align-items: flex-start; justify-content: center; backdrop-filter: blur(10px); padding: 20px; padding-top: 15vh; }}
        .profile-modal-inner {{ background: #0c0c11; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 15px; box-shadow: 0 20px 80px rgba(0,0,0,1); padding: 35px; width: 100%; max-width: 550px; display: flex; flex-wrap: wrap; gap: 25px; position: relative; }}
        .profile-details-label {{ color: #aa801e; width: 65px; font-weight: 900; }}
        
        .search-input {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.3); }}
        .vod-card {{ background: #0a0a0f; border: 1px solid rgba(255,255,255,0.05); }}
        .vod-card:hover {{ border-color: #d4af37; box-shadow: 0 10px 25px rgba(212,175,55,0.15); }}
    </style>
</head>
<body>
    <header class="nav-header">
        <div class="logo-section" onclick="location.reload()">
            <img src="https://i.namu.wiki/i/TtDiKQg0FImiHkc53ADsBHPbhvb0CDKw7ojXJGPbsnL9OM-lwfAUWb7hi_HZH8BRGz68CkaIoJ706nPgEn0ddg.gif" height="40" style="filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
            <span class="update-timer" id="timer-text">NEXT: 5:00</span>
        </div>
        <nav class="tab-menu">
            <div class="tab-item active" onclick="switchTab(event, 'status')">LOUNGE</div>
            <div class="tab-item" onclick="switchTab(event, 'sales')">REVENUE</div>
            <div class="tab-item" onclick="switchTab(event, 'schedule')">SCHEDULE</div>
            <div class="tab-item" onclick="switchTab(event, 'radio')">MEDIA</div>
        </nav>
    </header>

    <div class="main-container">
        <!-- 1. 현황판 (고급 티어 뷰) -->
        <section id="status" class="tab-content active">{status_html}</section>

        <!-- 2. 매출표 (색상 톤 다운 수정 필요시 Chart.js 옵션에서 변경 가능) -->
        <section id="sales" class="tab-content">
            <div class="sales-section">
                <div class="sales-header-container">
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <span class="sales-main-title">YXL HISTORY (SS 1-{len(history_db)})</span>
                        <span class="sales-desc-text">※ 막대바 클릭시 상세 데이터 열람</span>
                    </div>
                    <div class="total-sum-badge">TOTAL: {all_season_sum:,}</div>
                </div>
                <div class="chart-scroll-wrapper"><div class="chart-container"><canvas id="historyChart"></canvas></div></div>
            </div>
        </section>

        <!-- 3. 일정표 -->
        <section id="schedule" class="tab-content">
            <div class="timeline-section">
                <div class="timeline-title">OFFICIAL TIMELINE</div>
                <div class="timeline-item"><div><div class="t-date" style="color:#d4af37;">05.07 (목) 17:00</div><div class="t-title">시즌 14 - 3회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status upcoming" style="background: linear-gradient(135deg, #d4af37, #8a6327); color:#000;">UPCOMING</div></div>
                <div class="timeline-item"><div><div class="t-date">05.11 (월) 17:00</div><div class="t-title">시즌 14 - 4회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status">STANDBY</div></div>
            </div>
        </section>

        <!-- 4. VOD -->
        <section id="radio" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap;">
                <span class="timeline-title" style="margin:0; border:none;">LATEST RECORD</span>
            </div>
            <div class="main-stage">
                <div class="player-wrapper"><iframe id="main-player-iframe" src="https://vod.sooplive.com/player/{main_vod['id']}" allowfullscreen></iframe></div>
            </div>
        </section>
    </div>
    
    <!-- 툴팁 및 모달 -->
    <div id="preview"><img src="" id="p-img" class="p-thumb"><div class="p-info"><div id="p-title" class="p-title"></div><div class="p-live-badge">🔴 ON AIR • <span id="p-viewers"></span> Vw.</div></div></div>
    
    <div id="p-modal" onclick="closeProfile()">
        <div class="profile-modal-inner" onclick="event.stopPropagation()">
            <div style="position:absolute; top:15px; right:20px; cursor:pointer; font-size:24px; color:#555; transition:0.3s;" onmouseover="this.style.color='#d4af37'" onmouseout="this.style.color='#555'" onclick="closeProfile()">×</div>
            <img src="" id="m-img" style="width:160px; height:160px; border-radius:50%; border:2px solid #d4af37; object-fit:cover; padding:5px;">
            <div style="flex:1; min-width: 200px; display:flex; flex-direction:column; justify-content:center;">
                <div id="m-name" style="font-size:26px; color:#fff; letter-spacing:1px; margin-bottom:5px;"></div>
                <div id="m-pos" style="font-size:13px; color:#aa801e; margin-bottom:15px; font-weight:800;"></div>
                <div id="m-details" style="display:flex; flex-direction:column; gap:4px;"></div>
            </div>
        </div>
    </div>

    <script>
        const members = {js_member_data};
        
        function switchTab(e, id) {{
            document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(id).classList.add('active');
        }}

        function openProfile(n) {{ 
            const m = members[n]; document.getElementById('m-img').src = m.img; document.getElementById('m-name').innerText = n; document.getElementById('m-pos').innerText = m.pos; 
            let html = '';
            if(m.age) html += `<div class="profile-details-row"><span class="profile-details-label">AGE</span><span class="profile-details-value">${{m.age}}</span></div>`;
            if(m.join_date) html += `<div class="profile-details-row"><span class="profile-details-label">JOINED</span><span class="profile-details-value">${{m.join_date}}</span></div>`;
            if(m.mbti) html += `<div class="profile-details-row"><span class="profile-details-label">MBTI</span><span class="profile-details-value">${{m.mbti}}</span></div>`;
            document.getElementById('m-details').innerHTML = html; document.getElementById('p-modal').style.display = 'flex'; 
        }}
        function closeProfile() {{ document.getElementById('p-modal').style.display = 'none'; }}

        // 호버 툴팁
        const units = document.querySelectorAll('.member-unit'); 
        const preview = document.getElementById('preview');
        units.forEach(unit => {{
            unit.addEventListener('mousemove', (e) => {{
                const thumb = unit.getAttribute('data-thumb');
                if (thumb && thumb !== "None" && thumb !== "") {{
                    document.getElementById('p-img').src = thumb; 
                    document.getElementById('p-title').textContent = unit.getAttribute('data-title'); 
                    document.getElementById('p-viewers').textContent = unit.getAttribute('data-viewers');
                    preview.style.display = 'block';
                    let x = e.clientX + 15; let y = e.clientY + 15;
                    if(x + 340 > window.innerWidth) x = window.innerWidth - 350;
                    preview.style.left = x + 'px'; preview.style.top = y + 'px';
                }}
            }});
            unit.addEventListener('mouseleave', () => preview.style.display = 'none');
        }});

        let time = 300;
        setInterval(() => {{ time--; const min = Math.floor(time/60); const sec = time%60; const el = document.getElementById('timer-text'); if(el) el.innerText = `NEXT: ${{min}}:${{sec<10?'0':''}}${{sec}}`; if(time<=0) location.reload(); }}, 1000);
    </script>
</body>
</html>
"""
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

if __name__ == "__main__":
    db_members = get_members_from_db()
    db_history = get_history_from_db()
    generate_full_system(db_members, db_history)