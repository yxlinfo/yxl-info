import requests
import json
import time

streamers = [
    {"name": "후잉♥", "user_id": "jaeha010", "bbs_no": "42110606"},
    {"name": "류서하♥", "user_id": "smkim82372", "bbs_no": "65560144"},
    {"name": "백나현", "user_id": "wk3220", "bbs_no": "79496724"},
    {"name": "너의˚멜로디", "user_id": "meldoy777", "bbs_no": "108366731"},
    {"name": "냥냥수주", "user_id": "star49", "bbs_no": "121609123"},
    {"name": "하랑짱♥", "user_id": "asy1218", "bbs_no": "113481743"},
    {"name": "ZO아름♡", "user_id": "ahrum0912", "bbs_no": "122843945"},
    {"name": "김유정S2", "user_id": "tkek55", "bbs_no": "112452503"},
    {"name": "미로。", "user_id": "fhwm0602", "bbs_no": "92166558"},
    {"name": "소다♥", "user_id": "zbxlzzz", "bbs_no": "13644761"},
    {"name": "서니_♥", "user_id": "iluvpp", "bbs_no": "91109284"},
    {"name": "꺼니", "user_id": "callgg", "bbs_no": "329000"},
    {"name": "김푸:)", "user_id": "kimpooh0707", "bbs_no": "69409509"}
]

all_posts = []

print("데이터 수집 시작...")

for s in streamers:
    try:
        url = f"https://chapi.sooplive.com/api/{s['user_id']}/board/{s['bbs_no']}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json().get('data', [])
            for p in data[:3]: # 스트리머별 최신 3개
                all_posts.append({
                    "author": s['name'],
                    "title": p['title_name'],
                    "date": p['reg_date'],
                    "link": f"https://www.sooplive.com/station/{s['user_id']}/board/{s['bbs_no']}/{p['title_no']}"
                })
        print(f"완료: {s['name']}")
        time.sleep(0.5) # 서버 부하 방지
    except Exception as e:
        print(f"에러: {s['name']} - {e}")

# 날짜 기준 내림차순 정렬
all_posts.sort(key=lambda x: x['date'], reverse=True)

# 파일 저장
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(all_posts, f, ensure_ascii=False, indent=4)

print("\n'data.json' 파일이 생성되었습니다!")