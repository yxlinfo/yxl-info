import requests
import json

# 유저님이 제공해주신 닉네임, 아이디, 고유번호 매칭 데이터
STREAMER_DATA = {
    "리윤": {"id": "sladk51", "no": "293641745"},
    "후잉": {"id": "jaeha010", "no": "293635513"},
    "냥냥수주": {"id": "star49", "no": "194283087"},
    "류서하": {"id": "smkim82372", "no": "293644155"},
    "율무": {"id": "offside629", "no": "194282859"},
    "하랑짱": {"id": "asy1218", "no": "293645237"},
    "미로": {"id": "fhwm0602", "no": "293644931"},
    "유나연": {"id": "jeewon1202", "no": "293644901"},
    "소다": {"id": "zbxlzzz", "no": "293645329"},
    "김유정": {"id": "tkek55", "no": "194284025"},
    "서니": {"id": "iluvpp", "no": "293641957"},
    "백나현": {"id": "wk3220", "no": "293635457"},
    "아름": {"id": "ahrum0912", "no": "194283191"},
    "너의멜로디": {"id": "meldoy777", "no": "194195841"},
    "꺼니": {"id": "callgg", "no": "193689229"},
    "김푸": {"id": "kimpooh0707", "no": "194161903"}
}

def check_live_status():
    status_results = {}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for name, info in STREAMER_DATA.items():
        mid = info["id"]
        target_no = info["no"]
        
        try:
            # 아프리카TV 플레이어 API 호출
            api_url = f"https://live.sooplive.com/afreeca/player_live_api.php?bj_id={mid}"
            res = requests.get(api_url, headers=headers, timeout=5).json()
            
            channel = res.get('CHANNEL', {})
            current_no = str(channel.get('broad_no', '0'))
            
            # 감지 로직:
            # 1. API에서 가져온 번호가 유저님이 준 고유번호와 일치하는가?
            # 2. 혹은 API가 번호를 가리더라도 현재 '방송 중' 신호(broad_no != 0)가 잡히는가?
            is_on = False
            if current_no == target_no:
                is_on = True
            elif current_no != "0" and current_no != "":
                is_on = True
            
            # 결과 데이터 구성
            status_results[mid] = {
                "name": name,
                "is_on": is_on,
                "title": channel.get('TITLE', '비공개 방송 중') if is_on else "",
                "viewers": channel.get('VIEW_CNT', '0') if is_on else "0"
            }
            
        except Exception:
            # 에러 발생 시 오프라인 처리
            status_results[mid] = {"name": name, "is_on": False}

    # status.json 파일 생성 (UTF-8 인코딩)
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_results, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    check_live_status()