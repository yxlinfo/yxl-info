import requests
import json
import os

def get_streamer_data(name, user_id):
    """각 스트리머의 API에 접속하여 실시간 정보를 추출합니다."""
    url = f"https://api-channel.sooplive.com/v1.1/channel/{user_id}/home/section/broad"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    # 프로필 이미지는 아프리카TV 기본 경로 규칙을 활용 (ID의 앞 2글자/ID 순)
    profile_img = f"https://stimg.sooplive.com/LOGO/{user_id[:2]}/{user_id}/m/{user_id}.webp"
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        data = response.json()
        
        if data and "broadNo" in data:
            broad_no = data["broadNo"]
            return {
                "is_live": True,
                "name": name,
                "id": user_id,
                "profile_img": profile_img,
                "station_url": f"https://www.sooplive.com/station/{user_id}",
                "title": data.get("broadTitle", "제목 없음"),
                "viewers": format(data.get("currentSumViewer", 0), ','),
                "thumb_url": f"https://liveimg.sooplive.com/h/{broad_no}.webp"
            }
    except:
        pass
        
    return {
        "is_live": False,
        "name": name,
        "id": user_id,
        "profile_img": profile_img,
        "station_url": f"https://www.sooplive.com/station/{user_id}",
        "title": "방송 종료",
        "viewers": "0",
        "thumb_url": ""
    }

def generate_dashboard(streamer_list):
    """모든 스트리머 정보를 모아 하나의 HTML 파일을 생성합니다."""
    all_data = []
    for s in streamer_list:
        print(f"📡 {s['name']}({s['id']}) 정보 가져오는 중...")
        all_data.append(get_streamer_data(s['name'], s['id']))

    # 방송 중인 사람을 우선 순위로 정렬
    all_data.sort(key=lambda x: x['is_live'], reverse=True)

    cards_html = ""
    for info in all_data:
        live_class = "is-live" if info['is_live'] else ""
        cards_html += f"""
        <div class="streamer-card {live_class}" 
             data-thumb="{info['thumb_url']}"
             data-title="{info['title']}"
             data-viewers="{info['viewers']}">
            <div class="live-badge">● LIVE</div>
            <div class="card-header"></div>
            <div class="profile-section">
                <img src="{info['profile_img']}" class="profile-img" onerror="this.src='https://res.afreecatv.com/images/afreecatv/common/img_no_profile.gif'">
                <h2 class="streamer-name">{info['name']}</h2>
                <a href="{info['station_url']}" target="_blank" class="btn-station">방송국 가기</a>
            </div>
        </div>
        """

    html_template = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YXL STREAMER DASHBOARD</title>
    <style>
        body {{ background: #f0f2f5; margin: 0; font-family: 'Pretendard', sans-serif; padding: 40px 20px; }}
        
        /* 그리드 레이아웃: 화면 너비에 따라 카드 개수 자동 조절 */
        .dashboard-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 25px;
            max-width: 1400px;
            margin: 0 auto;
        }}

        .streamer-card {{
            background: #fff; border-radius: 24px; position: relative;
            text-align: center; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 8px 15px rgba(0,0,0,0.06); cursor: pointer; border: 2.5px solid transparent;
        }}
        .streamer-card.is-live {{ border-color: #ff4646; box-shadow: 0 0 20px rgba(255, 70, 70, 0.15); }}
        .streamer-card:hover {{ transform: translateY(-12px); box-shadow: 0 20px 40px rgba(0,0,0,0.12); }}
        .streamer-card.is-live:hover {{ box-shadow: 0 20px 40px rgba(255, 70, 70, 0.4); }}

        .live-badge {{ display: none; position: absolute; top: 18px; right: 18px; background: #ff4646; color: white; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; z-index: 10; animation: pulse 2s infinite; }}
        .is-live .live-badge {{ display: block; }}
        @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.6; }} }}

        #thumbnail-preview {{ position: fixed; pointer-events: none; display: none; z-index: 1000; width: 270px; background: #121212; border-radius: 14px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.5); border: 1.5px solid #333; }}
        .preview-screen img {{ width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }}
        .preview-info {{ padding: 12px; color: #fff; }}
        .preview-title {{ font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .preview-stats {{ font-size: 0.75rem; color: #aaa; }}

        .card-header {{ height: 85px; background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 21px 21px 0 0; }}
        .profile-section {{ margin-top: -45px; padding: 0 20px 25px 20px; }}
        .profile-img {{ width: 90px; height: 90px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: #f8fafc; }}
        .streamer-name {{ margin: 15px 0 5px 0; font-size: 1.4rem; font-weight: 800; color: #0f172a; }}
        .btn-station {{ display: block; text-decoration: none; background: #0045ff; color: #fff; padding: 12px; border-radius: 12px; font-weight: 700; margin-top: 15px; transition: 0.2s; }}
        .btn-station:hover {{ background: #0037cc; }}
    </style>
</head>
<body>

    <div class="dashboard-grid">
        {cards_html}
    </div>

    <div id="thumbnail-preview">
        <div class="preview-screen"><img src="" id="p-img"></div>
        <div class="preview-info">
            <div class="preview-title" id="p-title"></div>
            <div class="preview-stats">👤 <span id="p-viewers"></span>명 시청 중</div>
        </div>
    </div>

    <script>
        const cards = document.querySelectorAll('.streamer-card');
        const preview = document.getElementById('thumbnail-preview');
        const pImg = document.getElementById('p-img');
        const pTitle = document.getElementById('p-title');
        const pViewers = document.getElementById('p-viewers');

        cards.forEach(card => {{
            card.addEventListener('mousemove', (e) => {{
                if (e.target.closest('.btn-station')) {{ preview.style.display = 'none'; return; }}
                if (card.classList.contains('is-live')) {{
                    pImg.src = card.getAttribute('data-thumb');
                    pTitle.textContent = card.getAttribute('data-title');
                    pViewers.textContent = card.getAttribute('data-viewers');
                    preview.style.display = 'block';
                    preview.style.left = (e.clientX + 20) + 'px';
                    preview.style.top = (e.clientY - (preview.offsetHeight / 2)) + 'px';
                }}
            }});
            card.addEventListener('mouseleave', () => {{ preview.style.display = 'none'; }});
        }});
    </script>
</body>
</html>
    """
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_template)
    print(f"🎉 대시보드 생성 완료!")

if __name__ == "__main__":
    streamer_list = [
        {"name": "염보성", "id": "yuambo"},
        {"name": "리윤", "id": "sladk51"},
        {"name": "후잉", "id": "jaeha010"},
        {"name": "냥냥수수", "id": "star49"},
        {"name": "류서하", "id": "smkim82372"},
        {"name": "율무", "id": "offside629"},
        {"name": "하랑짱", "id": "asy1218"},
        {"name": "미로", "id": "fhwm0602"},
        {"name": "유나연", "id": "jeewon1202"},
        {"name": "김유정", "id": "tkek55"},
        {"name": "소다", "id": "zbxlzzz"},
        {"name": "백나현", "id": "wk3220"},
        {"name": "서니", "id": "iluvpp"},
        {"name": "아름", "id": "ahrum0912"},
        {"name": "너의멜로디", "id": "meldoy777"},
        {"name": "꺼니", "id": "callgg"},
        {"name": "김푸", "id": "kimpooh0707"}
    ]
    generate_dashboard(streamer_list)