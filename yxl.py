import requests
import json
import os

def get_yxl_data(user_id):
    """사용자님이 알려주신 API 주소를 사용하여 실시간 정보를 가져옵니다."""
    url = f"https://api-channel.sooplive.com/v1.1/channel/{user_id}/home/section/broad"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers)
        # API 응답이 200 OK가 아닐 경우 예외 처리
        response.raise_for_status()
        data = response.json()
        
        # 알려주신 데이터 구조(broadNo 존재 여부)로 방송 상태 확인
        if data and "broadNo" in data:
            broad_no = data["broadNo"]
            return {
                "is_live": True,
                "name": "염보성",
                "profile_img": "https://stimg.sooplive.com/LOGO/yu/yuambo/m/yuambo.webp",
                "station_url": f"https://www.sooplive.com/station/{user_id}",
                "title": data.get("broadTitle", "제목 없음"),
                "viewers": format(data.get("currentSumViewer", 0), ','),
                # 알려주신 가장 깔끔한 WebP 썸네일 주소 형식 적용
                "thumb_url": f"https://liveimg.sooplive.com/h/{broad_no}.webp"
            }
    except Exception as e:
        print(f"데이터 수집 중 오류 발생: {e}")
        
    # 방송 종료 시 기본 정보
    return {
        "is_live": False,
        "name": "염보성",
        "profile_img": "https://stimg.sooplive.com/LOGO/yu/yuambo/m/yuambo.webp",
        "station_url": f"https://www.sooplive.com/station/{user_id}",
        "title": "현재 방송 종료",
        "viewers": "0",
        "thumb_url": ""
    }

def generate_yxl_html(info):
    """수집된 데이터를 바탕으로 고사양 카드 대시보드 HTML을 생성합니다."""
    live_status_class = "is-live" if info['is_live'] else ""
    
    html_content = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YXL Dashboard - {info['name']}</title>
    <style>
        /* 기본 배경 및 폰트 설정 */
        body {{ background: transparent; margin: 0; font-family: 'Pretendard', -apple-system, sans-serif; display: flex; justify-content: center; padding: 30px; overflow: hidden; }}
        
        /* [1] 카드 기본 디자인 & 애니메이션 */
        .streamer-card {{
            width: 280px; border-radius: 24px; background: #ffffff; position: relative;
            text-align: center; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 8px 15px rgba(0,0,0,0.06); cursor: pointer; border: 2.5px solid transparent;
        }}
        
        /* [2] 방송 중일 때 테두리 및 글로우 효과 */
        .streamer-card.is-live {{ border-color: #ff4646; box-shadow: 0 0 20px rgba(255, 70, 70, 0.25); }}
        
        /* [3] Hover: 볼록 튀어나오는 인터랙션 */
        .streamer-card:hover {{ transform: translateY(-12px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.12); }}
        .streamer-card.is-live:hover {{ box-shadow: 0 20px 40px rgba(255, 70, 70, 0.45); }}

        /* LIVE 배지 애니메이션 */
        .live-badge {{
            display: none; position: absolute; top: 18px; right: 18px;
            background: #ff4646; color: white; padding: 5px 12px; border-radius: 8px;
            font-size: 11px; font-weight: 800; z-index: 10; animation: pulse 2s infinite;
        }}
        .is-live .live-badge {{ display: block; }}
        @keyframes pulse {{ 0% {{ opacity: 1; }} 50% {{ opacity: 0.6; }} 100% {{ opacity: 1; }} }}

        /* [4] 커서 추적 썸네일 미리보기 박스 */
        #thumbnail-preview {{
            position: fixed; pointer-events: none; display: none; z-index: 1000;
            width: 270px; background: #121212; border-radius: 14px; overflow: hidden;
            box-shadow: 0 15px 35px rgba(0,0,0,0.5); border: 1.5px solid #333;
        }}
        .preview-screen img {{ width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }}
        .preview-info {{ padding: 12px; color: #fff; }}
        .preview-title {{ font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .preview-stats {{ font-size: 0.75rem; color: #aaa; display: flex; align-items: center; gap: 4px; }}

        /* 카드 내부 스타일링 */
        .card-header {{ height: 85px; background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 21px 21px 0 0; }}
        .profile-section {{ margin-top: -45px; padding: 0 20px 25px 20px; }}
        .profile-img {{ width: 90px; height: 90px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: #f8fafc; }}
        .streamer-name {{ margin: 15px 0 5px 0; font-size: 1.45rem; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }}
        .btn-station {{
            display: block; text-decoration: none; background: #0045ff; color: #fff;
            padding: 13px; border-radius: 14px; font-weight: 700; margin-top: 18px; transition: 0.2s ease;
        }}
        .btn-station:hover {{ background: #0037cc; transform: scale(1.02); }}
    </style>
</head>
<body>

    <div class="streamer-card {live_status_class}" 
         data-thumb="{info['thumb_url']}"
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

    <!-- 썸네일 팝업 엘리먼트 -->
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
            // 버튼 위에 있을 때는 썸네일 숨김
            if (e.target.closest('.btn-station')) {{
                preview.style.display = 'none';
                return;
            }}

            if (card.classList.contains('is-live')) {{
                pImg.src = card.getAttribute('data-thumb');
                pTitle.textContent = card.getAttribute('data-title');
                pViewers.textContent = card.getAttribute('data-viewers');
                
                preview.style.display = 'block';
                // 마우스 오른쪽 중앙 정렬 계산
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
    
    # 최종 index.html 파일 저장
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"🎉 [yxl.py] 완료: '{info['name']}' 정보를 담은 index.html이 생성되었습니다.")

if __name__ == "__main__":
    # 사용자님이 예시로 든 염보성(yuambo) ID 사용
    TARGET_ID = "yuambo"
    
    # 1. API 데이터 획득
    live_info = get_yxl_data(TARGET_ID)
    
    # 2. HTML 파일 생성
    generate_yxl_html(live_info)