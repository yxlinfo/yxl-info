def update_notices():
    bj_ids = ["jaeha010"] # 여러 명일 경우 콤마로 구분하여 추가
    all_notices = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.sooplive.com"
    }

    for bj_id in bj_ids:
        headers["Referer"] = f"https://www.sooplive.com/station/{bj_id}/board"
        
        # 원래 알려주셨던 파라미터를 모두 포함한 주소로 복구 (갯수만 per_page=2로 수정)
        url = f"https://chapi.sooplive.com/api/{bj_id}/board/?per_page=2&start_date=&end_date=&field=title,contents,user_nick,user_id,hashtags&keyword=&type=all&order_by=reg_date&board_number=&page=1"
        
        try:
            response = requests.get(url, headers=headers)
            print(f"[{bj_id}] 연결 상태: {response.status_code}") # 200이 나오면 정상 연결
            
            if response.status_code == 200:
                data = response.json()
                
                # 만약 서버가 빈 데이터를 줬을 경우 로그에 원본 응답을 출력
                if "data" not in data or not data["data"]:
                    print(f"[{bj_id}] 서버 응답은 정상이나 게시글이 없습니다. 서버 응답값: {data}")
                
                for item in data.get("data", [])[:2]:
                    # 썸네일 URL 처리
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
            print(f"[{bj_id}] 실행 중 에러: {e}")

    # 최신 날짜순 정렬 후 JSON 저장
    all_notices.sort(key=lambda x: x["date"], reverse=True)
    with open("notices.json", "w", encoding="utf-8") as f:
        json.dump(all_notices, f, ensure_ascii=False, indent=4)
    print("notices.json 갱신 완료!")