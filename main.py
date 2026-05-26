import json
import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

OUTPUT_FILE = "notices.json"

STREAMERS = [
    "jaeha010"
]

async def crawl_notice(page, user_id):
    try:
        # 요청을 가로채서 field에 thumb 추가
        async def modify_request(route, request):
            url = request.url
            if "chapi.sooplive.com" in url and "/board/" in url:
                if "thumb" not in url:
                    url = url.replace(
                        "field=title,contents,user_nick,user_id,hashtags",
                        "field=title,contents,user_nick,user_id,hashtags,thumb"
                    )
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

        response = await response_info.value
        data = await response.json()
        items = data.get("data", [])

    except Exception as e:
        print(f"[오류] {user_id}: {e}")
        return []

    notices = []
    for item in items[:10]:
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
