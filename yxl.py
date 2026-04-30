import requests
import json
import os

# 16명 멤버 ID 리스트 (이전에 제공해주신 설정 기반)
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
            # 아프리카TV 공식 API 또는 페이지 파싱 주소 (사용자 활동 기반 연동)
            api_url = f"https://live.sooplive.com/afreeca/player_live_api.php?bj_id={mid}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            
            response = requests.get(api_url, headers=headers, timeout=10)
            data = response.json()
            
            # 방송 중인지 확인 (CHANNEL.RESULT가 1이면 방송 중)
            is_live = data.get('CHANNEL', {}).get('RESULT') == 1
            
            if is_live:
                status_data[mid] = {
                    "is_on": True,
                    "title": data['CHANNEL'].get('TITLE', '방송 중'),
                    "viewers": data['CHANNEL'].get('VIEW_CNT', '0'),
                    "start_time": data['CHANNEL'].get('START_TIME', '')
                }
            else:
                status_data[mid] = {
                    "is_on": False,
                    "title": "퇴근",
                    "viewers": "0"
                }
        except Exception as e:
            print(f"Error checking {mid}: {e}")
            status_data[mid] = {"is_on": False, "title": "Error", "viewers": "0"}

    # 결과를 status.json으로 저장
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_data, f, ensure_ascii=False, indent=4)
    
    print("Successfully updated status.json")

if __name__ == "__main__":
    get_stream_status()