import requests
import json
import re
import sqlite3 # 💡 데이터베이스를 사용하기 위해 추가됨

# ==========================================
# [DB 연동 1] 멤버 데이터 불러오기
# ==========================================
def get_members_from_db():
    conn = sqlite3.connect('yxl_management.db')
    cur = conn.cursor()
    # 멤버 정보와 직급 정보를 조인(JOIN)하여 한 번에 가져옵니다.
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
    conn = sqlite3.connect('yxl_management.db')
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
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36",
        "Origin": "https://m.sooplive.co.kr",
        "Referer": f"https://m.sooplive.co.kr/player/{vid}"
    }
    data = {"nTitleNo": vid}
    
    try:
        res = requests.post(api_url, headers=headers, data=data, timeout=5).json()
        if res.get("result") == 1 and "data" in res:
            v_data = res["data"]
            title = v_data.get("title", f"VOD ({vid})").replace('"', '&quot;').replace("'", "&#39;")
            views = int(v_data.get("view_cnt", 0))
            raw_date = str(v_data.get("broad_start", "2026-00-00 00:00:00"))
            date = raw_date[:10].replace("-", ".")
            
            thumb = v_data.get("thumb", "")
            if thumb and thumb.startswith("//"):
                thumb = "https:" + thumb
                
            return {"id": vid, "title": title, "date": date, "views": views, "thumb": thumb}
    except Exception as e:
        pass
    return {"id": vid, "title": f"정보 없음 ({vid})", "date": "-", "views": 0, "thumb": ""}

# ==========================================
# 3. 메인 대시보드 시스템 생성
# ==========================================
def generate_full_system(members, history_db):
    print("\n[1/3] 생방송 상태를 체크합니다...")
    data_map = {m['name']: get_yxl_status(m['name'], m['id'], m['pos'], m['img']) for m in members}
    js_member_data = json.dumps({m['name']: m for m in members}, ensure_ascii=False)
    
    rows_structure = [
        ["염보성"], 
        ["리윤", "후잉", "냥냥수주"], 
        ["류서하", "율무", "하랑짱"], 
        ["미로", "유나연", "소다", "김유정"], 
        ["백나현", "아름", "서니", "너의멜로디"], 
        ["꺼니", "김푸"]
    ]
    
    status_html = ""
    for row in rows_structure:
        cards = ""
        for name in row:
            if name in data_map:
                info = data_map[name]
                live_class = "on-air" if info['is_live'] else ""
                cards += f"""
                <div class="member-unit {live_class}" data-thumb="{info['thumb']}" data-title="{info['title']}" data-viewers="{info['viewers']}">
                    <div class="aura-container">
                        <div class="purple-aura"></div>
                        <div class="circle-frame" onclick="openProfile('{name}')">
                            <img src="{info['profile']}" class="profile-img">
                            <div class="embedded-info">
                                <div class="pos-tag" style="color: {info['theme']};">{info['pos']}</div>
                                <div class="name-label">{info['name']}</div>
                            </div>
                            <div class="overlay-menu" onclick="event.stopPropagation()">
                                <div class="click-guide" onclick="openProfile('{name}')">PROFILE CLICK</div>
                                <div class="btn-group">
                                    <a href="{info["home_link"]}" target="_blank" class="btn btn-home">방송국</a>
                                    {f'<a href="{info["live_link"]}" target="_blank" class="btn btn-live">LIVE</a>' if info['is_live'] else ''}
                                </div>
                            </div>
                        </div>
                        <div class="live-indicator">LIVE</div>
                    </div>
                </div>"""
        status_html += f'<div class="row">{cards}</div>'

    print("[2/3] 매출 데이터를 처리합니다...")
    js_labels = [f"시즌{i}" for i in range(1, len(history_db)+1)]
    js_rank_rev = [history_db.get(f"시즌{i}", {"직급전":0})["직급전"] for i in range(1, len(history_db)+1)]
    js_norm_rev = [sum(item[1] for item in history_db.get(f"시즌{i}", {"contents":[]})["contents"]) for i in range(1, len(history_db)+1)]
    all_season_sum = sum(js_rank_rev) + sum(js_norm_rev)
    
    # 14시즌은 아직 DB에 안 넣었으므로 하드코딩 유지 (추후 DB에 넣으면 로직 변경 가능)
    current_season_vals = [4343316, 2164822, 3135452]
    current_season_sum = sum(current_season_vals)

    print("[3/3] SOOP 서버에서 49개 VOD 실제 데이터를 가져옵니다. (약 10~15초 소요)")
    vod_ids = [
        "139389129", "140474073", "145078781", "145395293", "145430667", "145686859", "145694247", 
        "146665451", "149341401", "149372371", "149482895", "149543791", "151963511", "152673671", 
        "152932371", "153270385", "153906161", "155022377", "156072307", "156233659", "156443147", 
        "156897587", "157766473", "159784167", "159835159", "160179551", "160229793", "163314531", 
        "163507573", "165090649", "165095477", "166797677", "167711523", "168507233", "169165861", 
        "171334577", "171346633", "171517903", "171625221", "181193639", "181202165", "181212107", 
        "181319655", "182185345", "182561159", "185332075", "186322409", "188589109", "193831035"
    ]
    vod_ids.reverse() 
    
    vod_list = []
    for idx, vid in enumerate(vod_ids):
        print(f"   -> [{idx+1}/{len(vod_ids)}] VOD {vid} 로딩중...")
        vod_data = fetch_vod_data_by_api(vid)
        vod_list.append(vod_data)

    valid_vods = [v for v in vod_list if v["views"] > 0]
    top_5_vods = sorted(valid_vods, key=lambda x: x['views'], reverse=True)[:5]
    main_vod = vod_list[0] if vod_list else {"id":"", "title":"", "date":"", "views":0, "thumb":""}
    js_vod_data = json.dumps(vod_list, ensure_ascii=False)

    print("\n✅ 모든 데이터 수집 완료! HTML 및 더미 JSON 파일 생성 중...")

    # HTML 코드는 이전과 100% 동일합니다 (디자인 유지)
    full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <title>YXL MANAGEMENT SYSTEM</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <style>
        body {{ background: #0f0c1a; color: #fff; font-family: 'Pretendard', sans-serif; margin: 0; overflow-x: hidden; box-sizing: border-box; }}
        h1, h2, h3, h4, p, span, div {{ font-weight: 900; box-sizing: border-box; }}
        
        .nav-header {{ position: sticky; top: 0; background: rgba(15, 12, 26, 0.95); border-bottom: 1px solid rgba(138, 43, 226, 0.2); padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; backdrop-filter: blur(15px); box-shadow: 0 5px 20px rgba(0,0,0,0.5); flex-wrap: wrap; gap: 10px; }}
        .logo-section {{ display: flex; align-items: center; cursor: pointer; }}
        .update-timer {{ font-size: 14px; font-weight: 900; color: #8a2be2; margin-left: 15px; text-shadow: 0 0 10px rgba(138,43,226,0.4); letter-spacing: 1px; }}
        
        .tab-menu {{ display: flex; gap: 15px; flex-wrap: wrap; }}
        .tab-item {{ font-size: 15px; font-weight: 900; cursor: pointer; color: rgba(255,255,255,0.3); padding: 10px 5px; position: relative; text-transform: uppercase; transition: 0.3s; }}
        .tab-item.active {{ color: #fff; text-shadow: 0 0 10px rgba(138, 43, 226, 0.5); }}
        .tab-item.active::after {{ content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: #8a2be2; box-shadow: 0 0 15px #8a2be2; }}
        
        .main-container {{ padding: 25px 15px; width: 100%; max-width: 900px; margin: 0 auto; min-height: 100vh; }}
        .tab-content {{ display: none; animation: fadeIn 0.4s ease; width: 100%; }}
        .tab-content.active {{ display: block; }}
        @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(10px); }} to {{ opacity: 1; }} }}

        /* 1. 현황판 */
        #status {{ padding-top: 30px; }} 
        .row {{ display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 35px; justify-content: center; }}
        .member-unit {{ position: relative; width: 130px; transition: transform 0.3s; }}
        .member-unit:hover {{ transform: scale(1.08); z-index: 50; }}
        .circle-frame {{ position: relative; width: 120px; height: 120px; border-radius: 50%; padding: 4px; background: #fff; border: 1px solid #ddd; overflow: hidden; cursor: pointer; box-shadow: 0 5px 20px rgba(0,0,0,0.5); margin: 0 auto; }}
        .profile-img {{ width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }}
        .embedded-info {{ position: absolute; bottom: 0; width: 100%; height: 45%; background: linear-gradient(to top, rgba(0,0,0,0.95), transparent); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 3; }}
        .pos-tag {{ font-size: 10px; margin-bottom: 2px; text-shadow: 0 0 5px rgba(0,0,0,0.8); }}
        .name-label {{ font-size: 14px; color: #fff; text-shadow: 0 0 5px rgba(0,0,0,0.8); }}
        .overlay-menu {{ position: absolute; inset: 0; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transition: 0.3s; z-index: 10; border-radius: 50%; }}
        .member-unit:hover .overlay-menu {{ opacity: 1; }}
        .click-guide {{ font-size: 9px; color: #fff; background: #8a2be2; padding: 3px 8px; border-radius: 10px; margin-bottom: 6px; }}
        .btn {{ width: 70px; padding: 4px 0; border-radius: 15px; font-size: 10px; color: #fff; border: 1px solid rgba(255,255,255,0.3); text-decoration: none; text-align: center; margin-bottom: 4px; transition: 0.2s; }}
        .btn:hover {{ background: #fff; color: #000; box-shadow: 0 0 15px rgba(255,255,255,0.6); }}
        .btn-live {{ background: #ff0000; border: none; }}
        .btn-live:hover {{ background: #ff3333; color: #fff; box-shadow: 0 0 15px #ff0000; }}
        .purple-aura {{ position: absolute; width: 140px; height: 140px; top:-6px; left:-6px; background: radial-gradient(circle, rgba(138, 43, 226, 0.3) 0%, transparent 70%); filter: blur(10px); z-index: 1; }}
        .live-indicator {{ position: absolute; top: 0; right: 0; background: #ff0000; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 4px; z-index: 15; display: none; }}
        .on-air .live-indicator {{ display: block; animation: blink 1s infinite; }}
        .on-air .circle-frame {{ border: 2px solid #ff0000; box-shadow: 0 0 20px rgba(255,0,0,0.6); }}
        @keyframes blink {{ 50% {{ opacity: 0.5; }} }}

        /* 미리보기(Preview) 툴팁 CSS */
        #preview {{ position: fixed; pointer-events: none; display: none; z-index: 9999; width: 300px; background: #0f0c1a; border: 2px solid #8a2be2; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.9); overflow: hidden; }}
        .p-thumb {{ width: 100%; aspect-ratio: 16/9; display: block; object-fit: cover; border-bottom: 1px solid #333; }}
        .p-info {{ padding: 15px; text-align: center; }}
        .p-title {{ font-size: 14px; color: #fff; margin-bottom: 8px; word-break: keep-all; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
        .p-live-badge {{ font-size: 13px; color: #ff0000; text-shadow: 0 0 10px rgba(255,0,0,0.5); }}

        /* 2. 매출표 */
        .sales-header-container {{ display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-left: 4px solid #8a2be2; padding-left: 10px; flex-wrap: wrap; gap: 10px; }}
        .sales-main-title {{ font-size: 18px; color: #8a2be2; letter-spacing: 1px; }}
        .legend-box {{ display: flex; gap: 10px; font-size: 12px; color: #fff; }}
        .legend-item {{ display: flex; align-items: center; gap: 4px; }}
        .dot {{ width: 10px; height: 10px; border-radius: 3px; }}
        .total-sum-badge {{ font-size: 14px; color: #fff; background: #8a2be2; padding: 6px 14px; border-radius: 20px; }}
        .sales-desc-text {{ font-size: 12px; color: #aaa; margin-top: 5px; font-weight: 500; display: block; }}
        
        .sales-section {{ background: rgba(255,255,255,0.02); border: 1px solid rgba(138, 43, 226, 0.2); border-radius: 15px; padding: 20px; margin-bottom: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); width: 100%; }}
        
        .chart-scroll-wrapper {{ overflow-x: auto; width: 100%; padding-bottom: 12px; }}
        .chart-scroll-wrapper::-webkit-scrollbar {{ height: 10px; }}
        .chart-scroll-wrapper::-webkit-scrollbar-track {{ background: rgba(0,0,0,0.4); border-radius: 10px; border: 1px solid rgba(138, 43, 226, 0.2); box-shadow: inset 0 0 5px rgba(0,0,0,0.8); }}
        .chart-scroll-wrapper::-webkit-scrollbar-thumb {{ background: linear-gradient(90deg, #5b1aa6, #ff4099); border-radius: 10px; box-shadow: inset 0 0 5px rgba(255,255,255,0.2); }}
        .chart-scroll-wrapper::-webkit-scrollbar-thumb:hover {{ background: linear-gradient(90deg, #8a2be2, #ff69b4); }}
        
        .chart-container {{ min-width: 1000px; height: 350px; }}
        .chart-container-small {{ min-width: 400px; height: 250px; }}

        /* 3. 일정표 */
        .next-event-card {{ background: linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(0, 0, 0, 0.8) 100%); border: 1px solid #8a2be2; border-radius: 15px; padding: 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 5px 25px rgba(138, 43, 226, 0.3); margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }}
        .next-event-info h3 {{ font-size: 15px; color: #FFD700; margin: 0 0 8px 0; }}
        .next-event-info h1 {{ font-size: 28px; color: #fff; margin: 0 0 10px 0; }}
        .next-event-info p {{ font-size: 14px; color: #aaa; margin: 0; }}
        .d-day-badge {{ font-size: 40px; color: #8a2be2; text-shadow: 0 0 15px rgba(138,43,226,0.8); }}
        
        .timeline-section {{ background: rgba(255,255,255,0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 25px; }}
        .timeline-title {{ font-size: 18px; color: #fff; border-left: 4px solid #8a2be2; padding-left: 10px; margin-bottom: 20px; }}
        
        .timeline-item {{ 
            position: relative; background: rgba(0,0,0,0.5); border: 1px solid rgba(138, 43, 226, 0.2); border-left: 4px solid #333; 
            border-radius: 10px; padding: 15px 20px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; 
            cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
        }}
        .timeline-item:hover {{ 
            transform: translateX(12px) scale(1.02); 
            background: linear-gradient(90deg, rgba(138, 43, 226, 0.15) 0%, rgba(0,0,0,0.8) 100%); 
            border-color: #8a2be2; border-left: 5px solid #8a2be2; 
            box-shadow: 0 10px 25px rgba(138, 43, 226, 0.5); 
        }}
        
        .t-date {{ font-size: 13px; color: #FFD700; margin-bottom: 5px; }}
        .t-title {{ font-size: 18px; color: #fff; margin-bottom: 5px; transition: color 0.3s; }}
        .timeline-item:hover .t-title {{ color: #e0b0ff; text-shadow: 0 0 10px rgba(138,43,226,0.6); }}
        .t-desc {{ font-size: 13px; color: #aaa; }}
        .t-status {{ padding: 6px 14px; border-radius: 15px; font-size: 12px; background: rgba(255,255,255,0.1); color: #fff; transition: 0.3s; }}
        .t-status.upcoming {{ background: #8a2be2; }}
        .timeline-item:hover .t-status {{ box-shadow: 0 0 15px rgba(255,255,255,0.4); }}

        /* 4. VOD */
        .search-wrapper {{ position: relative; width: 100%; max-width: 300px; margin-top: 10px; }}
        .search-input {{ width: 100%; background: rgba(255,255,255,0.05); border: 1px solid #8a2be2; padding: 10px 15px; border-radius: 20px; color: #fff; outline: none; font-size: 14px; box-sizing: border-box; }}
        
        .main-stage {{ background: rgba(15, 12, 26, 0.6); border: 1px solid rgba(138, 43, 226, 0.3); border-radius: 15px; padding: 20px; display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px; }}
        .player-wrapper {{ width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 10px; overflow: hidden; border: 1px solid #333; }}
        .player-wrapper iframe {{ width: 100%; height: 100%; border: none; }}
        .player-info {{ width: 100%; }}
        .top-badge {{ background: linear-gradient(to right, #ff0000, #ff8c00); padding: 4px 10px; border-radius: 4px; font-size: 11px; margin-bottom: 10px; display: inline-block; }}
        
        .vod-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; margin-top: 15px; margin-bottom: 40px; }}
        .vod-card {{ background: rgba(0,0,0,0.6); border-radius: 10px; border: 1px solid rgba(138, 43, 226, 0.2); cursor: pointer; transition: 0.3s; overflow: hidden; display:flex; flex-direction:column; }}
        .vod-card:hover {{ transform: translateY(-5px); border-color: #8a2be2; box-shadow: 0 10px 20px rgba(138,43,226,0.3); }}
        .vod-thumb {{ width: 100%; aspect-ratio: 16/9; background: #111; overflow: hidden; }}
        .vod-thumb img {{ width: 100%; height: 100%; object-fit: cover; transition: 0.4s; }}
        .vod-card:hover .vod-thumb img {{ opacity: 1; transform: scale(1.05); }}
        .vod-text {{ padding: 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; }}
        .vod-text h4 {{ margin: 0 0 6px 0; font-size: 13px; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }}
        .vod-text p {{ margin: 0; font-size: 11px; color: #aaa; }}

        /* 모달창 */
        #sales-modal, #p-modal {{ 
            display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 6000; 
            align-items: flex-start; justify-content: center; backdrop-filter: blur(5px); padding: 20px; 
            padding-top: 12vh;
        }}
        .s-modal-card {{ background: #12121b; width: 100%; max-width: 500px; border-radius: 15px; border: 1px solid #444; padding: 25px; box-sizing: border-box; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }}
        .content-item {{ display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #222; font-size: 13px; }}
        
        .profile-modal-inner {{ background: #12121b; width: 100%; max-width: 550px; border-radius: 15px; border: 1px solid #444; display: flex; flex-wrap: wrap; padding: 30px; position:relative; box-sizing: border-box; gap: 20px; justify-content: center; box-shadow: 0 20px 60px rgba(138,43,226,0.4); }}
        .profile-details-row {{ display: flex; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }}
        .profile-details-label {{ color: #8a2be2; width: 60px; font-weight: 900; }}
        .profile-details-value {{ color: #fff; flex: 1; }}
    </style>
</head>
<body>
    <header class="nav-header">
        <div class="logo-section" onclick="location.reload()">
            <img src="https://i.namu.wiki/i/TtDiKQg0FImiHkc53ADsBHPbhvb0CDKw7ojXJGPbsnL9OM-lwfAUWb7hi_HZH8BRGz68CkaIoJ706nPgEn0ddg.gif" height="45">
            <span class="update-timer" id="timer-text">NEXT: 5:00</span>
        </div>
        <nav class="tab-menu">
            <div class="tab-item active" onclick="switchTab(event, 'status')">현황판</div>
            <div class="tab-item" onclick="switchTab(event, 'sales')">매출표</div>
            <div class="tab-item" onclick="switchTab(event, 'schedule')">일정표</div>
            <div class="tab-item" onclick="switchTab(event, 'radio')">VOD</div>
        </nav>
    </header>

    <div class="main-container">
        <!-- 1. 현황판 -->
        <section id="status" class="tab-content active">{status_html}</section>

        <!-- 2. 매출표 -->
        <section id="sales" class="tab-content">
            <div class="sales-section">
                <div class="sales-header-container">
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:15px;">
                            <span class="sales-main-title">YXL 히스토리 (시즌 1-{len(history_db)})</span>
                            <div class="legend-box"><div class="legend-item"><div class="dot" style="background: linear-gradient(180deg, #8a2be2, #4a00e0);"></div>직급전</div><div class="legend-item"><div class="dot" style="background: linear-gradient(180deg, #ff69b4, #ff1493);"></div>일반회차</div></div>
                        </div>
                        <span class="sales-desc-text">※ 막대바 클릭시 회차별 상세정보가 나옵니다</span>
                    </div>
                    <div class="total-sum-badge">총 합산: {all_season_sum:,}</div>
                </div>
                <div class="chart-scroll-wrapper">
                    <div class="chart-container"><canvas id="historyChart"></canvas></div>
                </div>
            </div>
            <div class="sales-section">
                <div class="sales-header-container">
                    <span class="sales-main-title">시즌 14 회차</span>
                    <div class="total-sum-badge">시즌 합산: {current_season_sum:,}</div>
                </div>
                <div class="chart-scroll-wrapper">
                    <div class="chart-container-small"><canvas id="currentChart"></canvas></div>
                </div>
            </div>
        </section>

        <!-- 3. 일정표 -->
        <section id="schedule" class="tab-content">
            <div class="next-event-card">
                <div class="next-event-info">
                    <h3>NEXT HIGHLIGHT</h3>
                    <h1>시즌 14 - 3회차</h1>
                    <p>일시: 2026년 05월 07일 (목) 오후 5시</p>
                </div>
                <div class="d-day-badge">D-6</div>
            </div>
            <div class="timeline-section">
                <div class="timeline-title">YXL TIMELINE</div>
                <div class="timeline-item"><div><div class="t-date">05.07 (목) 17:00</div><div class="t-title">시즌 14 - 3회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status upcoming">UPCOMING</div></div>
                <div class="timeline-item"><div><div class="t-date">05.11 (월) 17:00</div><div class="t-title">시즌 14 - 4회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status">대기중</div></div>
                <div class="timeline-item"><div><div class="t-date">05.14 (목) 17:00</div><div class="t-title">시즌 14 - 5회차 : YXL</div><div class="t-desc">참여: 멤버 전원</div></div><div class="t-status">대기중</div></div>
            </div>
        </section>

        <!-- 4. VOD -->
        <section id="radio" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap;">
                <span class="timeline-title" style="margin:0;">LATEST BROADCAST</span>
                <div class="search-wrapper">
                    <input type="text" id="vodSearch" class="search-input" placeholder="영상 검색..." onkeyup="searchVOD()">
                </div>
            </div>

            <div class="main-stage">
                <div class="player-wrapper">
                    <iframe id="main-player-iframe" src="https://vod.sooplive.com/player/{main_vod['id']}" allowfullscreen></iframe>
                </div>
                <div class="player-info">
                    <div class="top-badge">최신 VOD 업데이트</div>
                    <h1 id="main-vod-title" style="font-size:20px; color:#fff; margin:0 0 10px 0;">{main_vod['title']}</h1>
                    <p id="main-vod-date" style="font-size:13px; color:#aaa; margin:0 0 5px 0;">방송일: {main_vod['date']}</p>
                    <p id="main-vod-views" style="font-size:14px; color:#FFD700; margin:0;">조회수: {format(main_vod['views'], ',')}회</p>
                </div>
            </div>

            <div class="timeline-title" style="margin-bottom:0;">POPULAR TOP 5</div>
            <div class="vod-grid">
                {"".join([f'''
                <div class="vod-card" onclick="changeMainPlayer('{v['id']}', '{v['title']}', '{v['date']}', '{v['views']}')">
                    <div class="vod-thumb"><img src="{v['thumb']}" onerror="this.src='https://via.placeholder.com/320x180/1a1a2e/8a2be2?text=YXL'"></div>
                    <div class="vod-text">
                        <div><div style="background:#8a2be2; color:#fff; font-size:9px; padding:2px 5px; border-radius:3px; display:inline-block; margin-bottom:4px;">HOT</div><h4>{v['title']}</h4></div>
                        <p>{v['date']} • {format(v['views'], ',')}회</p>
                    </div>
                </div>''' for v in top_5_vods])}
            </div>

            <div class="timeline-title" id="list-title" style="margin-bottom:0;">ALL VIDEOS</div>
            <div class="vod-grid" id="vodListContainer"></div>
        </section>
    </div>
    
    <!-- 복구된 미리보기 UI -->
    <div id="preview">
        <img src="" id="p-img" class="p-thumb">
        <div class="p-info">
            <div id="p-title" class="p-title"></div>
            <div class="p-live-badge">🔴 LIVE • <span id="p-viewers"></span>명 시청중</div>
        </div>
    </div>
    
    <!-- 모달 -->
    <div id="sales-modal" onclick="closeSalesModal()">
        <div class="s-modal-card" onclick="event.stopPropagation()">
            <div id="s-title" style="font-size:20px; color:#8a2be2; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;"></div>
            <ul id="s-list" style="list-style:none; padding:0; margin:0;"></ul>
            <div style="margin-top:20px; text-align:center; color:#777; font-size:12px; cursor:pointer;" onclick="closeSalesModal()">[ 닫기 ]</div>
        </div>
    </div>
    
    <div id="p-modal" onclick="closeProfile()">
        <div class="profile-modal-inner" onclick="event.stopPropagation()">
            <div style="position:absolute; top:15px; right:20px; cursor:pointer; font-size:24px; color:#888;" onclick="closeProfile()">×</div>
            <img src="" id="m-img" style="width:180px; height:180px; border-radius:50%; border:3px solid #8a2be2; object-fit:cover; box-shadow: 0 0 15px rgba(138,43,226,0.5);">
            <div style="flex:1; min-width: 200px; display:flex; flex-direction:column; justify-content:center;">
                <div id="m-name" style="font-size:28px; color:#fff;"></div>
                <div id="m-pos" style="font-size:15px; color:#8a2be2; margin-bottom:10px;"></div>
                <div id="m-details" style="display:flex; flex-direction:column; gap:2px; margin-top:5px;"></div>
            </div>
        </div>
    </div>

    <script>
        const members = {js_member_data};
        const historyDb = {json.dumps(history_db, ensure_ascii=False)};
        const allVODs = {js_vod_data};
        let hChart = null, cChart = null;

        function switchTab(e, id) {{
            document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(id).classList.add('active');
            if(id === 'sales') setTimeout(renderCharts, 50);
        }}

        function getGradient(ctx, chartArea, colorStart, colorEnd) {{
            if(!chartArea) return colorEnd;
            let gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, colorStart);
            gradient.addColorStop(1, colorEnd);
            return gradient;
        }}

        function renderCharts() {{
            Chart.register(ChartDataLabels);
            if(hChart) hChart.destroy();
            if(cChart) cChart.destroy();
            
            const commonOptions = {{ responsive: true, maintainAspectRatio: false, layout: {{ padding: {{ top: 30 }} }}, plugins: {{ legend: {{ display: false }}, datalabels: {{ anchor: 'end', align: 'top', color: '#fff', font: {{ weight: '900', size: 11 }}, formatter: (v, ctx) => ctx.chart.canvas.id === 'historyChart' && ctx.datasetIndex === 1 ? (ctx.chart.data.datasets[0].data[ctx.dataIndex] + v).toLocaleString() : (ctx.chart.canvas.id === 'currentChart' ? v.toLocaleString() : null) }} }}, scales: {{ y: {{ display: false }}, x: {{ ticks: {{ color: '#fff', font: {{ weight: '900', size: 11 }} }}, grid: {{ display: false }} }} }} }};
            
            hChart = new Chart(document.getElementById('historyChart'), {{ 
                type: 'bar', 
                data: {{ 
                    labels: {json.dumps(js_labels, ensure_ascii=False)}, 
                    datasets: [
                        {{ 
                            label: '직급전', data: {js_rank_rev}, 
                            backgroundColor: function(c) {{ return getGradient(c.chart.ctx, c.chart.chartArea, 'rgba(74, 0, 224, 0.7)', '#8a2be2'); }}, 
                            borderRadius: 0, borderWidth: 1, borderColor: 'rgba(138,43,226,0.5)', hoverBackgroundColor: '#fff' 
                        }}, 
                        {{ 
                            label: '일반회차', data: {js_norm_rev}, 
                            backgroundColor: function(c) {{ return getGradient(c.chart.ctx, c.chart.chartArea, 'rgba(255, 20, 147, 0.7)', '#ff69b4'); }}, 
                            borderRadius: {{topLeft: 6, topRight: 6}}, borderWidth: 1, borderColor: 'rgba(255,105,180,0.5)', hoverBackgroundColor: '#fff' 
                        }}
                    ] 
                }}, 
                options: {{ ...commonOptions, scales: {{ y: {{ stacked: true, display: false, max: 35000000 }}, x: {{ stacked: true, ticks: {{ color: '#fff', font: {{ weight: '900', size: 11 }} }}, grid: {{ display: false }} }} }}, onClick: (e, activeEls) => activeEls.length > 0 && openSalesModal(hChart.data.labels[activeEls[0].index]) }} 
            }});
            
            cChart = new Chart(document.getElementById('currentChart'), {{ 
                type: 'bar', 
                data: {{ 
                    labels: ['직급전', '1회차', '2회차'], 
                    datasets: [{{ 
                        data: {current_season_vals}, 
                        backgroundColor: function(c) {{ return getGradient(c.chart.ctx, c.chart.chartArea, 'rgba(255, 140, 0, 0.7)', '#FFD700'); }}, 
                        borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)', hoverBackgroundColor: '#fff' 
                    }}] 
                }}, 
                options: {{ ...commonOptions, layout: {{ padding: {{ top: 20 }} }} }} 
            }});
        }}

        function openSalesModal(season) {{
            const data = historyDb[season]; if(!data) return;
            document.getElementById('s-title').innerText = season + " 상세 매출";
            let html = `<li class="content-item"><span style="color:#8a2be2; flex:1;">직급전</span> <b style="color:#FFD700; margin-left: 10px;">${{data.직급전.toLocaleString()}}개</b></li>`;
            data.contents.forEach(item => html += `<li class="content-item"><span style="color:#ddd; flex:1;">${{item[0]}}</span> <b style="color:#00e5ff; margin-left: 10px;">${{item[1].toLocaleString()}}개</b></li>`);
            document.getElementById('s-list').innerHTML = html; document.getElementById('sales-modal').style.display = 'flex';
        }}
        function closeSalesModal() {{ document.getElementById('sales-modal').style.display = 'none'; }}
        
        function openProfile(n) {{ 
            const m = members[n]; document.getElementById('m-img').src = m.img; document.getElementById('m-name').innerText = n; document.getElementById('m-pos').innerText = m.pos; 
            let html = '';
            if(m.age) html += `<div class="profile-details-row"><span class="profile-details-label">나이</span><span class="profile-details-value">${{m.age}}</span></div>`;
            if(m.join_date) html += `<div class="profile-details-row"><span class="profile-details-label">입사일</span><span class="profile-details-value">${{m.join_date}}</span></div>`;
            if(m.stats) html += `<div class="profile-details-row"><span class="profile-details-label">스탯</span><span class="profile-details-value">${{m.stats}}</span></div>`;
            if(m.mbti) html += `<div class="profile-details-row"><span class="profile-details-label">MBTI</span><span class="profile-details-value">${{m.mbti}}</span></div>`;
            if(m.skill) html += `<div class="profile-details-row"><span class="profile-details-label">특기</span><span class="profile-details-value">${{m.skill}}</span></div>`;
            document.getElementById('m-details').innerHTML = html; document.getElementById('p-modal').style.display = 'flex'; 
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

        // 복구된 미리보기(Preview) 이벤트 리스너
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
                    let x = e.clientX + 15; 
                    let y = e.clientY + 15;
                    if(x + 320 > window.innerWidth) x = window.innerWidth - 330;
                    preview.style.left = x + 'px'; 
                    preview.style.top = y + 'px';
                }}
            }});
            unit.addEventListener('mouseleave', () => preview.style.display = 'none');
        }});

        let time = 300;
        setInterval(() => {{ time--; const min = Math.floor(time/60); const sec = time%60; const el = document.getElementById('timer-text'); if(el) el.innerText = `NEXT: ${{min}}:${{sec<10?'0':''}}${{sec}}`; if(time<=0) location.reload(); }}, 1000);
        renderVODList(allVODs);
    </script>
</body>
</html>
"""
    # 1. 완벽한 index.html 생성
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    # 2. 깃허브 액션 에러(128)를 막기 위한 가짜 status.json 자동 생성
    with open("status.json", "w", encoding="utf-8") as f:
        f.write("{}")

if __name__ == "__main__":
    # DB에서 최신 데이터를 읽어옵니다. (하드코딩 제거!)
    db_members = get_members_from_db()
    db_history = get_history_from_db()
    
    # 가져온 데이터로 메인 함수를 실행합니다.
    generate_full_system(db_members, db_history)