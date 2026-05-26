import requests
import json

def update_notices():
    targets = [{"id": "jaeha010", "board_no": "103"}]
    all_notices = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.sooplive.com"
    }

    for target in targets:
        bj_id = target["id"]
        board_no = target["board_no"]
        headers["Referer"] = f"https://www.sooplive.com/station/{bj_id}/board"
        url = f"https://chapi.sooplive.com/api/{bj_id}/board/?per_page=2&board_number={board_no}&page=1"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("data", [])[:2]:
                    all_notices.append({
                        "id": item["bbs_no"],
                        "user_id": item["user_id"],
                        "user_nick": item["user_nick"],
                        "profile_image": f"https:{item['profile_image']}" if item.get('profile_image') else None,
                        "title": item["title_name"],
                        "date": item["reg_date"],
                        "summary": item["text_content"][:80] + "...",
                        "thumbnail": f"https:{item['photos'][0]['url']}" if item.get('photos') else None,
                        "read_cnt": item["count"]["read_cnt"],
                        "vod_read_cnt": item["count"]["vod_read_cnt"],
                        "comment_cnt": item["count"]["comment_cnt"],
                        "like_cnt": item["count"]["like_cnt"],
                        "photo_cnt": item["photo_cnt"]
                    })
        except Exception as e:
            print(f"[{bj_id}] 에러: {e}")

    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    update_notices()