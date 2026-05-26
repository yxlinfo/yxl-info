import requests
import json
import os

def update_notices():
    # 스트리머 아이디와 공지사항 게시판 번호(103) 설정
    targets = [
        {"id": "jaeha010", "board_no": "103"}  
    ]
    all_notices = []

    # 브라우저 위장 헤더
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.sooplive.com"
    }

    for target in targets:
        bj_id = target["id"]
        board_no = target["board_no"]
        
        headers["Referer"] = f"https://www.sooplive.com/station/{bj_id}/board"
        
        # 특정 게시판(103) 번호를 정확히 호출
        url = f"https://chapi.sooplive.com/api/{bj_id}/board/?per_page=2&start_date=&end_date=&field=title,contents,user_nick,user_id,hashtags&keyword=&type=all&order_by=reg_date&board_number={board_no}&page=1"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                
                # 빈 데이터 응답 시 에러 메시지 출력
                if "data" not in data or not data["data"]:
                    print(f"[{bj_id}] 게시글이 없습니다. 서버 응답: {data}")
                
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
                print(f"[{bj_id}] 공지사항 수집 완료!")
            else:
                print(f"[{bj_id}] 서버 에러 코드: {response.status_code}")
                
        except Exception as e:
            print(f"[{bj_id}] 실행 중 에러: {e}")

    # 최신 날짜순 정렬 후 JSON 파일로 저장
    all_notices.sort(key=lambda x: x["date"], reverse=True)
    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)
    print("notices.json 갱신 완료!")

if __name__ == "__main__":
    # 기존에 다른 업데이트 함수가 있다면 이 위에 함께 배치하세요.
    update_notices()