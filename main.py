import json
import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

OUTPUT_FILE = "notices.json"

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

async def crawl_notice(page, streamer):
    user_id = streamer["id"]
    board_number = streamer["board_number"]

    try:
        async def modify_request(route, request):
            url = request.url
            if "chapi.sooplive.com" in url and "/board/" in url:
                url = url.replace(
                    "field=title,contents,user_nick,user_id,hashtags",
                    "field=title_name,contents,user_nick,user_id,profile_image,photo_cnt,notice_yn,photos,reg_date"
                )
                url = url.replace("per_page=20", "per_page=1")
                if "board_number=" in url:
                    import re
                    url = re.sub(r"board_number=[^&]*", f"board_number={board_number}", url)
                await route.continue_(url=url)
            else:
                await route.continue_()

        await page.route("**/*", modify_request)

        async with page.expect_response(
            lambda r: "chapi.sooplive.com" in r.url and "/board/" in r.url,
            timeout=15000
        ) as response_info:
            await page.goto(
                f"https://www.sooplive.com/station/{user_id}/board",
                wait_until="domcontentloaded",
                timeout=20000
            )

        await page.unroute("**/*")

        response = await response_info.value
        data = await response.json()
        items = data.get("data", [])

    except Exception as e:
        print(f"[오류] {user_id}: {e}")
        await page.unroute("**/*")
        return []

    notices = []
    for item in items[:1]:
        photos = item.get("photos", [])
        thumbnail = ("https:" + photos[0]["url"]) if photos else ""

        profile = item.get("profile_image", "")
        if profile.startswith("//"):
            profile = "https:" + profile

        count = item.get("count", {})

        notice = {
            "id": item.get("title_no"),
            "user_id": user_id,
            "user_nick": item.get("user_nick", ""),
            "profile_image": profile,
            "title": item.get("title_name", ""),
            "date": item.get("reg_date", ""),
            "notice_yn": item.get("notice_yn", 0),
            "thumbnail": thumbnail,
            "like_cnt": count.get("like_cnt", 0),
            "read_cnt": count.get("read_cnt", 0),
            "comment_cnt": count.get("comment_cnt", 0),
            "photo_cnt": item.get("photo_cnt", 0)
        }
        notices.append(notice)

    print(f"[성공] {user_id}: {len(notices)}개 수집")
    return notices

async def main():
    all_notices = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        for streamer in STREAMERS:
            notices = await crawl_notice(page, streamer)
            all_notices.extend(notices)

        await browser.close()

    all_notices.sort(key=lambda x: x.get("date", ""), reverse=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)

    print(f"[완료] notices.json 저장 완료 ({len(all_notices)}개)")

if __name__ == "__main__":
    asyncio.run(main())
