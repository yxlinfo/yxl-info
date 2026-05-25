import sqlite3

def init_notice_db():
    conn = sqlite3.connect('yxlinfo.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS streamer_notices (
            title_no INTEGER PRIMARY KEY,
            user_nick TEXT,
            profile_image TEXT,
            thumbnail_url TEXT,
            title_name TEXT,
            content_summary TEXT,
            read_cnt INTEGER,
            comment_cnt INTEGER,
            reg_date TEXT
        )
    ''')
    conn.commit()
    conn.close()
    print("DB 생성 완료")

if __name__ == "__main__":
    init_notice_db()