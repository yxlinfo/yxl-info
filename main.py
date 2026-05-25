import requests, sqlite3, os

def run():
    url = "https://chapi.sooplive.com/api/jaeha010/board/?per_page=4&order_by=reg_date&page=1"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://ch.sooplive.com/jaeha010"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        items = data.get('data', [])
        
        conn = sqlite3.connect('yxlinfo.db')
        cursor = conn.cursor()
        
        for item in items:
            # 썸네일 추출 (photos가 있으면 첫 번째 사용)
            thumb = 'https:' + item['photos'][0]['url'] if item.get('photos') else ''
            
            cursor.execute('''INSERT OR REPLACE INTO streamer_notices VALUES (?,?,?,?,?,?,?,?,?)''',
                           (item['title_no'], item['user_nick'], 'https:' + item['profile_image'], 
                            thumb, item['title_name'], item['content']['summary'], 
                            item['count']['read_cnt'], item['count']['comment_cnt'], item['reg_date']))
        conn.commit()
        
        # HTML 빌드
        cursor.execute("SELECT * FROM streamer_notices ORDER BY reg_date DESC LIMIT 4")
        rows = cursor.fetchall()
        
        html = '''<html><head><meta charset="UTF-8"><style>
            .wrap { display: flex; gap: 15px; font-family: sans-serif; padding: 20px; }
            .card { border: 1px solid #eee; border-radius: 16px; padding: 20px; width: 350px; background: #f9f9f9; display: flex; gap: 15px; }
            .content-area { flex: 1; }
            .header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
            .prof { width: 32px; height: 32px; border-radius: 50%; }
            .thumb { width: 80px; height: 80px; border-radius: 12px; object-fit: cover; }
            .stats { color: #888; font-size: 13px; margin-top: 10px; }
        </style></head><body><div class="wrap">'''
        
        for r in rows:
            html += f'''
            <div class="card">
                <div class="content-area">
                    <div class="header"><img src="{r[2]}" class="prof"> <b>{r[1]}</b></div>
                    <div style="font-weight:bold; margin-bottom:5px;">{r[4]}</div>
                    <div style="font-size:13px; color:#555; height:40px; overflow:hidden;">{r[5]}</div>
                    <div class="stats">💬 {r[7]} · 👁 {r[6]}</div>
                </div>
                <img src="{r[3]}" class="thumb">
            </div>'''
        
        html += '</div></body></html>'
        with open("index.html", "w", encoding="utf-8") as f: f.write(html)
        conn.close()
    except Exception as e: print(f"Error: {e}")

if __name__ == "__main__": run()