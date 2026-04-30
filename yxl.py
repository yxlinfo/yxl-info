import requests
import json
import time

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
            api_url = f"https://live.sooplive.com/afreeca/player_live_api.php?bj_id={mid}"
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(api_url, headers=headers, timeout=10)
            data = response.json()
            
            # RESULT 1이면 방송 중, 아니면 종료(비번방 포함)
            is_live = data.get('CHANNEL', {}).get('RESULT') == 1
            
            if is_live:
                status_data[mid] = {
                    "is_on": True,
                    "title": data['CHANNEL'].get('TITLE', '방송 중'),
                    "viewers": data['CHANNEL'].get('VIEW_CNT', '0')
                }
            else:
                status_data[mid] = {"is_on": False}
        except:
            status_data[mid] = {"is_on": False}
    
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    get_stream_status()