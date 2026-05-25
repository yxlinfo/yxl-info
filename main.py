import requests, sqlite3

def run():
    url = "https://chapi.sooplive.com/api/jaeha010/board/?per_page=4&order_by=reg_date&page=1"
    
    # 봇 차단을 우회하기 위한 필수 헤더
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://ch.sooplive.com/jaeha010"
    }
    
    try:
        # 응답을 먼저 받고, 그 다음에 JSON으로 변환
        response = requests.get(url, headers=headers, timeout=10)
        
        # 1. 상태코드 확인
        if response.status_code != 200:
            print(f"서버가 요청을 거부했습니다. 상태코드: {response.status_code}")
            return
            
        data = response.json()
        items = data.get('data', [])
        
        if not items:
            print("데이터가 없습니다.")
            return

        conn = sqlite3.connect('yxlinfo.db')
        cursor = conn.cursor()
        
        # DB 업데이트
        for item in items:
            cursor.execute('''INSERT OR REPLACE INTO streamer_notices VALUES (?,?,?,?,?,?,?)''',
                           (item['title_no'], item['user_nick'], 'https:' + item['profile_image'], 
                            item['title_name'], item['count']['read_cnt'], 
                            item['count']['comment_cnt'], item['reg_date']))
        conn.commit()
        
        # HTML 생성 로직(생략된 부분)
        cursor.execute("SELECT * FROM streamer_notices ORDER BY reg_date DESC LIMIT 4")
        rows = cursor.fetchall()
        
        html = '<html><head><meta charset="UTF-8"><style>.wrap{display:flex; gap:15px; font-family:sans-serif;} .card{border:1px solid #ddd; padding:15px; width:220px; border-radius:12px; box-shadow: 2px 2px 8px #eee;} .prof{width:40px; height:40px; border-radius:50%;} .stats{color:#888; font-size:12px; margin-top:10px;} </style></head><body><div class="wrap">'
        for r in rows:
            html += f'<div class="card"><img src="{r[2]}" class="prof"> <b>{r[1]}</b><br><div style="height:40px; overflow:hidden;">{r[3]}</div><div class="stats">👁 {r[4]} 💬 {r[5]}</div></div>'
        html += '</div></body></html>'
        
        with open("index.html", "w", encoding="utf-8") as f: f.write(html)
        print("index.html 빌드 성공")
        conn.close()
        
    except Exception as e:
        print(f"에러 발생: {e}")
        # 응답 내용을 출력해보면 서버가 왜 화가 났는지 알 수 있습니다.
        if 'response' in locals():
            print(f"응답 본문 확인: {response.text[:200]}")

if __name__ == "__main__": run()