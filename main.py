import json
import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

OUTPUT_FILE = "notices.json"

STREAMERS = [
    "jaeha010"
]

async def crawl_notice(page, user_id):
    captured = []

    async def handle_response(response):
        if "chapi.sooplive.com" in response.url and "/board/" in response.url:
            try:
                data = await response.json()
                captured.extend(data.get("data", []))
            except Exception:
                pass

    page.on("response", handle_response)

    try:
        await page.goto(
            f"https://www.sooplive.com/station/{user_id}/board",
            wait_until="networkidle",
            timeout=20000
        )
    except Exception as e:
        print(f"[페이지 오류] {user_id}: {e}")

    notices = []
    for item in captured[:10]:
        notice = {
            "id": item.get("title_no"),
            "user_id": user_id,
            "user_nick": item.get("user_nick", ""),
            "profile_image": item.get("profile_image", ""),
            "title": item.get("title", ""),
            "date": item.get("reg_date", ""),
            "summary": BeautifulSoup(
                item.get("contents", ""),
                "html.parser"
            ).get_text(strip=True)[:120],
            "thumbnail": item.get("thumb", ""),
            "read_cnt": item.get("read_cnt", 0),
            "vod_read_cnt": item.get("vod_read_cnt", 0),
            "comment_cnt": item.get("comment_cnt", 0),
            "like_cnt": item.get("like_cnt", 0),
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
