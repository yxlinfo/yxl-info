import json
import re
import asyncio
import requests
from playwright.async_api import async_playwright

# --- 설정 ---
STREAMERS = [
    {"id": "jaeha010", "board_number": "42110606"},
    {"id": "yuambo", "board_number": "93146806"},
    {"id": "smkim82372", "board_number": "65560144"},
    {"id": "wk3220", "board_number": "79496724"},
    {"id": "meldoy777", "board_number": "108366731"},
    {"id": "star49", "board_number": "108901583"},
    {"id": "ahrum0912", "board_number": "122843945"},
    {"id": "tkek55", "board_number": "112452503"},
    {"id": "fhwm0602", "board_number": "114371465"},
    {"id": "zbxlzzz", "board_number": "13644761"},
    {"id": "iluvpp", "board_number": "91109284"},
    {"id": "callgg", "board_number": "329000"},
    {"id": "kimpooh0707", "board_number": "69409509"},
    {"id": "asy1218", "board_number": "113481743"},
]

MEMBERS = [
    {"name": "염보성", "id": "yuambo", "pos": "대표", "img": "https://storage2.ygosu.com/?code=S68dbfbfc3f44e8.21921692"},
    {"name": "후잉", "id": "jaeha010", "pos": "차장", "img": "https://storage2.ygosu.com/?code=S688d2e96622764.18115475"},
    {"name": "냥냥수주", "id": "star49", "pos": "대리", "img": "https://storage2.ygosu.com/?code=S69777860bfb1b2.15315971"},
    {"name": "류서하", "id": "smkim82372", "pos": "과장", "img": "https://storage2.ygosu.com/?code=S69f0a926dedb50.11272017"},
    {"name": "하랑짱", "id": "asy1218", "pos": "휴직", "img": "https://storage2.ygosu.com/?code=S696b61f365c0e3.11842146"},
    {"name": "미로", "id": "fhwm0602", "pos": "인턴", "img": "https://storage2.ygosu.com/?code=S69f0a947083819.23416908"},
    {"name": "소다", "id": "zbxlzzz", "pos": "번데기", "img": "https://storage2.ygosu.com/?code=S696b623ea18219.09523333"},
    {"name": "김유정", "id": "tkek55", "pos": "인턴장", "img": "https://storage2.ygosu.com/?code=S68ba9d207c63b1.00242878"},
    {"name": "백나현", "id": "wk3220", "pos": "팀장", "img": "https://storage2.ygosu.com/?code=S69ccd4724ffea8.45980531"},
    {"name": "아름", "id": "ahrum0912", "pos": "선임사원", "img": "https://storage2.ygosu.com/?code=S69f0a918af6ab2.84500064"},
    {"name": "서니", "id": "iluvpp", "pos": "시급이", "img": "https://storage2.ygosu.com/?code=S69f0a954b0c8f6.90064035"},
    {"name": "너의멜로디", "id": "meldoy777", "pos": "비서실장", "img": "https://storage2.ygosu.com/?code=S69cb6c7203b578.77318633"},
    {"name": "꺼니", "id": "callgg", "pos": "웨이터", "img": "https://storage2.ygosu.com/?code=S69f0a951064842.70871652"},
    {"name": "김푸", "id": "kimpooh0707", "pos": "웨이터", "img": "https://storage2.ygosu.com/?code=S69f0a94dc072d2.06945517"},
]

# --- 1. 공지사항 크롤러 ---
async def run_notices(page):
    all_notices = []
    for streamer in STREAMERS:
        try:
            # 기존 main.py의 크롤링 로직 생략(간결하게 유지)
            # (여기에 기존에 쓰시던 꼼꼼한 크롤링 로직을 넣으세요)
            pass
        except: pass
    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)

# --- 2. 라이브 상태 크롤러 ---
def run_live():
    lives = []
    for m in MEMBERS:
        url = f"https://api-channel.sooplive.com/v1.1/channel/{m['id']}/home/section/broad"
        try:
            res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5).json()
            if res and "broadNo" in res:
                lives.append({
                    "name": m["name"], "pos": m["pos"], "profile": m["img"],
                    "title": res.get("broadTitle", ""), "viewers": res.get("currentSumViewer", 0),
                    "thumb": f"https://liveimg.sooplive.com/h/{res['broadNo']}.webp",
                    "live_link": f"https://play.sooplive.com/{m['id']}/{res['broadNo']}"
                })
        except: pass
    
    # [핵심] HTML이 요구하는 구조로 감싸서 저장
    data = {
        "live_count": len(lives),
        "total_count": len(MEMBERS),
        "lives": lives
    }
    with open("live.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# --- 메인 실행 ---
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await run_notices(page)
        await browser.close()
    
    run_live()
    print("업데이트 완료")

if __name__ == "__main__":
    asyncio.run(main())