import sqlite3

def init_notice_db():
    conn = sqlite3.connect('yxlinfo.db')
    cursor = conn.cursor()
    
    # 1. 게시글 저장 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS streamer_notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title_no INTEGER UNIQUE,
            user_nick TEXT,
            title_name TEXT,
            content_summary TEXT,
            reg_date TEXT
        )
    ''')
    
    # 2. 마지막 게시글 ID 관리 테이블 (업데이트 체크용)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sync_metadata (
            user_id TEXT PRIMARY KEY,
            last_title_no INTEGER
        )
    ''')
    
    conn.commit()
    conn.close()
    print("DB 생성 완료")

if __name__ == "__main__":
    init_notice_db()