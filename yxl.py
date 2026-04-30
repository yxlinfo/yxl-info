import requests
import json

# YXL 크루 멤버 리스트
MEMBERS = [
    "sladk51", "jaeha010", "star49", "smkim82372", 
    "offside629", "asy1218", "fhwm0602", "jeewon1202", 
    "zbxlzzz", "tkek55", "iluvpp", "wk3220", 
    "ahrum0912", "meldoy777", "callgg", "kimpooh0707"
]

def get_stream_status():
    status_data = {}
    
    # 브라우저 접근처럼 보이게 하기 위한 헤더 설정
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    for mid in MEMBERS:
        try:
            # 1차 확인: 공식 플레이어 API (공개 방송 위주)
            api_url = f"https://live.sooplive.com/afreeca/player_live_api.php?bj_id={mid}"
            response = requests.get(api_url, headers=headers, timeout=7)
            data = response.json()
            
            channel = data.get('CHANNEL', {})
            broad_no = channel.get('broad_no', '0')
            
            # 2차 확인: 방송국 API (비공개/비번방 교차 검증)
            # 플레이어 API에서 broad_no가 "0"으로 올 경우를 대비해 방송국 API로 재확인합니다.
            if broad_no == "0" or broad_no is None:
                station_url = f"https://bjapi.sooplive.com/api/{mid}/station"
                st_res = requests.get(station_url, headers=headers, timeout=5)
                st_data = st_res.json()
                
                # 방송국 데이터 내의 broad_no 존재 여부 확인
                station_broad = st_data.get('broad')
                if station_broad and station_broad.get('broad_no'):
                    is_on = True
                    title = "비공개 방송 중"
                    viewers = "0"
                else:
                    is_on = False
            else:
                is_on = True
                title = channel.get('TITLE', '방송 중')
                viewers = channel.get('VIEW_CNT', '0')
            
            # 데이터 저장
            status_data[mid] = {
                "is_on": is_on,
                "title": title,
                "viewers": viewers
            }
            
        except Exception:
            # 에러 발생 시 해당 멤버는 오프라인 처리
            status_data[mid] = {"is_on": False}
    
    # status.json 파일로 저장 (UTF-8 인코딩)
    with open('status.json', 'w', encoding='utf-8') as f:
        json.dump(status_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    get_stream_status()