import requests
import json
import math

# 1. 스트리머 데이터 및 API 수집 함수
def get_yxl_universe_data(members):
    url_base = "https://api-channel.sooplive.com/v1.1/channel/{}/home/section/broad"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    # 직급별 천체 설정 (크기, 태양으로부터의 거리, 색상)
    astro_settings = {
        "대표": {"size": 90, "dist": 0, "color": "#FFD700", "speed": 0},
        "비서실장": {"size": 65, "dist": 100, "color": "#E5E4E2", "speed": 20},
        "부장": {"size": 60, "dist": 160, "color": "#C0C0C0", "speed": 30},
        "차장": {"size": 55, "dist": 210, "color": "#99A3A4", "speed": 35},
        "과장": {"size": 50, "dist": 260, "color": "#CD7F32", "speed": 40},
        "대리": {"size": 45, "dist": 310, "color": "#5DADE2", "speed": 45},
        "주임": {"size": 42, "dist": 350, "color": "#48C9B0", "speed": 50},
        "선임사원": {"size": 40, "dist": 390, "color": "#58D68D", "speed": 55},
        "사원": {"size": 38, "dist": 430, "color": "#F7DC6F", "speed": 60},
        "시급이": {"size": 38, "dist": 470, "color": "#F5B041", "speed": 65},
        "신입": {"size": 35, "dist": 510, "color": "#EB984E", "speed": 70},
        "웨이터": {"size": 40, "dist": 550, "color": "#AF7AC5", "speed": 75}
    }

    universe_data = []
    
    # 대표님은 무조건 중앙 고정
    boss = members[0]
    boss_astro = astro_settings["대표"]
    profile_img = f"https://stimg.sooplive.com/LOGO/{boss['id'][:2]}/{boss['id']}/m/{boss['id']}.webp"
    
    boss_data = {
        "name": boss['name'], "id": boss['id'], "pos": boss['pos'],
        "profile": profile_img, "is_live": False, "title": "", "viewers": "0", "thumb": "",
        **boss_astro, "angle": 0 # 대표님은 중앙
    }
    
    try:
        res = requests.get(url_base.format(boss['id']), headers=headers, timeout=5).json()
        if res and "broadNo" in res:
            boss_data.update({"is_live": True, "title": res.get("broadTitle", ""), "viewers": format(res.get("currentSumViewer", 0), ','), "thumb": f"https://liveimg.sooplive.com/h/{res['broadNo']}.webp"})
    except: pass
    universe_data.append(boss_data)

    # 나머지 멤버들 궤도 및 초기 각도 설정
    other_members = members[1:]
    angle_step = 360 / len(other_members)
    
    for i, m in enumerate(other_members):
        astro = astro_settings.get(m['pos'], astro_settings["신입"])
        profile_img = f"https://stimg.sooplive.com/LOGO/{m['id'][:2]}/{m['id']}/m/{m['id']}.webp"
        
        member_data = {
            "name": m['name'], "id": m['id'], "pos": m['pos'],
            "profile": profile_img, "is_live": False, "title": "부재 중", "viewers": "0", "thumb": "",
            **astro, "angle": i * angle_step # 초기 배치 각도
        }
        
        try:
            res = requests.get(url_base.format(m['id']), headers=headers, timeout=5).json()
            if res and "broadNo" in res:
                member_data.update({"is_live": True, "title": res.get("broadTitle", ""), "viewers": format(res.get("currentSumViewer", 0), ','), "thumb": f"https://liveimg.sooplive.com/h/{res['broadNo']}.webp"})
        except: pass
        universe_data.append(member_data)
        
    return universe_data

# 2. HTML 생성 함수
def generate_universe_html(data):
    planets_html = ""
    orbits_html = ""
    
    for info in data:
        is_boss = info['pos'] == '대표'
        live_class = "is-live" if info['is_live'] else ""
        boss_class = "is-boss" if is_boss else ""
        
        # 궤도 점선 HTML
        if not is_boss:
            orbits_html += f'<div class="orbit" style="width: {info["dist"]*2}px; height: {info["dist"]*2}px;"></div>'

        # 행성 HTML
        # 각 멤버의 고유 속성(거리, 초기각도, 속도, 크기)을 CSS 변수로 전달
        planets_html += f"""
        <div class="planet-container {live_class} {boss_class}" 
             style="--dist: {info['dist']}px; --angle: {info['angle']}deg; --speed: {info['speed']}s; --size: {info['size']}px; --theme: {info['color']};"
             data-thumb="{info['thumb']}" data-title="{info['title']}" data-viewers="{info['viewers']}" data-name="{info['name']}" data-pos="{info['pos']}">
            <div class="orbit-path">
                <div class="planet">
                    <img src="{info['profile']}" onerror="this.src='https://res.afreecatv.com/images/afreecatv/common/img_no_profile.gif'">
                    <div class="live-pulse"></div>
                </div>
            </div>
            <a href="https://www.sooplive.com/station/{info['id']}" target="_blank" class="hidden-link"></a>
        </div>
        """

    html_template = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>YXL UNIVERSE</title>
    <style>
        body {{ background: #050509; margin: 0; font-family: 'Pretendard', sans-serif; overflow: hidden; height: 100vh; display: flex; justify-content: center; align-items: center; color: #fff; }}
        
        /* 우주 컨테이너 */
        .universe-container {{ position: relative; width: 1200px; height: 1200px; display: flex; justify-content: center; align-items: center; transform: scale(0.8); }}

        /* 배경 별들 */
        .stars {{ position: absolute; width: 100%; height: 100%; background: url('https://s3-us-west-2.amazonaws.com/s.cdpn.io/123163/stars.png') repeat; opacity: 0.5; }}

        /* 궤도 점선 */
        .orbit {{ position: absolute; border: 1px dashed rgba(255,255,255,0.15); border-radius: 50%; pointer-events: none; }}

        /* 행성 공전 로직 (핵심) */
        .planet-container {{ position: absolute; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; pointer-events: none; z-index: 10; }}
        .orbit-path {{ position: absolute; width: 100%; height: 100%; animation: orbitRotate var(--speed) linear infinite; }}
        
        /* 각 행성의 위치 정의 */
        .planet {{ 
            position: absolute; top: 50%; left: 50%; 
            width: var(--size); height: var(--size); 
            margin-top: calc(var(--size) / -2); margin-left: calc(var(--size) / -2);
            transform: rotate(var(--angle)) translateX(var(--dist)) rotate(calc(-1 * var(--angle))); /* 초기 위치 */
            border-radius: 50%; transition: all 0.3s ease; pointer-events: auto; cursor: pointer;
            box-shadow: 0 0 10px rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2);
        }}
        
        /* 자전 애니메이션 (이미지가 안 돌게) */
        .planet img {{ width: 100%; height: 100%; border-radius: 50%; object-fit: cover; animation: orbitRotate var(--speed) linear infinite reverse; }}

        /* 대표님 (태양) 설정 */
        .is-boss {{ z-index: 50; }}
        .is-boss .planet {{ transform: none; box-shadow: 0 0 50px #FFD700; border: 4px solid #FFD700; animation: sunGlow 2s infinite; }}
        .is-boss .orbit-path {{ animation: none; }}
        .is-boss img {{ animation: none; }}

        /* LIVE 상태: 불타오르는 효과 */
        .is-live .planet {{ border-color: #ff4646 !important; box-shadow: 0 0 20px #ff4646 !important; animation: liveFire 1.5s infinite; }}
        .live-pulse {{ display: none; position: absolute; top:0; left:0; width:100%; height:100%; border-radius: 50%; background: rgba(255,70,70,0.4); z-index: -1; }}
        .is-live .live-pulse {{ display: block; animation: pulse 1.5s infinite; }}

        /* Hover: 행성 확대 및 정보 홀로그램 */
        .planet:hover {{ transform: rotate(var(--angle)) translateX(var(--dist)) rotate(calc(-1 * var(--angle))) scale(1.4); z-index: 100; border-color: var(--theme); box-shadow: 0 0 30px var(--theme); }}
        .is-boss .planet:hover {{ transform: scale(1.1); }}

        /* 애니메이션 정의 */
        @keyframes orbitRotate {{ from {{ transform: rotate(0deg); }} to {{ transform: rotate(360deg); }} }}
        @keyframes sunGlow {{ 0%, 100% {{ box-shadow: 0 0 50px #FFD700; }} 50% {{ box-shadow: 0 0 80px #FFD700; }} }}
        @keyframes liveFire {{ 0%, 100% {{ box-shadow: 0 0 20px #ff4646; }} 50% {{ box-shadow: 0 0 40px #ff4646, 0 0 10px #ff9f43; }} }}
        @keyframes pulse {{ 0% {{ transform: scale(1); opacity: 1; }} 100% {{ transform: scale(1.5); opacity: 0; }} }}

        .hidden-link {{ position: absolute; top:0; left:0; width:100%; height:100%; z-index: 5; }}

        /* 팝업 사원증 (홀로그램 스타일) */
        #hologram-card {{
            position: fixed; pointer-events: none; display: none; z-index: 2000;
            width: 220px; background: rgba(0, 10, 30, 0.85); border-radius: 12px;
            backdrop-filter: blur(10px); border: 2px solid var(--theme);
            box-shadow: 0 0 30px var(--theme); color: #fff; padding: 15px; text-align: center;
        }}
        .h-thumb {{ width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.2); }}
        .h-pos {{ font-size: 10px; font-weight: 800; color: var(--theme); text-transform: uppercase; margin-bottom: 2px; }}
        .h-name {{ font-size: 18px; font-weight: 900; margin-bottom: 8px; }}
        .h-title {{ font-size: 11px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }}
        .h-viewers {{ font-size: 12px; color: #ff4646; font-weight: 800; }}
    </style>
</head>
<body>
    <div class="stars"></div>
    <div class="universe-container">
        <div class="orbits-layer">{orbits_html}</div>
        <div class="planets-layer">{planets_html}</div>
    </div>

    <!-- 홀로그램 사원증 팝업 -->
    <div id="hologram-card">
        <img src="" id="h-thumb" class="h-thumb">
        <div class="h-pos" id="h-pos"></div>
        <div class="h-name" id="h-name"></div>
        <div class="h-title" id="h-title"></div>
        <div class="h-viewers">👤 <span id="h-viewers-count"></span>명</div>
    </div>

    <script>
        const planets = document.querySelectorAll('.planet');
        const card = document.getElementById('hologram-card');
        const hThumb = document.getElementById('h-thumb');
        const hPos = document.getElementById('h-pos');
        const hName = document.getElementById('h-name');
        const hTitle = document.getElementById('h-title');
        const hV = document.getElementById('h-viewers-count');

        planets.forEach(planet => {{
            const container = planet.closest('.planet-container');
            
            planet.addEventListener('mousemove', (e) => {{
                // 데이터 가져오기
                const thumb = container.getAttribute('data-thumb');
                
                // 썸네일이 있을 때만 (방송 중일 때만) 썸네일 노출
                if (thumb) {{
                    hThumb.src = thumb;
                    hThumb.style.display = 'block';
                }} else {{
                    hThumb.style.display = 'none';
                }}
                
                hPos.textContent = container.getAttribute('data-pos');
                hName.textContent = container.getAttribute('data-name');
                hTitle.textContent = container.getAttribute('data-title');
                hV.textContent = container.getAttribute('data-viewers');
                
                // 카드 테마 색상 적용
                const theme = container.style.getPropertyValue('--theme');
                card.style.setProperty('--theme', theme);
                
                // 팝업 띄우기 및 위치 조정
                card.style.display = 'block';
                card.style.left = (e.clientX + 25) + 'px';
                card.style.top = (e.clientY - 150) + 'px';
            }});
            
            planet.addEventListener('mouseleave', () => {{
                card.style.display = 'none';
            }});
        }});
    </script>
</body>
</html>
    """
    with open("index.html", "w", encoding="utf-8") as f: f.write(html_template)
    print("🌌 YXL 유니버스 대시보드 생성 완료!")

if __name__ == "__main__":
    yxl_members = [
        {"name": "염보성", "id": "yuambo", "pos": "대표"},
        {"name": "리윤", "id": "sladk51", "pos": "부장"},
        {"name": "후잉", "id": "jaeha010", "pos": "차장"},
        {"name": "냥냥수수", "id": "star49", "pos": "과장"},
        {"name": "류서하", "id": "smkim82372", "pos": "비서실장"},
        {"name": "율무", "id": "offside629", "pos": "대리"},
        {"name": "하랑짱", "id": "asy1218", "pos": "주임"},
        {"name": "미로", "id": "fhwm0602", "pos": "선임사원"},
        {"name": "유나연", "id": "jeewon1202", "pos": "사원"},
        {"name": "김유정", "id": "tkek55", "pos": "시급이"},
        {"name": "소다", "id": "zbxlzzz", "pos": "시급이"},
        {"name": "백나현", "id": "wk3220", "pos": "신입"},
        {"name": "서니", "id": "iluvpp", "pos": "신입"},
        {"name": "아름", "id": "ahrum0912", "pos": "신입"},
        {"name": "너의멜로디", "id": "meldoy777", "pos": "신입"},
        {"name": "꺼니", "id": "callgg", "pos": "웨이터"},
        {"name": "김푸", "id": "kimpooh0707", "pos": "웨이터"}
    ]
    
    # 데이터 수집 및 HTML 생성
    universe_data = get_yxl_universe_data(yxl_members)
    generate_universe_html(universe_data)