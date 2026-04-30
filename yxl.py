import requests
import json
import time

# YXL 크루 멤버 리스트
MEMBERS = [
    "sladk51", "jaeha010", "star49", "smkim82372", 
    "offside629", "asy1218", "fhwm0602", "jeewon1202", 
    "zbxlzzz", "tkek55", "iluvpp", "wk3220", 
    "ahrum0912", "meldoy777", "callgg", "kimpooh0707"
]

def get_stream_status():
    status_data = {}
    
    for mid in MEMBERS:
        try:
            # 아프리카TV 공식 플레이어 API 호출
            api_url = f"https://live.sooplive.com/afreeca/player_live_api.php?bj_id={mid}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(api_url, headers=headers, timeout=10)
            data = response.json()
            
            channel_info = data.get('CHANNEL', {})
            # broad_no가 존재하고 "0"이 아니면 방송 장비가 활성화된 상태 (비번방 포함)
            broad_no = channel_info.get('broad_no')
            
            if broad_no and broad_no != "0":
                # 방송 중인 경우 상세 데이터 수집
                status_data[mid] = {
                    "is_on": True,
                    "title": channel_info.get('TITLE', '비공개 방송 중'), # 비번방일 경우 제목이 안 올 수 있어 기본값 설정
                    "viewers": channel_info.get('VIEW_CNT', '0')
                }
            else:
                # 방송 종료(퇴근) 상태
                status_data[mid] = {
                    "is_on": False
                }
        except Exception as e:
            # 에러 발생 시 안전하게 OFF 처리
            status_data[mid] = {
                "is_on": False
            }
    
    # 깃허브 액션이 인식할 수 있도록 status.json 파일로 저장
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    get_stream_status()