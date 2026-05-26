import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime

OUTPUT_FILE = "notices.json"

# 테스트용 스트리머 ID 목록
STREAMERS = [
    "jaeha010"
]

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}


def crawl_notice(user_id):
    try:
        url = f"https://bjapi.sooplive.co.kr/api/{user_id}/board"

        response = requests.get(url, headers=HEADERS)
        data = response.json()

        notices = []

        for item in data.get("data", [])[:10]:
            notice = {
                "id": item.get("title_no"),
                "user_id": user_id,
                "user_nick": item.get("writer_nick", ""),
                "profile_image": item.get("profile_image", ""),
                "title": item.get("title", ""),
                "date": item.get("reg_date", ""),
                "summary": BeautifulSoup(
                    item.get("content", ""),
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

        return notices

    except Exception as e:
        print(f"[ERROR] {user_id}: {e}")
        return []


def main():
    all_notices = []

    for streamer in STREAMERS:
        notices = crawl_notice(streamer)
        all_notices.extend(notices)

    # 최신순 정렬
    all_notices.sort(
        key=lambda x: x.get("date", ""),
        reverse=True
    )

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            all_notices,
            f,
            ensure_ascii=False,
            indent=4
        )

    print(f"[완료] notices.json 저장 완료 ({len(all_notices)}개)")


if __name__ == "__main__":
    main()