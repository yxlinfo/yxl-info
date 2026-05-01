import requests
import json
import re

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
def generate_full_system(members):
    print("\n[1/3] 생방송 상태를 체크합니다...")
    data_map = {m['name']: get_yxl_status(m['name'], m['id'], m['pos'], m['img']) for m in members}
    js_member_data = json.dumps({m['name']: m for m in members}, ensure_ascii=False)
    
    # 요청하신 새로운 6열 구조 (사원/인턴장/시급이 합침, 신입 분리, 웨이터 분리)
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

    print("[2/3] 매출 데이터를 생성합니다...")
    history_db = {
        "시즌1": {"직급전": 5374481, "contents": [["1회차", 2426065], ["2회차", 2732426], ["3회차", 3890922], ["4회차", 3833288], ["5회차", 3054893]]},
        "시즌2": {"직급전": 6610938, "contents": [["1회차", 6078903], ["2회차", 3390108], ["3회차", 4124926], ["4회차", 2313129], ["5회차", 1969188]]},
        "시즌3": {"직급전": 13445194, "contents": [["1회차", 2683770], ["2회차", 2011356], ["3회차", 1852181], ["4회차", 1703576], ["5회차", 1863867]]},
        "시즌4": {"직급전": 2561153, "contents": [["1회차", 2035685], ["2회차", 1702385], ["3회차", 2676513], ["4회차", 1216858], ["5회차", 1939123]]},
        "시즌5": {"직급전": 4252794, "contents": [["1회차", 3400157], ["2회차", 2996095], ["3회차", 2300171], ["4회차", 2122733], ["5회차", 370113]]},
        "시즌6": {"직급전": 5953195, "contents": [["1회차", 2822840], ["2회차", 2076273], ["3회차", 2642197], ["4회차", 2948979], ["5회차", 2043429]]},
        "시즌7": {"직급전": 5746700, "contents": [["1회차", 3076958], ["2회차", 2961402], ["3회차", 3738078], ["4회차", 3390310], ["5회차", 2023172]]},
        "시즌8": {"직급전": 5769642, "contents": [["1회차", 4291255], ["2회차", 2356810], ["3회차", 3932965], ["4회차", 1766989], ["5회차", 1815026]]},
        "시즌9": {"직급전": 4716222, "contents": [["1회차", 2823519], ["2회차", 2476563], ["3회차", 3035332], ["4회차", 2003513], ["5회차", 4514325]]},
        "시즌10": {"직급전": 5035289, "contents": [["1회차", 2470625], ["2회차", 2008740], ["3회차", 2359007], ["4회차", 2114014], ["5회차", 2430578]]},
        "시즌11": {"직급전": 4222022, "contents": [["1회차", 2397972], ["2회차", 1364489], ["3회차", 1507997], ["4회차", 4078678], ["5회차", 1580993]]},
        "시즌12": {"직급전": 3026835, "contents": [["1회차", 3038172], ["2회차", 2960260], ["3회차", 1860656], ["4회차", 1356111], ["5회차", 1465653]]},
        "시즌13": {"직급전": 3342545, "contents": [["1회차", 3046622], ["2회차", 1426315], ["3회차", 5941453], ["4회차", 1049820], ["5회차", 1762153]]}
    }
    js_labels = [f"시즌{i}" for i in range(1, 14)]
    js_rank_rev = [history_db[f"시즌{i}"]["직급전"] for i in range(1, 14)]
    js_norm_rev = [sum(item[1] for item in history_db[f"시즌{i}"]["contents"]) for i in range(1, 14)]
    all_season_sum = sum(js_rank_rev) + sum(js_norm_rev)
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

        /* 2. 매출표 (차트 데이터 가독성 해결) */
        .sales-header-container {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-left: 4px solid #8a2be2; padding-left: 10px; flex-wrap: wrap; gap: 10px; }}
        .sales-main-title {{ font-size: 18px; color: #8a2be2; letter-spacing: 1px; }}
        .legend-box {{ display: flex; gap: 10px; font-size: 12px; color: #fff; }}
        .legend-item {{ display: flex; align-items: center; gap: 4px; }}
        .dot {{ width: 10px; height: 10px; border-radius: 3px; }}
        .total-sum-badge {{ font-size: 14px; color: #fff; background: #8a2be2; padding: 6px 14px; border-radius: 20px; }}
        
        .sales-section {{ background: rgba(255,255,255,0.02); border: 1px solid rgba(138, 43, 226, 0.2); border-radius: 15px; padding: 20px; margin-bottom: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); width: 100%; }}
        
        /* 💡 가로폭을 강제로 1000px로 늘려서 숫자가 겹치지 않게 하고, 스크롤을 생성합니다 */
        .chart-scroll-wrapper {{ overflow-x: auto; width: 100%; padding-bottom: 10px; }}
        .chart-container {{ min-width: 1000px; height: 350px; }}
        .chart-container-small {{ min-width: 400px; height: 250px; }}

        /* 3. 일정표 (호버 강조 효과 완벽 적용) */
        .next-event-card {{ background: linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(0, 0, 0, 0.8) 100%); border: 1px solid #8a2be2; border-radius: 15px; padding: 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 5px 25px rgba(138, 43, 226, 0.3); margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }}
        .next-event-info h3 {{ font-size: 15px; color: #FFD700; margin: 0 0 8px 0; }}
        .next-event-info h1 {{ font-size: 28px; color: #fff; margin: 0 0 10px 0; }}
        .next-event-info p {{ font-size: 14px; color: #aaa; margin: 0; }}
        .d-day-badge {{ font-size: 40px; color: #8a2be2; text-shadow: 0 0 15px rgba(138,43,226,0.8); }}
        
        .timeline-section {{ background: rgba(255,255,255,0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 25px; }}
        .timeline-title {{ font-size: 18px; color: #fff; border-left: 4px solid #8a2be2; padding-left: 10px; margin-bottom: 20px; }}
        
        /* 💡 타임라인 호버(선택) 강조 CSS */
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

        /* 💡 모달 디자인 (상단 노출로 위치 변경) */
        #sales-modal, #p-modal {{ 
            display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 6000; 
            align-items: flex-start; justify-content: center; backdrop-filter: blur(5px); padding: 20px; 
            padding-top: 12vh; /* 중앙(center) 대신 상단에서 12% 내려온 위치에 고정 */
        }}
        .s-modal-card {{ background: #12121b; width: 100%; max-width: 450px; border-radius: 15px; border: 1px solid #444; padding: 25px; box-sizing: border-box; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }}
        .content-item {{ display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #222; font-size: 14px; }}
        
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
                    <span class="sales-main-title">YXL 히스토리 (시즌 1-13)</span>
                    <div class="legend-box"><div class="legend-item"><div class="dot" style="background:#8a2be2;"></div>직급전</div><div class="legend-item"><div class="dot" style="background:#ff69b4;"></div>일반회차</div></div>
                    <div class="total-sum-badge">총 합산: {all_season_sum:,}</div>
                </div>
                <!-- 💡 넓은 차트 영역을 감싸는 스크롤 래퍼 추가 -->
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

        function renderCharts() {{
            Chart.register(ChartDataLabels);
            if(hChart) hChart.destroy();
            if(cChart) cChart.destroy();
            // 💡 숫자 가독성을 위해 폰트 사이즈를 11px로 조절하고 겹치지 않게 했습니다.
            const commonOptions = {{ responsive: true, maintainAspectRatio: false, layout: {{ padding: {{ top: 30 }} }}, plugins: {{ legend: {{ display: false }}, datalabels: {{ anchor: 'end', align: 'top', color: '#fff', font: {{ weight: '900', size: 11 }}, formatter: (v, ctx) => ctx.chart.canvas.id === 'historyChart' && ctx.datasetIndex === 1 ? (ctx.chart.data.datasets[0].data[ctx.dataIndex] + v).toLocaleString() : (ctx.chart.canvas.id === 'currentChart' ? v.toLocaleString() : null) }} }}, scales: {{ y: {{ display: false }}, x: {{ ticks: {{ color: '#fff', font: {{ weight: '900', size: 11 }} }}, grid: {{ display: false }} }} }} }};
            hChart = new Chart(document.getElementById('historyChart'), {{ type: 'bar', data: {{ labels: {json.dumps(js_labels, ensure_ascii=False)}, datasets: [{{ label: '직급전', data: {js_rank_rev}, backgroundColor: '#8a2be2', borderRadius: 0 }}, {{ label: '일반회차', data: {js_norm_rev}, backgroundColor: '#ff69b4', borderRadius: {{topLeft: 4, topRight: 4}} }}] }}, options: {{ ...commonOptions, scales: {{ y: {{ stacked: true, display: false, max: 35000000 }}, x: {{ stacked: true, ticks: {{ color: '#fff', font: {{ weight: '900', size: 11 }} }}, grid: {{ display: false }} }} }}, onClick: (e, activeEls) => activeEls.length > 0 && openSalesModal(hChart.data.labels[activeEls[0].index]) }} }});
            cChart = new Chart(document.getElementById('currentChart'), {{ type: 'bar', data: {{ labels: ['직급전', '1회차', '2회차'], datasets: [{{ data: {current_season_vals}, backgroundColor: ['#FFD700', '#00e5ff', '#00e5ff'], borderRadius: 4 }}] }}, options: {{ ...commonOptions, layout: {{ padding: {{ top: 20 }} }} }} }});
        }}

        function openSalesModal(season) {{
            const data = historyDb[season]; if(!data) return;
            document.getElementById('s-title').innerText = season + " 상세 매출";
            let html = `<li class="content-item"><span style="color:#8a2be2;">직급전</span> <b style="color:#FFD700;">${{data.직급전.toLocaleString()}}개</b></li>`;
            data.contents.forEach(item => html += `<li class="content-item"><span style="color:#ddd;">${{item[0]}}</span> <b style="color:#00e5ff;">${{item[1].toLocaleString()}}개</b></li>`);
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
    yxl_members = [
        {"name": "염보성", "id": "yuambo", "pos": "대표", "img": "https://storage2.ygosu.com/?code=S68dbfbfc3f44e8.21921692", "age": "1990.03.29", "join_date": "2024.10.01", "stats": "171.4cm / 76kg / B형", "mbti": "ENFJ", "skill": "스타크래프트"},
        {"name": "리윤", "id": "sladk51", "pos": "부장", "img": "https://storage2.ygosu.com/?code=S696b627eddf978.03910279", "age": "1996년생", "join_date": "2025.06.29", "stats": "164cm", "mbti": "ISTP", "skill": ""},
        {"name": "후잉", "id": "jaeha010", "pos": "차장", "img": "https://storage2.ygosu.com/?code=S688d2e96622764.18115475", "age": "2001.01.19", "join_date": "2024.10.12", "stats": "160cm / 47kg / AB형", "mbti": "ISTJ", "skill": "춤"},
        {"name": "냥냥수주", "id": "star49", "pos": "과장", "img": "https://storage2.ygosu.com/?code=S69777860bfb1b2.15315971", "age": "1997년생", "join_date": "2026.01.25", "stats": "", "mbti": "", "skill": ""},
        {"name": "류서하", "id": "smkim82372", "pos": "비서실장", "img": "https://storage2.ygosu.com/?code=S69f0a926dedb50.11272017", "age": "2000년생", "join_date": "2026.01.25", "stats": "", "mbti": "", "skill": ""},
        {"name": "율무", "id": "offside629", "pos": "대리", "img": "https://storage2.ygosu.com/?code=S6929cfcd99d997.32232313", "age": "1997년생", "join_date": "2025.10.19", "stats": "167cm", "mbti": "INTJ", "skill": ""},
        {"name": "하랑짱", "id": "asy1218", "pos": "주임", "img": "https://storage2.ygosu.com/?code=S696b61f365c0e3.11842146", "age": "1991년생", "join_date": "2025.10.12", "stats": "", "mbti": "", "skill": ""},
        {"name": "미로", "id": "fhwm0602", "pos": "사원", "img": "https://storage2.ygosu.com/?code=S69f0a947083819.23416908", "age": "1995년생", "join_date": "2026.01.13", "stats": "168cm", "mbti": "INTJ", "skill": ""},
        {"name": "유나연", "id": "jeewon1202", "pos": "인턴장", "img": "https://storage2.ygosu.com/?code=S696641fe535711.46782639", "age": "1999년생", "join_date": "2025.12.11", "stats": "163cm", "mbti": "ISFP", "skill": ""},
        {"name": "소다", "id": "zbxlzzz", "pos": "시급이", "img": "https://storage2.ygosu.com/?code=S696b623ea18219.09523333", "age": "1993년생", "join_date": "2024.10.29", "stats": "160cm", "mbti": "INFP", "skill": "필라테스"},
        {"name": "김유정", "id": "tkek55", "pos": "시급이", "img": "https://storage2.ygosu.com/?code=S68ba9d207c63b1.00242878", "age": "2000년생", "join_date": "2025.09.04", "stats": "164cm", "mbti": "ENTJ", "skill": ""},
        {"name": "백나현", "id": "wk3220", "pos": "신입", "img": "https://storage2.ygosu.com/?code=S69ccd4724ffea8.45980531", "age": "1996년생", "join_date": "2026.03.28", "stats": "160cm", "mbti": "ISFP", "skill": ""},
        {"name": "아름", "id": "ahrum0912", "pos": "신입", "img": "https://storage2.ygosu.com/?code=S69f0a918af6ab2.84500064", "age": "1997년생", "join_date": "2026.03.29", "stats": "168cm", "mbti": "INFP", "skill": "골프"},
        {"name": "서니", "id": "iluvpp", "pos": "신입", "img": "https://storage2.ygosu.com/?code=S69f0a954b0c8f6.90064035", "age": "1997년생", "join_date": "2025.06.17", "stats": "160cm", "mbti": "ISTP", "skill": ""},
        {"name": "너의멜로디", "id": "meldoy777", "pos": "신입", "img": "https://storage2.ygosu.com/?code=S69cb6c7203b578.77318633", "age": "1999년생", "join_date": "2026.03.31", "stats": "163cm", "mbti": "ESFP", "skill": ""},
        {"name": "꺼니", "id": "callgg", "pos": "웨이터", "img": "https://storage2.ygosu.com/?code=S69f0a951064842.70871652", "age": "1993년생", "join_date": "2025.10.02", "stats": "", "mbti": "", "skill": ""},
        {"name": "김푸", "id": "kimpooh0707", "pos": "웨이터", "img": "https://storage2.ygosu.com/?code=S69f0a94dc072d2.06945517", "age": "1993년생", "join_date": "2025.10.02", "stats": "", "mbti": "", "skill": ""}
    ]
    generate_full_system(yxl_members)