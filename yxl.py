import os
import requests
import json
import sqlite3
from datetime import datetime, timezone, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'yxl_management.db')

# ==========================================
# [DB 자동 세팅]
# ==========================================
def init_db_if_empty():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='Members'")
    if cur.fetchone()[0] == 0:
        print("⚠️ 텅 빈 DB를 감지했습니다. 초기 데이터를 자동으로 세팅합니다...")
        cur.execute('''CREATE TABLE IF NOT EXISTS Positions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, theme_color TEXT, rank_order INTEGER)''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, soop_id TEXT NOT NULL, position_id INTEGER, img_url TEXT, age TEXT, join_date TEXT, stats TEXT, mbti TEXT, skill TEXT, FOREIGN KEY (position_id) REFERENCES Positions (id))''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Seasons (id INTEGER PRIMARY KEY AUTOINCREMENT, season_num INTEGER NOT NULL, rank_revenue INTEGER DEFAULT 0)''')
        cur.execute('''CREATE TABLE IF NOT EXISTS Episodes (id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, title TEXT NOT NULL, revenue INTEGER NOT NULL, FOREIGN KEY (season_id) REFERENCES Seasons (id))''')

        positions = [('대표', '#FFD700', 1), ('비서실장', '#E5E4E2', 2), ('부장', '#C0C0C0', 3), ('차장', '#99A3A4', 4), ('과장', '#CD7F32', 5), ('대리', '#5DADE2', 6), ('주임', '#48C9B0', 7), ('사원', '#F7DC6F', 8), ('인턴장', '#F08080', 9), ('시급이', '#F5B041', 10), ('신입', '#EB984E', 11), ('웨이터', '#AF7AC5', 12)]
        cur.executemany('INSERT INTO Positions (name, theme_color, rank_order) VALUES (?, ?, ?)', positions)

        members = [
            ('염보성', 'yuambo', 1, 'https://storage2.ygosu.com/?code=S68dbfbfc3f44e8.21921692', '1990.03.29', '2024.10.01', '171.4cm / 76kg / B형', 'ENFJ', '스타크래프트'),
            ('리윤', 'sladk51', 3, 'https://storage2.ygosu.com/?code=S696b627eddf978.03910279', '1996년생', '2025.06.29', '164cm', 'ISTP', ''),
            ('후잉', 'jaeha010', 4, 'https://storage2.ygosu.com/?code=S688d2e96622764.18115475', '2001.01.19', '2024.10.12', '160cm / 47kg / AB형', 'ISTJ', '춤'),
            ('냥냥수주', 'star49', 5, 'https://storage2.ygosu.com/?code=S69777860bfb1b2.15315971', '1997년생', '2026.01.25', '', '', ''),
            ('류서하', 'smkim82372', 2, 'https://storage2.ygosu.com/?code=S69f0a926dedb50.11272017', '2000년생', '2026.01.25', '', '', ''),
            ('율무', 'offside629', 6, 'https://storage2.ygosu.com/?code=S6929cfcd99d997.32232313', '1997년생', '2025.10.19', '167cm', 'INTJ', ''),
            ('하랑짱', 'asy1218', 7, 'https://storage2.ygosu.com/?code=S696b61f365c0e3.11842146', '1991년생', '2025.10.12', '', '', ''),
            ('미로', 'fhwm0602', 8, 'https://storage2.ygosu.com/?code=S69f0a947083819.23416908', '1995년생', '2026.01.13', '168cm', 'INTJ', ''),
            ('유나연', 'jeewon1202', 9, 'https://storage2.ygosu.com/?code=S696641fe535711.46782639', '1999년생', '2025.12.11', '163cm', 'ISFP', ''),
            ('소다', 'zbxlzzz', 10, 'https://storage2.ygosu.com/?code=S696b623ea18219.09523333', '1993년생', '2024.10.29', '160cm', 'INFP', '필라테스'),
            ('김유정', 'tkek55', 10, 'https://storage2.ygosu.com/?code=S68ba9d207c63b1.00242878', '2000년생', '2025.09.04', '164cm', 'ENTJ', ''),
            ('백나현', 'wk3220', 11, 'https://storage2.ygosu.com/?code=S69ccd4724ffea8.45980531', '1996년생', '2026.03.28', '160cm', 'ISFP', ''),
            ('아름', 'ahrum0912', 11, 'https://storage2.ygosu.com/?code=S69f0a918af6ab2.84500064', '1997년생', '2026.03.29', '168cm', 'INFP', '골프'),
            ('서니', 'iluvpp', 11, 'https://storage2.ygosu.com/?code=S69f0a954b0c8f6.90064035', '1997년생', '2025.06.17', '160cm', 'ISTP', ''),
            ('너의멜로디', 'meldoy777', 11, 'https://storage2.ygosu.com/?code=S69cb6c7203b578.77318633', '1999년생', '2026.03.31', '163cm', 'ESFP', ''),
            ('꺼니', 'callgg', 12, 'https://storage2.ygosu.com/?code=S69f0a951064842.70871652', '1993년생', '2025.10.02', '', '', ''),
            ('김푸', 'kimpooh0707', 12, 'https://storage2.ygosu.com/?code=S69f0a94dc072d2.06945517', '1993년생', '2025.10.02', '', '', '')
        ]
        cur.executemany('INSERT INTO Members (name, soop_id, position_id, img_url, age, join_date, stats, mbti, skill) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', members)

        history = {
            1: {"rank": 5374481, "ep": [("1회차 전후반전", 2426065), ("2회차 팀전", 2732426), ("3회차 직급프리데이", 3890922), ("4회차 전후반 지분전쟁", 3833288), ("5회차 3천만원 기여도 펌핑데이", 3054893)]},
            2: {"rank": 6610938, "ep": [("1회차 상벌금데이", 6078903), ("2회차 명품데이", 3390108), ("3회차 직급프리데이", 4124926), ("4회차 팀전", 2313129), ("5회차 펌핑룰렛 및 퇴근전쟁", 1969188)]},
            3: {"rank": 13445194, "ep": [("1회차 블라인드 상금데이", 2683770), ("2회차 데스매치 및 퇴근전쟁", 2011356), ("3회차 직급프리데이", 1852181), ("4회차 전후반 지분전쟁", 1703576), ("5회차 일급데이 및 벌칙", 1863867)]},
            4: {"rank": 2561153, "ep": [("1회차 그녀를 이겨라 및 퇴근전쟁", 2035685), ("2회차 퐁당퐁당데이", 1702385), ("3회차 장들의 전쟁", 2676513), ("4회차 직급프리데이", 1216858), ("5회차 기여도 펌핑데이 및 퇴근전쟁", 1939123)]},
            5: {"rank": 4252794, "ep": [("1회차 대표 VS 부장 팀전", 3400157), ("2회차 퐁당 & 가챠 상금데이", 2996095), ("3회차 조기퇴근데이", 2300171), ("4회차 직급프리데이", 2122733), ("5회차 기여도펌핑룰렛데이", 370113)]},
            6: {"rank": 5953195, "ep": [("1회차 퐁당 & 비키니 벌칙데이", 2822840), ("2회차 난사데이 및 퇴근전쟁", 2076273), ("3회차 직급 프리데이", 2642197), ("4회차 팀전", 2948979), ("5회차 한방룰렛골드데이", 2043429)]},
            7: {"rank": 5746700, "ep": [("1회차 퐁당퐁당 상벌금데이", 3076958), ("2회차 대표님을 이겨라 및 퇴근전쟁", 2961402), ("3회차 직급 프리데이", 3738078), ("4회차 기여도 펌핑데이", 3390310), ("5회차 조기퇴근데이", 2023172)]},
            8: {"rank": 5769642, "ep": [("1회차 퐁당퐁당 상벌금데이", 4291255), ("2회차 주차방지데이", 2356810), ("3회차 대표 vs 이사 팀전", 3932965), ("4회차 조기퇴근데이", 1766989), ("5회차 기여도펌핑데이", 1815026)]},
            9: {"rank": 4716222, "ep": [("1회차 퐁당퐁당데이", 2823519), ("2회차 팀데스매치", 2476563), ("3회차 직급 프리데이", 3035332), ("4회차 추석떡값데이", 2003513), ("5회차 YB를 이겨라", 4514325)]},
            10: {"rank": 5035289, "ep": [("1회차 와장창데이", 2470625), ("2회차 일급 프리데이", 2008740), ("3회차 염대표를이겨라", 2359007), ("4회차 직급프리데이", 2114014), ("5회차 기여도펌핑데이", 2430578)]},
            11: {"rank": 4222022, "ep": [("1회차 지분&퐁당데이", 2397972), ("2회차 1대1 데스매치", 1364489), ("3회차 조기퇴근데이", 1507997), ("4회차 용병데이", 4078678), ("5회차 룰렛상금 & 기여도펌핑데이", 1580993)]},
            12: {"rank": 3026835, "ep": [("1회차 지분 & 퐁당데이", 3038172), ("2회차 상금픽스 직급프리데이", 2960260), ("3회차 부장팀 vs 차장팀 팀데스매치", 1860656), ("4회차 주차방지 & 난사데이", 1356111), ("5회차 조기퇴근데이", 1465653)]},
            13: {"rank": 3342545, "ep": [("1회차 퐁당 & 극락데이", 3046622), ("2회차 염대표를 이겨라 & 상금갸차데이", 1426315), ("3회차 용병데이", 5941453), ("4회차 조기퇴근데이", 1049820), ("5회차 1대1 데스매치", 1762153)]}
        }
        for s_num, data in history.items():
            cur.execute("INSERT INTO Seasons (season_num, rank_revenue) VALUES (?, ?)", (s_num, data["rank"]))
            s_id = cur.lastrowid
            ep_data = [(s_id, title, rev) for title, rev in data["ep"]]
            cur.executemany("INSERT INTO Episodes (season_id, title, revenue) VALUES (?, ?, ?)", ep_data)
        conn.commit()
    conn.close()

def get_members_from_db():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('''SELECT m.name, m.soop_id, p.name, m.img_url, m.age, m.join_date, m.stats, m.mbti, m.skill FROM Members m JOIN Positions p ON m.position_id = p.id ORDER BY p.rank_order, m.id''')
    rows = cur.fetchall()
    conn.close()
    
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    
    members = []
    for r in rows:
        join_date_str = r[5]
        d_day_str = ""
        if join_date_str:
            try:
                j_date = datetime.strptime(join_date_str.strip(), "%Y.%m.%d").replace(tzinfo=kst)
                d_day = (now - j_date).days
                d_day_str = f"D+{d_day}"
            except: pass
        members.append({"name": r[0], "id": r[1], "pos": r[2], "img": r[3], "age": r[4], "join_date": r[5], "stats": r[6], "mbti": r[7], "skill": r[8], "d_day": d_day_str})
    return members

def get_history_from_db():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('SELECT id, season_num, rank_revenue FROM Seasons ORDER BY season_num')
    seasons = cur.fetchall()
    history_db = {}
    for sid, snum, srev in seasons:
        cur.execute('SELECT title, revenue FROM Episodes WHERE season_id=? ORDER BY id', (sid,))
        episodes = cur.fetchall()
        history_db[f"시즌{snum}"] = {"직급전": srev, "contents": [[ep[0], ep[1]] for ep in episodes]}
    conn.close()
    return history_db

def get_yxl_status(name, user_id, position, profile_url):
    url = f"https://api-channel.sooplive.com/v1.1/channel/{user_id}/home/section/broad"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers, timeout=5).json()
        if res and "broadNo" in res:
            return {"is_live": True, "name": name, "id": user_id, "pos": position, "theme": "#d4af37", "profile": profile_url, "title": res.get("broadTitle", "").replace('"', '&quot;'), "viewers": format(res.get("currentSumViewer", 0), ','), "thumb": f"https://liveimg.sooplive.com/h/{res['broadNo']}.webp", "live_link": f"https://play.sooplive.com/{user_id}/{res['broadNo']}", "home_link": f"https://www.sooplive.com/station/{user_id}"}
    except: pass
    return {"is_live": False, "name": name, "id": user_id, "pos": position, "theme": "#eee", "profile": profile_url, "title": "OFFLINE", "viewers": "0", "thumb": "", "live_link": "#", "home_link": f"https://www.sooplive.com/station/{user_id}"}

def fetch_vod_data_by_api(vid):
    api_url = "https://api.m.sooplive.co.kr/station/video/a/view"
    headers = {"User-Agent": "Mozilla/5.0"}
    data = {"nTitleNo": vid}
    try:
        res = requests.post(api_url, headers=headers, data=data, timeout=5).json()
        if res.get("result") == 1 and "data" in res:
            v_data = res["data"]
            thumb = v_data.get("thumb", "")
            if thumb and thumb.startswith("//"): thumb = "https:" + thumb
            return {"id": vid, "title": v_data.get("title", f"VOD").replace('"', '&quot;'), "date": str(v_data.get("broad_start", "2026-00-00"))[:10].replace("-", "."), "views": int(v_data.get("view_cnt", 0)), "thumb": thumb}
    except: pass
    return {"id": vid, "title": "정보 없음", "date": "-", "views": 0, "thumb": ""}

def generate_full_system(members, history_db):
    print("\n[1/3] 생방송 상태 업데이트 중...")
    data_map = {m['name']: get_yxl_status(m['name'], m['id'], m['pos'], m['img']) for m in members}
    js_member_data = json.dumps({m['name']: m for m in members}, ensure_ascii=False)
    
    tier_mapping = {"대표": "EXECUTIVE", "부장": "LEAD", "차장": "LEAD", "과장": "LEAD", "비서실장": "SENIOR", "대리": "SENIOR", "주임": "SENIOR", "사원": "JUNIOR", "인턴장": "JUNIOR", "시급이": "JUNIOR", "신입": "ROOKIE", "웨이터": "WAITER"}
    tiers_order = ["EXECUTIVE", "LEAD", "SENIOR", "JUNIOR", "ROOKIE", "WAITER"]
    tier_groups = {tier: [] for tier in tiers_order}
    for m in members: tier_groups[tier_mapping.get(m['pos'], "JUNIOR")].append(m)

    status_html = ""
    for tier_name in tiers_order:
        tier_members = tier_groups[tier_name]
        if not tier_members: continue
        status_html += f'<div class="tier-section"><div class="tier-header"><div class="tier-line"></div><div class="tier-title">{tier_name}</div><div class="tier-line"></div></div><div class="row">'
        for m in tier_members:
            info = data_map[m['name']]
            live_class = "on-air" if info['is_live'] else ""
            status_html += f"""
            <div class="member-unit {live_class}" data-thumb="{info['thumb']}" data-title="{info['title']}" data-viewers="{info['viewers']}">
                <div class="circle-frame" onclick="openProfile('{m['name']}')">
                    <img src="{info['profile']}" class="profile-img">
                    <div class="embedded-info"><div class="pos-tag" style="color: {info['theme']};">{info['pos']}</div><div class="name-label">{info['name']}</div></div>
                    <div class="overlay-menu" onclick="event.stopPropagation()"><div class="click-guide" onclick="openProfile('{m['name']}')">PROFILE</div><div class="btn-group"><a href="{info["home_link"]}" target="_blank" class="btn btn-home">방송국</a>{f'<a href="{info["live_link"]}" target="_blank" class="btn btn-live">LIVE</a>' if info['is_live'] else ''}</div></div>
                </div>
                <div class="d-day-outside">{m['d_day']}</div>
            </div>"""
        status_html += '</div></div>'

    print("[2/3] 매출 데이터 로드 중...")
    js_labels = [f"시즌{i}" for i in range(1, len(history_db) + 1)]
    js_rank_rev = [history_db.get(f"시즌{i}", {"직급전":0})["직급전"] for i in range(1, len(history_db) + 1)]
    js_norm_rev = [sum(item[1] for item in history_db.get(f"시즌{i}", {"contents":[]})["contents"]) for i in range(1, len(history_db) + 1)]
    all_season_sum = sum(js_rank_rev) + sum(js_norm_rev)
    current_season_sum = sum([4343316, 2164822, 3135452])

    print("[3/3] VOD 영상 가져오는 중 (약간의 시간이 소요됩니다)...")
    vod_ids = ["139389129", "140474073", "145078781", "145395293", "145430667", "145686859", "145694247", "146665451", "149341401", "149372371", "149482895", "149543791", "151963511", "152673671", "152932371", "153270385", "153906161", "155022377", "156072307", "156233659", "156443147", "156897587", "157766473", "159784167", "159835159", "160179551", "160229793", "163314531", "163507573", "165090649", "165095477", "166797677", "167711523", "168507233", "169165861", "171334577", "171346633", "171517903", "171625221", "181193639", "181202165", "181212107", "181319655", "182185345", "182561159", "185332075", "186322409", "188589109", "193831035"]
    vod_ids.reverse() 
    vod_list = [fetch_vod_data_by_api(vid) for vid in vod_ids]
    valid_vods = [v for v in vod_list if v["views"] > 0]
    top_5_vods = sorted(valid_vods, key=lambda x: x['views'], reverse=True)[:5]
    main_vod = valid_vods[0] if valid_vods else {"id":"", "title":"", "date":"", "views":0, "thumb":""}
    js_vod_data = json.dumps(vod_list, ensure_ascii=False)

    full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <title>YXL VIP LOUNGE</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <style>
        body {{ background: #08080c; color: #fff; font-family: 'Pretendard', sans-serif; margin: 0; overflow-x: hidden; box-sizing: border-box; }}
        h1, h2, h3, h4, p, span, div {{ font-weight: 900; box-sizing: border-box; }}
        
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

        .tier-section {{ margin-bottom: 50px; }}
        .tier-header {{ display: flex; align-items: center; justify-content: center; margin-bottom: 30px; gap: 20px; }}
        .tier-title {{ font-family: 'Cinzel', serif; font-size: 22px; color: #f5f5dc; letter-spacing: 4px; text-shadow: 0 2px 15px rgba(212, 175, 55, 0.4); }}
        .tier-line {{ height: 1px; flex: 1; max-width: 250px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent); }}

        .row {{ display: flex; flex-wrap: wrap; gap: 25px; justify-content: center; align-items: flex-start; }}
        .member-unit {{ position: relative; width: 130px; transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; flex-direction: column; align-items: center; }}
        .member-unit:hover {{ transform: translateY(-8px) scale(1.05); z-index: 50; }}
        
        .circle-frame {{ position: relative; width: 120px; height: 120px; border-radius: 50%; padding: 3px; background: #111; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.8); margin: 0 auto; transition: 0.3s; }}
        .profile-img {{ width: 100%; height: 100%; border-radius: 50%; object-fit: cover; filter: contrast(1.1) saturate(1.1); transition: 0.5s; }}
        .embedded-info {{ position: absolute; bottom: 0; width: 100%; height: 50%; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 12px; z-index: 3; }}
        .pos-tag {{ font-size: 10px; margin-bottom: 3px; font-weight: 800; }}
        .name-label {{ font-size: 14px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.9); }}
        
        .d-day-outside {{ margin-top: 10px; font-size: 11px; color: #d4af37; font-weight: 900; letter-spacing: 0.5px; opacity: 0.8; }}
        
        .overlay-menu {{ position: absolute; inset: 0; background: rgba(8,8,12,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: 0.3s; z-index: 10; border-radius: 50%; backdrop-filter: blur(3px); }}
        .member-unit:hover .overlay-menu {{ opacity: 1; }}
        .click-guide {{ font-size: 9px; color: #000; background: #d4af37; padding: 4px 10px; border-radius: 12px; margin-bottom: 8px; font-weight: 900; letter-spacing: 1px; }}
        .btn {{ width: 75px; padding: 5px 0; border-radius: 15px; font-size: 10px; color: #fff; border: 1px solid rgba(255,255,255,0.2); text-decoration: none; text-align: center; margin-bottom: 5px; transition: 0.3s; }}
        .btn-live {{ background: rgba(220, 20, 60, 0.2); border-color: #dc143c; color: #ff4d4d; }}
        
        .live-indicator {{ position: absolute; top: -5px; right: -5px; background: #dc143c; color: #fff; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 10px rgba(220, 20, 60, 0.5); z-index: 15; display: none; border: 1px solid rgba(255,255,255,0.3); }}
        .on-air .live-indicator {{ display: block; animation: pulseRed 2s infinite; }}
        @keyframes pulseRed {{ 0% {{ box-shadow: 0 0 0 0 rgba(220, 20, 60, 0.7); }} 70% {{ box-shadow: 0 0 0 10px rgba(220, 20, 60, 0); }} 100% {{ box-shadow: 0 0 0 0 rgba(220, 20, 60, 0); }} }}

        .sales-section {{ background: rgba(255,255,255,0.015); border: 1px solid rgba(212, 175, 55, 0.15); border-radius: 15px; padding: 25px; margin-bottom: 30px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5); }}
        .sales-header-container {{ display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-left: 3px solid #d4af37; padding-left: 12px; flex-wrap: wrap; gap: 10px; }}
        .sales-main-title {{ font-size: 18px; color: #d4af37; letter-spacing: 1px; }}
        .total-sum-badge {{ font-size: 13px; color: #000; background: linear-gradient(135deg, #d4af37, #aa801e); padding: 8px 18px; border-radius: 8px; font-weight: 900; }}
        
        .chart-scroll-wrapper {{ overflow-x: auto; width: 100%; padding-bottom: 12px; }}
        .chart-scroll-wrapper::-webkit-scrollbar {{ height: 8px; }}
        .chart-scroll-wrapper::-webkit-scrollbar-thumb {{ background: linear-gradient(90deg, #8a6327, #d4af37, #8a6327); border-radius: 10px; }}
        .chart-container {{ min-width: 1000px; height: 350px; }}
        .chart-container-small {{ min-width: 400px; height: 250px; }}

        /* 💡 럭셔리 주간 달력 디자인 */
        .calendar-nav-container {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; gap: 15px; }}
        .nav-btn {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.3); color: #d4af37; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 18px; transition: 0.3s; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }}
        .nav-btn:hover {{ background: #d4af37; color: #000; transform: scale(1.1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }}
        
        .weekly-calendar-row {{ flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }}
        .day-card {{ background: rgba(255,255,255,0.02); border: 1px solid rgba(212,175,55,0.15); border-radius: 12px; padding: 15px 5px; text-align: center; cursor: pointer; transition: 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); min-width: 0; position: relative; overflow: hidden; }}
        .day-card:hover {{ background: rgba(212,175,55,0.05); transform: translateY(-5px); border-color: rgba(212,175,55,0.5); }}
        .day-card.selected {{ background: rgba(212,175,55,0.12); border-color: #d4af37; box-shadow: 0 0 20px rgba(212,175,55,0.2), inset 0 0 10px rgba(212,175,55,0.1); transform: scale(1.03); }}
        .day-card.selected::before {{ content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: #d4af37; }}
        
        .dc-day {{ font-size: 11px; color: #aaa; margin-bottom: 6px; font-weight: 900; letter-spacing: 1px; }}
        .dc-date {{ font-size: 18px; color: #fff; font-family: 'Cinzel', serif; font-weight: 900; margin-bottom: 12px; }}
        .dc-event {{ background: linear-gradient(135deg, #d4af37, #8a6327); color: #000; font-size: 10px; padding: 4px 2px; border-radius: 5px; font-weight: 900; width: 95%; margin: 0 auto; line-height: 1.2; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }}
        
        /* 💡 프로필 모달 & 직급 폰트 부드럽게 */
        #p-modal {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 6000; align-items: center; justify-content: center; backdrop-filter: blur(10px); padding: 20px; }}
        .profile-container {{ background: linear-gradient(145deg, #0f0f15, #08080c); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 20px; box-shadow: 0 20px 80px rgba(0,0,0,1); padding: 40px; width: 100%; max-width: 600px; display: flex; gap: 40px; position: relative; align-items: center; flex-wrap: wrap; justify-content: center; }}
        .profile-left {{ display: flex; flex-direction: column; align-items: center; }}
        .profile-left img {{ width: 150px; height: 150px; border-radius: 50%; border: 3px solid #d4af37; object-fit: cover; margin-bottom: 15px; }}
        .profile-name {{ font-size: 26px; color: #fff; margin-bottom: 10px; }}
        .profile-tier {{ font-family: 'Pretendard', sans-serif; font-size: 13px; color: #d4af37; background: rgba(212,175,55,0.1); padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(212,175,55,0.4); font-weight: 700; }}
        
        .profile-right {{ flex: 1; min-width: 250px; display: grid; grid-template-columns: 1fr; gap: 12px; border-left: 1px solid rgba(212,175,55,0.15); padding-left: 30px; }}
        .stat-box {{ background: rgba(255,255,255,0.02); padding: 10px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); }}
        .stat-label {{ font-size: 11px; color: #aa801e; font-weight: 900; }}
        .stat-value {{ font-size: 14px; color: #fff; }}
        .close-btn {{ position: absolute; top: 20px; right: 25px; cursor: pointer; font-size: 28px; color: #555; }}
        
        .timeline-title {{ font-size: 18px; color: #d4af37; font-family: 'Cinzel', serif; letter-spacing: 2px; margin-bottom: 20px; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 10px; }}
        .timeline-item {{ background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.05); border-left: 3px solid #333; padding: 15px 20px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; border-radius: 10px; transition: 0.3s; cursor:pointer; }}
        .timeline-item:hover {{ border-color: rgba(212, 175, 55, 0.5); border-left: 4px solid #d4af37; background: rgba(212, 175, 55, 0.03); transform: translateX(10px); }}
        .t-date {{ font-size: 13px; color: #d4af37; margin-bottom: 5px; }}
        .t-title {{ font-size: 18px; color: #fff; margin-bottom: 5px; }}
        .t-desc {{ font-size: 13px; color: #aaa; }}
        .t-status {{ padding: 6px 14px; border-radius: 15px; font-size: 12px; background: rgba(255,255,255,0.1); color: #fff; }}
        .t-status.upcoming {{ background: linear-gradient(135deg, #d4af37, #8a6327); color: #000; }}

        /* 💡 VOD 스타일 */
        .search-wrapper {{ position: relative; width: 100%; max-width: 300px; margin-top: 10px; }}
        .search-input {{ width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.3); padding: 10px 15px; border-radius: 20px; color: #fff; outline: none; font-size: 14px; }}
        .main-stage {{ background: rgba(8, 8, 12, 0.6); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 15px; padding: 20px; display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px; }}
        .player-wrapper {{ width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 10px; overflow: hidden; border: 1px solid #333; }}
        .player-wrapper iframe {{ width: 100%; height: 100%; border: none; }}
        .player-info {{ width: 100%; }}
        .top-badge {{ background: linear-gradient(135deg, #d4af37, #aa801e); padding: 4px 10px; border-radius: 4px; font-size: 11px; margin-bottom: 10px; display: inline-block; color: #000; font-weight: 900; }}
        
        .vod-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; margin-top: 15px; margin-bottom: 40px; }}
        .vod-card {{ background: #0a0a0f; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.3s; overflow: hidden; display:flex; flex-direction:column; }}
        .vod-card:hover {{ transform: translateY(-5px); border-color: #d4af37; box-shadow: 0 10px 25px rgba(212,175,55,0.15); }}
        .vod-thumb {{ width: 100%; aspect-ratio: 16/9; background: #111; overflow: hidden; }}
        .vod-thumb img {{ width: 100%; height: 100%; object-fit: cover; transition: 0.4s; }}
        .vod-card:hover .vod-thumb img {{ opacity: 1; transform: scale(1.05); }}
        .vod-text {{ padding: 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; }}
        .vod-text h4 {{ margin: 0 0 6px 0; font-size: 13px; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }}
        .vod-text p {{ margin: 0; font-size: 11px; color: #aaa; }}
    </style>
</head>
<body>
    <header class="nav-header">
        <div class="logo-section" onclick="location.reload()"><img src="./logo.gif" height="40" decoding="async" fetchpriority="high" onerror="this.src='https://i.namu.wiki/i/TtDiKQg0FImiHkc53ADsBHPbhvb0CDKw7ojXJGPbsnL9OM-lwfAUWb7hi_HZH8BRGz68CkaIoJ706nPgEn0ddg.gif'"><span class="update-timer" id="timer-text">NEXT: 5:00</span></div>
        <nav class="tab-menu">
            <div class="tab-item active" onclick="switchTab(event, 'status')">LOUNGE</div>
            <div class="tab-item" onclick="switchTab(event, 'sales')">REVENUE</div>
            <div class="tab-item" onclick="switchTab(event, 'schedule')">SCHEDULE</div>
            <div class="tab-item" onclick="switchTab(event, 'radio')">MEDIA</div>
        </nav>
    </header>

    <div class="main-container">
        <!-- 1. 현황판 -->
        <section id="status" class="tab-content active">{status_html}</section>

        <!-- 2. 매출표 -->
        <section id="sales" class="tab-content">
            <div class="sales-section">
                <div class="sales-header-container">
                    <span class="sales-main-title">YXL REVENUE HISTORY</span>
                    <div class="total-sum-badge">TOTAL: {format(all_season_sum, ',')}개</div>
                </div>
                <div class="chart-scroll-wrapper"><div class="chart-container"><canvas id="historyChart"></canvas></div></div>
            </div>
            <div class="sales-section">
                <div class="sales-header-container">
                    <span class="sales-main-title">YXL 시즌 14</span>
                    <div class="total-sum-badge">시즌 합산: {format(current_season_sum, ',')}개</div>
                </div>
                <div class="chart-scroll-wrapper"><div class="chart-container-small"><canvas id="currentChart"></canvas></div></div>
            </div>
        </section>

        <!-- 3. 💡 주간 달력 & 타임라인 -->
        <section id="schedule" class="tab-content">
            <div class="timeline-section" style="margin-bottom: 40px;">
                <div class="timeline-title">WEEKLY SCHEDULE</div>
                <div class="calendar-nav-container">
                    <button class="nav-btn" onclick="changeWeek(-7)">⟨</button>
                    <div class="weekly-calendar-row" id="calendarRow"></div>
                    <button class="nav-btn" onclick="changeWeek(7)">⟩</button>
                </div>
            </div>
            <div class="timeline-section">
                <div class="timeline-title">OFFICIAL TIMELINE</div>
                <div class="timeline-item"><div><div class="t-date" style="color:#d4af37;">05.07 (목) 17:00</div><div class="t-title">시즌 14 - 3회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status upcoming">UPCOMING</div></div>
                <div class="timeline-item"><div><div class="t-date">05.11 (월) 17:00</div><div class="t-title">시즌 14 - 4회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status">STANDBY</div></div>
                <div class="timeline-item"><div><div class="t-date">05.14 (목) 17:00</div><div class="t-title">시즌 14 - 5회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status">STANDBY</div></div>
            </div>
        </section>

        <!-- 4. 💡 MEDIA 탭 (VOD 영상) 복구 -->
        <section id="radio" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap;">
                <span class="timeline-title" style="margin:0; border:none;">LATEST RECORD</span>
                <div class="search-wrapper">
                    <input type="text" id="vodSearch" class="search-input" placeholder="영상 검색..." onkeyup="searchVOD()">
                </div>
            </div>
            
            <div class="main-stage">
                <div class="player-wrapper"><iframe id="main-player-iframe" src="https://vod.sooplive.com/player/{main_vod['id']}" allowfullscreen></iframe></div>
                <div class="player-info">
                    <div class="top-badge">최신 VOD</div>
                    <h1 id="main-vod-title" style="font-size:18px; color:#fff; margin:0 0 10px 0;">{main_vod['title']}</h1>
                    <p id="main-vod-date" style="font-size:12px; color:#aaa; margin:0 0 5px 0;">방송일: {main_vod['date']}</p>
                    <p id="main-vod-views" style="font-size:13px; color:#d4af37; margin:0;">조회수: {format(main_vod['views'], ',')}회</p>
                </div>
            </div>

            <div class="timeline-title" style="margin-bottom:0; font-size: 16px;">POPULAR TOP 5</div>
            <div class="vod-grid">
                {"".join([f'''
                <div class="vod-card" onclick="changeMainPlayer('{v['id']}', '{v['title']}', '{v['date']}', '{v['views']}')">
                    <div class="vod-thumb"><img src="{v['thumb']}" onerror="this.src='https://via.placeholder.com/320x180/1a1a2e/8a2be2?text=YXL'"></div>
                    <div class="vod-text">
                        <div><div style="background:#d4af37; color:#000; font-size:9px; padding:2px 5px; border-radius:3px; display:inline-block; margin-bottom:4px; font-weight:900;">HOT</div><h4>{v['title']}</h4></div>
                        <p>{v['date']} • {format(v['views'], ',')}회</p>
                    </div>
                </div>''' for v in top_5_vods])}
            </div>

            <div class="timeline-title" id="list-title" style="margin-bottom:0; font-size: 16px;">ALL VIDEOS</div>
            <div class="vod-grid" id="vodListContainer"></div>
        </section>
    </div>

    <!-- 프로필 모달 -->
    <div id="p-modal" onclick="closeProfile()">
        <div class="profile-container" onclick="event.stopPropagation()">
            <div class="close-btn" onclick="closeProfile()">×</div>
            <div class="profile-left"><img src="" id="m-img"><div id="m-name" class="profile-name"></div><div id="m-pos" class="profile-tier"></div></div>
            <div class="profile-right" id="m-details"></div>
        </div>
    </div>

    <!-- 매출 상세 모달 -->
    <div id="sales-modal" onclick="closeSalesModal()">
        <div class="sales-modal-inner" onclick="event.stopPropagation()">
            <div id="s-title" style="font-size:22px; font-family:'Cinzel', serif; color:#d4af37; margin-bottom:20px; border-bottom:1px solid rgba(212,175,55,0.3); padding-bottom:10px; text-align:center; letter-spacing:2px;"></div>
            <ul id="s-list" style="list-style:none; padding:0; margin:0;"></ul>
            <div style="margin-top:25px; text-align:center; color:#777; font-size:12px; cursor:pointer; letter-spacing:1px;" onclick="closeSalesModal()">[ 닫기 ]</div>
        </div>
    </div>

    <script>
        const members = {js_member_data};
        const allVODs = {js_vod_data};
        const events = {{
            "2026.05.07": "YXL 3회차",
            "2026.05.11": "YXL 4회차",
            "2026.05.14": "YXL 5회차"
        }};
        
        let currentStartDate = new Date(); 
        const day = currentStartDate.getDay() || 7;
        currentStartDate.setDate(currentStartDate.getDate() - day + 1);

        function switchTab(e, id) {{
            document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(id).classList.add('active');
            if(id === 'sales') setTimeout(renderCharts, 50);
            if(id === 'schedule') renderCalendar();
        }}

        function changeWeek(days) {{
            currentStartDate.setDate(currentStartDate.getDate() + days);
            renderCalendar();
        }}

        function renderCalendar() {{
            const row = document.getElementById('calendarRow');
            row.innerHTML = '';
            const daysArr = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            const todayStr = new Date().toLocaleDateString('ko-KR', {{year:'numeric', month:'2-digit', day:'2-digit'}}).replace(/ /g,'').replace(/\\./g,'.').slice(0,-1);

            for (let i = 0; i < 7; i++) {{
                const d = new Date(currentStartDate);
                d.setDate(d.getDate() + i);
                const dStr = d.toLocaleDateString('ko-KR', {{year:'numeric', month:'2-digit', day:'2-digit'}}).replace(/ /g,'').replace(/\\./g,'.').slice(0,-1);
                const displayDate = (d.getMonth()+1) + '.' + (d.getDate() < 10 ? '0'+d.getDate() : d.getDate());
                const event = events[dStr] || null;
                const isToday = dStr === todayStr;

                const card = document.createElement('div');
                card.className = `day-card ${{isToday ? 'selected' : ''}}`;
                card.onclick = () => {{
                    document.querySelectorAll('.day-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                }};
                card.innerHTML = `
                    <div class="dc-day">${{daysArr[i]}}</div>
                    <div class="dc-date">${{displayDate}}</div>
                    ${{event ? `<div class="dc-event">${{event}}</div>` : '<div style="height:20px;"></div>'}}
                `;
                row.appendChild(card);
            }}
        }}

        let hChart = null, cChart = null;
        function renderCharts() {{
            Chart.register(ChartDataLabels);
            if(hChart) hChart.destroy();
            if(cChart) cChart.destroy();
            
            const commonOptions = {{ responsive: true, maintainAspectRatio: false, layout: {{ padding: {{ top: 40 }} }}, plugins: {{ legend: {{ display: false }}, datalabels: {{ anchor: 'end', align: 'top', color: '#d4af37', font: {{ weight: '900', size: 12 }}, formatter: (v, ctx) => {{ if(ctx.datasetIndex === 1 || ctx.chart.data.datasets.length === 1) {{ let total = ctx.chart.data.datasets[0].data[ctx.dataIndex] + (ctx.datasetIndex === 1 ? v : 0); return Math.floor(total / 10000).toLocaleString() + '만'; }} return null; }} }}, tooltip: {{ callbacks: {{ label: (ctx) => `${{ctx.dataset.label}}: ${{ctx.raw.toLocaleString()}}개` }} }} }}, scales: {{ y: {{ stacked: true, display: false }}, x: {{ stacked: true, ticks: {{ color: '#aaa', font: {{ weight: '900', size: 12 }} }}, grid: {{ color: 'rgba(212,175,55,0.1)' }} }} }} }};

            hChart = new Chart(document.getElementById('historyChart'), {{ 
                type: 'bar', 
                data: {{ labels: {json.dumps(js_labels)}, datasets: [
                    {{ label: '직급전', data: {json.dumps(js_rank_rev)}, backgroundColor: '#d4af37' }},
                    {{ label: '일반회차', data: {json.dumps(js_norm_rev)}, backgroundColor: '#aa801e' }}
                ] }},
                options: {{ ...commonOptions, onClick: (e, activeEls) => activeEls.length > 0 && openSalesModal(hChart.data.labels[activeEls[0].index]) }} 
            }});

            cChart = new Chart(document.getElementById('currentChart'), {{ 
                type: 'bar', 
                data: {{ labels: ['직급전', '1회차', '2회차'], datasets: [{{ label: '매출', data: [4343316, 2164822, 3135452], backgroundColor: '#d4af37' }}] }}, 
                options: commonOptions 
            }});
        }}

        function openSalesModal(season) {{
            const data = {historyDb}[season]; if(!data) return;
            document.getElementById('s-title').innerText = season + " 세부 리포트";
            let html = `<li class="sales-list-item"><span style="color:#d4af37; font-weight:800;">직급전</span> <b style="color:#f5f5dc;">${{data.직급전.toLocaleString()}} 개</b></li>`;
            data.contents.forEach(item => html += `<li class="sales-list-item"><span style="color:#aaa;">${{item[0]}}</span> <b style="color:#fff;">${{item[1].toLocaleString()}} 개</b></li>`);
            document.getElementById('s-list').innerHTML = html; document.getElementById('sales-modal').style.display = 'flex';
        }}
        function closeSalesModal() {{ document.getElementById('sales-modal').style.display = 'none'; }}

        function openProfile(n) {{
            const m = members[n];
            document.getElementById('m-img').src = m.img;
            document.getElementById('m-name').innerText = n;
            document.getElementById('m-pos').innerText = m.pos;
            document.getElementById('m-details').innerHTML = `
                <div class="stat-box"><span class="stat-label">나이</span><span class="stat-value">${{m.age}}</span></div>
                <div class="stat-box"><span class="stat-label">입사일</span><span class="stat-value">${{m.join_date}}</span></div>
                <div class="stat-box"><span class="stat-label">MBTI</span><span class="stat-value">${{m.mbti}}</span></div>
                <div class="stat-box"><span class="stat-label">신체정보</span><span class="stat-value">${{m.stats}}</span></div>
                <div class="stat-box"><span class="stat-label">특기</span><span class="stat-value">${{m.skill}}</span></div>`;
            document.getElementById('p-modal').style.display = 'flex';
        }}
        function closeProfile() {{ document.getElementById('p-modal').style.display = 'none'; }}

        function changeMainPlayer(id, title, date, views) {{
            document.getElementById('main-player-iframe').src = `https://vod.sooplive.com/player/${{id}}`;
            document.getElementById('main-vod-title').innerText = title;
            document.getElementById('main-vod-date').innerText = `방송일: ${{date}}`;
            document.getElementById('main-vod-views').innerText = `조회수: ${{Number(views).toLocaleString()}}회`;
            window.scrollTo({{top: 0, behavior: 'smooth'}});
        }}

        function renderVODList(data) {{
            document.getElementById('vodListContainer').innerHTML = data.map(v => `
                <div class="vod-card" onclick="changeMainPlayer('${{v.id}}', '${{v.title.replace(/'/g, "&#39;")}}', '${{v.date}}', '${{v.views}}')">
                    <div class="vod-thumb"><img src="${{v.thumb}}" onerror="this.src='https://via.placeholder.com/320x180/1a1a2e/8a2be2?text=YXL'"></div>
                    <div class="vod-text"><h4>${{v.title}}</h4><p>${{v.date}} • ${{Number(v.views).toLocaleString()}}회</p></div>
                </div>`).join('');
        }}

        function searchVOD() {{
            const query = document.getElementById('vodSearch').value.toLowerCase();
            const filtered = allVODs.filter(v => v.title.toLowerCase().includes(query) || v.id.includes(query));
            document.getElementById('list-title').innerText = query === "" ? "ALL VIDEOS" : `SEARCH RESULTS (${{filtered.length}})`;
            renderVODList(filtered);
        }}

        let time = 300;
        setInterval(() => {{ time--; const min = Math.floor(time/60); const sec = time%60; const el = document.getElementById('timer-text'); if(el) el.innerText = `NEXT: ${{min}}:${{sec<10?'0':''}}${{sec}}`; if(time<=0) location.reload(); }}, 1000);
        
        renderCalendar();
        renderVODList(allVODs);
    </script>
</body>
</html>
"""
    # ⚠️ 복사할 때 이 아래쪽 Python 파일 쓰기 및 실행 부분까지 전부 긁어서 복사하셔야 합니다!
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

if __name__ == "__main__":
    init_db_if_empty()
    db_members = get_members_from_db()
    db_history = get_history_from_db()
    generate_full_system(db_members, db_history)