import requests
import sqlite3

def save_notice():
    # 타겟 API URL
    url = "https://chapi.sooplive.com/api/asy1218/board/113481743?per_page=5&order_by=reg_date&page=1"
    response = requests.get(url).json()
    latest_post = response['data'][0] # 가장 최신 글 1개
    
    new_title_no = latest_post['title_no']
    
    conn = sqlite3.connect('yxlinfo.db')
    cursor = conn.cursor()
    
    # 마지막으로 저장된 ID 확인
    cursor.execute("SELECT last_title_no FROM sync_metadata WHERE user_id = 'asy1218'")
    row = cursor.fetchone()
    last_id = row[0] if row else 0
    
    # 새 글이 감지되면 저장
    if new_title_no > last_id:
        cursor.execute('''
            INSERT OR IGNORE INTO streamer_notices 
            (title_no, user_nick, title_name, content_summary, reg_date)
            VALUES (?, ?, ?, ?, ?)
        ''', (new_title_no, latest_post['user_nick'], latest_post['title_name'], 
              latest_post['content']['summary'], latest_post['reg_date']))
        
        cursor.execute('''
            INSERT OR REPLACE INTO sync_metadata (user_id, last_title_no)
            VALUES (?, ?)
        ''', ('asy1218', new_title_no))
        
        conn.commit()
        print(f"새 공지 저장 완료: {latest_post['title_name']}")
    else:
        print("최신 공지 없음")
        
    conn.close()

if __name__ == "__main__":
    save_notice()