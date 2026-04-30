import requests
import json

def get_streamer_info(user_id):
    """API에서 실시간 방송 정보를 가져오는 함수"""
    url = f"https://api-channel.sooplive.com/v1.1/channel/{user_id}/home/section/broad"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        
        # 데이터가 있고 broadNo가 존재하면 방송 중
        if data and "broadNo" in data:
            return {
                "is_live": True,
                "name": "염보성", # 고정값 또는 다른 API로 보충 가능
                "profile_img": "https://stimg.sooplive.com/LOGO/yu/yuambo/m/yuambo.webp",
                "station_url": f"https://www.sooplive.com/station/{user_id}",
                "broad_no": data["broadNo"],
                "title": data["broadTitle"],
                "viewers": format(data["currentSumViewer"], ','),
                "thumb_url": f"https://live-screenshot.sooplive.com/live-agent/sur_v/{data['broadNo']}.jpg"
            }
    except Exception as e:
        print(f"데이터 조회 중 오류 발생: {e}")
        
    # 방종 상태일 때 반환값
    return {
        "is_live": False,
        "name": "염보성",
        "profile_img": "https://stimg.sooplive.com/LOGO/yu/yuambo/m/yuambo.webp",
        "station_url": f"https://www.sooplive.com/station/{user_id}",
        "title": "방송 종료",
        "viewers": "0",
        "thumb_url": ""
    }

def save_html(info):
    """가져온 정보를 바탕으로 HTML 파일을 생성하는 함수"""
    live_class = "is-live" if info['is_live'] else ""
    
    html_template = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{info['name']} 대시보드</title>
    <style>
        body {{ background: transparent; margin: 0; font-family: 'Pretendard', sans-serif; display: flex; justify-content: center; padding: 20px; overflow: hidden; }}
        
        /* 카드 디자인 */
        .streamer-card {{
            width: 280px; border-radius: 20px; background: #fff; position: relative;
            text-align: center; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 4px 6px rgba(0,0,0,0.05); cursor: pointer; border: 2px solid transparent;
        }}
        .streamer-card.is-live {{ border-color: #ff4646; box-shadow: 0 0 15px rgba(255, 70, 70, 0.2); }}
        
        /* Hover: 볼록 튀어나오는 느낌 */
        .streamer-card:hover {{ transform: translateY(-10px); box-shadow: 0 15px 30px rgba(0,0,0,0.15); }}
        .streamer-card.is-live:hover {{ box-shadow: 0 15px 30px rgba(255, 70, 70, 0.4); }}

        /* LIVE 배지 */
        .live-badge {{
            display: none; position: absolute; top: 15px; right: 15px;
            background: #ff4646; color: white; padding: 4px 10px; border-radius: 6px;
            font-size: 12px; font-weight: bold; z-index: 10; animation: blink 1.5s infinite;
        }}
        .is-live .live-badge {{ display: block; }}
        @keyframes blink {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.7; }} }}

        /* 썸네일 미리보기 (커서 추적) */
        #thumbnail-preview {{
            position: fixed; pointer-events: none; display: none; z-index: 1000;
            width: 260px; background: #1a1a1a; border-radius: 12px; overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #333;
        }}
        .preview-screen img {{ width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }}
        .preview-info {{ padding: 10px; color: white; }}
        .preview-title {{ font-size: 0.85rem; font-weight: 600; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .preview-stats {{ font-size: 0.75rem; color: #bbb; }}

        /* 카드 내부 */
        .card-header {{ height: 80px; background: linear-gradient(135deg, #1e3a8a, #000000); border-radius: 18px 18px 0 0; }}
        .profile-section {{ margin-top: -45px; padding: 0 20px 25px 20px; }}
        .profile-img {{ width: 90px; height: 90px; border-radius: 50%; border: 4px solid #ffffff; object-fit: cover; background: #fff; }}
        .streamer-name {{ margin: 12px 0 5px 0; font-size: 1.4rem; font-weight: 700; color: #1a1a1a; }}
        .btn-station {{
            display: block; text-decoration: none; background: #0045ff; color: #fff;
            padding: 12px; border-radius: 12px; font-weight: bold; margin-top: 15px; transition: 0.2s;
        }}
        .btn-station:hover {{ background: #0035cc; }}
    </style>
</head>
<body>

    <div class="streamer-card {live_class}" 
         data-thumb="{info.get('thumb_url', '')}"
         data-title="{info['title']}"
         data-viewers="{info['viewers']}">
        
        <div class="live-badge">● LIVE</div>
        <div class="card-header"></div>
        <div class="profile-section">
            <img src="{info['profile_img']}" class="profile-img">
            <h2 class="streamer-name">{info['name']}</h2>
            <a href="{info['station_url']}" target="_blank" class="btn-station">방송국 가기</a>
        </div>
    </div>

    <div id="thumbnail-preview">
        <div class="preview-screen"><img src="" id="p-img"></div>
        <div class="preview-info">
            <div class="preview-title" id="p-title"></div>
            <div class="preview-stats">👤 <span id="p-viewers"></span>명 시청 중</div>
        </div>
    </div>

    <script>
        const card = document.querySelector('.streamer-card');
        const preview = document.getElementById('thumbnail-preview');
        const pImg = document.getElementById('p-img');
        const pTitle = document.getElementById('p-title');
        const pViewers = document.getElementById('p-viewers');

        card.addEventListener('mousemove', (e) => {{
            if (e.target.closest('.btn-station')) {{
                preview.style.display = 'none';
                return;
            }}

            if (card.classList.contains('is-live')) {{
                pImg.src = card.getAttribute('data-thumb');
                pTitle.textContent = card.getAttribute('data-title');
                pViewers.textContent = card.getAttribute('data-viewers');
                preview.style.display = 'block';
                preview.style.left = (e.clientX + 20) + 'px';
                preview.style.top = (e.clientY - (preview.offsetHeight / 2)) + 'px';
            }}
        }});

        card.addEventListener('mouseleave', () => {{
            preview.style.display = 'none';
        }});
    </script>
</body>
</html>
    """
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_template)
    print("✅ index.html 생성 완료!")

# 실행
if __name__ == "__main__":
    streamer_id = "yuambo"
    data = get_streamer_info(streamer_id)
    save_html(data)