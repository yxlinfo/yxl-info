import requests
import json
import os

# YXL 전 멤버 16명 리스트
members = [
    {"id": "sladk51", "name": "리윤", "rank": "부장", "join": "2025.06.29"},
    {"id": "jaeha010", "name": "후잉", "rank": "차장", "join": "2024.10.12"},
    {"id": "star49", "name": "냥냥수주", "rank": "과장", "join": "2026.01.25"},
    {"id": "smkim82372", "name": "류서하", "rank": "비서실장", "join": "2026.01.25"},
    {"id": "offside629", "name": "율무", "rank": "대리", "join": "2025.10.19"},
    {"id": "asy1218", "name": "하랑짱", "rank": "주임", "join": "2025.10.12"},
    {"id": "fhwm0602", "name": "미로", "rank": "사원", "join": "2026.01.13"},
    {"id": "jeewon1202", "name": "유나연", "rank": "인턴장", "join": "2025.12.11"},
    {"id": "zbxlzzz", "name": "소다", "rank": "시급이", "join": "2024.10.29"},
    {"id": "tkek55", "name": "김유정", "rank": "시급이", "join": "2025.09.04"},
    {"id": "iluvpp", "name": "서니", "rank": "신입", "join": "2026.04.14"},
    {"id": "wk3220", "name": "백나현", "rank": "신입", "join": "2026.03.28"},
    {"id": "ahrum0912", "name": "아름", "rank": "신입", "join": "2026.03.29"},
    {"id": "meldoy777", "name": "너의멜로디", "rank": "신입", "join": "2026.03.31"},
    {"id": "callgg", "name": "꺼니", "rank": "웨이터", "join": "2025.10.02"},
    {"id": "kimpooh0707", "name": "김푸", "rank": "웨이터", "join": "2025.10.02"}
]

def check_live_status():
    status_results = {}
    for m in members:
        # 라이브 이미지 응답을 통해 실시간 방송 여부 판단
        live_img_url = f"https://liveimg.sooplive.com/m/{m['id']}"
        try:
            res = requests.head(live_img_url, timeout=5)
            is_on = True if res.status_code == 200 else False
        except:
            is_on = False
            
        status_results[m['id']] = {
            "is_on": is_on,
            "title": f"YXL {m['name']} LIVE" if is_on else "OFFLINE",
            "viewers": "LIVE" if is_on else "0"
        }
    
    with open("status.json", "w", encoding="utf-8") as f:
        json.dump(status_results, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    check_live_status()