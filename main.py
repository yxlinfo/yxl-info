import requests
import json
import os

# 기존 랭킹 업데이트 코드들...
# ...

# [추가할 부분] 공지사항 크롤링 및 저장 함수
def update_notices():
    # 스트리머 아이디 목록 (예시)
    bj_ids = ["jaeha010"] # 여러 명일 경우 콤마로 추가
    all_notices = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.sooplive.com"
    }

    for bj_id in bj_ids:
        headers["Referer"] = f"https://www.sooplive.com/station/{bj_id}/board"
        url = f"https://chapi.sooplive.com/api/{bj_id}/board/?per_page=2&page=1"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("data", [])[:2]:
                    thumbnail = f"https:{item['photos'][0]['url']}" if item.get('photos') else None
                    all_notices.append({
                        "id": item["bbs_no"],
                        "title": item["title_name"],
                        "date": item["reg_date"],
                        "summary": item["text_content"][:100] + "...",
                        "thumbnail": thumbnail,
                        "full_html": item["content"]["content"]
                    })
        except Exception as e:
            print(f"Error fetching {bj_id}: {e}")

    # 최신 날짜순으로 정렬
    all_notices.sort(key=lambda x: x["date"], reverse=True)

    # JSON 파일로 저장
    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)
    print("notices.json 업데이트 완료!")

# 스크립트 실행 시 공지사항도 함께 업데이트되도록 호출
if __name__ == "__main__":
    # 기존 데이터베이스 업데이트 함수 호출()
    update_notices()