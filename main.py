import requests
import json

def update_notices():
    targets = [
        {"id": "jaeha010", "board_no": "103"}  # 여러 스트리머가 있으면 콤마로 계속 추가하세요.
    ]
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
        
        url = f"https://chapi.sooplive.com/api/{bj_id}/board/?per_page=2&start_date=&end_date=&field=title,contents,user_nick,user_id,hashtags&keyword=&type=all&order_by=reg_date&board_number={board_no}&page=1"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                
                if "data" not in data or not data["data"]:
                    print(f"[{bj_id}] 게시글이 없습니다. 서버 응답: {data}")
                
                for item in data.get("data", [])[:2]:
                    # 이미지 URL 앞에 https: 붙이기
                    thumbnail = f"https:{item['photos'][0]['url']}" if item.get('photos') else None
                    profile_img = f"https:{item['profile_image']}" if item.get('profile_image') else None
                    
                    # 카드와 모달에 들어갈 모든 데이터를 알뜰하게 긁어옵니다.
                    all_notices.append({
                        "id": item["bbs_no"],
                        "user_nick": item["user_nick"],
                        "profile_image": profile_img,
                        "title": item["title_name"],
                        "date": item["reg_date"],
                        "summary": item["text_content"][:80] + "...",
                        "thumbnail": thumbnail,
                        "read_cnt": item["count"]["read_cnt"],
                        "vod_read_cnt": item["count"]["vod_read_cnt"],
                        "comment_cnt": item["count"]["comment_cnt"],
                        "like_cnt": item["count"]["like_cnt"],
                        "photo_cnt": item["photo_cnt"],
                        "full_html": item["content"]["content"] # 원본 사진/글씨체 100% 저장
                    })
                print(f"[{bj_id}] 공지사항 수집 완료!")
            else:
                print(f"[{bj_id}] 서버 에러 코드: {response.status_code}")
                
        except Exception as e:
            print(f"[{bj_id}] 실행 중 에러: {e}")

    # 최신 시간순으로 정렬해서 notices.json으로 구워냅니다.
    all_notices.sort(key=lambda x: x["date"], reverse=True)
    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)
    print("notices.json 갱신 완료!")

if __name__ == "__main__":
    update_notices()