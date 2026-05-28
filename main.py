import json
import re
import asyncio
import requests
from playwright.async_api import async_playwright

# 1. 공지사항 설정 (기존 main.py 내용)
OUTPUT_NOTICES = "notices.json"
STREAMERS = [
    {"id": "jaeha010",    "board_number": "42110606"},
    {"id": "yuambo",      "board_number": "93146806"},
    {"id": "smkim82372",  "board_number": "65560144"},
    {"id": "wk3220",      "board_number": "79496724"},
    {"id": "meldoy777",   "board_number": "108366731"},
    {"id": "star49",      "board_number": "108901583"},
    {"id": "ahrum0912",   "board_number": "122843945"},
    {"id": "tkek55",      "board_number": "112452503"},
    {"id": "fhwm0602",    "board_number": "114371465"},
    {"id": "zbxlzzz",     "board_number": "13644761"},
    {"id": "iluvpp",      "board_number": "91109284"},
    {"id": "callgg",      "board_number": "329000"},
    {"id": "kimpooh0707", "board_number": "69409509"},
    {"id": "asy1218",     "board_number": "113481743"},
]

# 2. 라이브 상태 설정 (기존 live.py 내용)
OUTPUT_LIVE = "live.json"
MEMBERS = [
    {"name": "염보성",    "id": "yuambo",        "pos": "대표"},
    {"name": "후잉",      "id": "jaeha010",       "pos": "차장"},
    {"name": "냥냥수주",  "id": "star49",          "pos": "대리"},
    {"name": "류서하",    "id": "smkim82372",      "pos": "과장"},
    {"name": "하랑짱",    "id": "asy1218",         "pos": "휴직"},
    {"name": "미로",      "id": "fhwm0602",        "pos": "인턴"},
    {"name": "소다",      "id": "zbxlzzz",         "pos": "번데기"},
    {"name": "김유정",    "id": "tkek55",          "pos": "인턴장"},
    {"name": "백나현",    "id": "wk3220",          "pos": "팀장"},
    {"name": "아름",      "id": "ahrum0912",       "pos": "선임사원"},
    {"name": "서니",      "id": "iluvpp",          "pos": "시급이"},
    {"name": "너의멜로디","id": "meldoy777",        "pos": "비서실장"},
    {"name": "꺼니",      "id": "callgg",          "pos": "웨이터"},
    {"name": "김푸",      "id": "kimpooh0707",     "pos": "웨이터"},
]

# --- 공지사항 크롤링 함수 ---
async def crawl_notices(page):
    all_notices = []
    for streamer in STREAMERS:
        try:
            user_id = streamer["id"]
            board_number = streamer["board_number"]
            
            # Request 라우팅 및 데이터 수집 로직 (기존 main.py와 동일)
            async def modify_request(route, request):
                url = request.url
                if "chapi.sooplive.com" in url and "/board/" in url:
                    url = url.replace("field=title,contents,user_nick,user_id,hashtags", "field=title_name,contents,user_nick,user_id,profile_image,photo_cnt,notice_yn,photos,reg_date")
                    url = url.replace("per_page=20", "per_page=1")
                    url = re.sub(r"board_number=[^&]*", f"board_number={board_number}", url)
                    await route.continue_(url=url)
                else:
                    await route.continue_()

            await page.route("**/*", modify_request)
            async with page.expect_response(lambda r: "chapi.sooplive.com" in r.url and "/board/" in r.url, timeout=15000) as response_info:
                await page.goto(f"https://www.sooplive.com/station/{user_id}/board", wait_until="domcontentloaded", timeout=20000)
            
            await page.unroute("**/*")
            data = await (await response_info.value).json()
            items = [i for i in data.get("data", []) if str(i.get("bbs_no", "")) == str(board_number)]
            
            if items:
                item = items[0]
                all_notices.append({
                    "id": item.get("title_no"),
                    "user_id": user_id,
                    "user_nick": item.get("user_nick", ""),
                    "title": item.get("title_name", ""),
                    "date": item.get("reg_date", "")
                })
        except Exception as e:
            print(f"[오류] {streamer['id']}: {e}")
            await page.unroute("**/*")
    
    with open(OUTPUT_NOTICES, "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)
    print(f"✅ notices.json 저장 완료 ({len(all_notices)}개)")

# --- 라이브 상태 확인 함수 ---
def crawl_lives():
    live_list = []
    for m in MEMBERS:
        url = f"https://api-channel.sooplive.com/v1.1/channel/{m['id']}/home/section/broad"
        try:
            res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5).json()
            if res and "broadNo" in res:
                live_list.append({
                    "name": m["name"],
                    "pos": m["pos"],
                    "viewers": res.get("currentSumViewer", 0),
                    "live_link": f"https://play.sooplive.com/{m['id']}/{res['broadNo']}"
                })
        except: pass
    with open(OUTPUT_LIVE, "w", encoding="utf-8") as f:
        json.dump(live_list, f, ensure_ascii=False, indent=4)
    print(f"✅ live.json 저장 완료 (라이브 {len(live_list)}명)")

# --- 메인 실행 ---
async def main():
    print("🚀 데이터 수집을 시작합니다...")
    
    # 1. 공지사항 (Playwright 필요)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await crawl_notices(page)
        await browser.close()
    
    # 2. 라이브 상태 (requests)
    crawl_lives()
    
    print("🎉 모든 작업이 완료되었습니다.")

if __name__ == "__main__":
    asyncio.run(main())