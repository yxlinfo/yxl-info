import requests
import json

# 멤버 리스트 (닉네임: 아이디)
STREAMER_LIST = {
    "리윤": "sladk51", "후잉": "jaeha010", "냥냥수주": "star49", 
    "류서하": "smkim82372", "율무": "offside629", "하랑짱": "asy1218", 
    "미로": "fhwm0602", "유나연": "jeewon1202", "소다": "zbxlzzz", 
    "김유정": "tkek55", "서니": "iluvpp", "백나현": "wk3220", 
    "아름": "ahrum0912", "너의멜로디": "meldoy777", "꺼니": "callgg", 
    "김푸": "kimpooh0707", "염보성": "yuambo"
}

def check_live_status():
    status_results = {}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    for name, mid in STREAMER_LIST.items():
        try:
            # 유저님이 직접 확인하신 최신 API 경로
            api_url = f"https://api-channel.sooplive.com/v1.1/channel/{mid}/home/section/broad"
            response = requests.get(api_url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                # 'broad' 항목이 존재하면 방송 중인 상태입니다.
                broad_info = data.get('broad', None)
                
                if broad_info:
                    status_results[mid] = {
                        "name": name,
                        "is_on": True,
                        "title": broad_info.get('broadTitle', '비공개 방송 중'),
                        "viewers": str(broad_info.get('currentSumViewer', '0')),
                        "is_password": broad_info.get('isPassword', False),
                        "broad_no": str(broad_info.get('broadNo', '0'))
                    }
                else:
                    # 방송 중이 아닐 때 (broad가 null이거나 없음)
                    status_results[mid] = {"name": name, "is_on": False}
            else:
                # 404 에러 등이 날 경우 오프라인 처리
                status_results[mid] = {"name": name, "is_on": False}
                
        except Exception:
            status_results[mid] = {"name": name, "is_on": False}

    # status.json 파일로 저장
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_results, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    check_live_status()