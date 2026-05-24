import sqlite3
from playwright.sync_api import sync_playwright

# 1. 설정: 수집할 스트리머 리스트
TARGET_STREAMERS = [
    {"name": "후잉♥", "url": "https://www.sooplive.com/station/jaeha010/board/42110606"},
    {"name": "류서하♥", "url": "https://www.sooplive.com/station/smkim82372/board/65560144"},
    {"name": "백나현", "url": "https://www.sooplive.com/station/wk3220/board/79496724"},
    {"name": "너의˚멜로디", "url": "https://www.sooplive.com/station/meldoy777/board/108366731"},
    {"name": "냥냥수주", "url": "https://www.sooplive.com/station/star49/board/121609123"},
    {"name": "하랑짱♥", "url": "https://www.sooplive.com/station/asy1218/board/113481743"},
    {"name": "ZO아름♡", "url": "https://www.sooplive.com/station/ahrum0912/board/122843945"},
    {"name": "김유정S2", "url": "https://www.sooplive.com/station/tkek55/board/112452503"},
    {"name": "미로。", "url": "https://www.sooplive.com/station/fhwm0602/board/92166558"},
    {"name": "소다♥", "url": "https://www.sooplive.com/station/zbxlzzz/board/13644761"},
    {"name": "서니_♥", "url": "https://www.sooplive.com/station/iluvpp/91109284"},
    {"name": "꺼니", "url": "https://www.sooplive.com/station/callgg/board/329000"},
    {"name": "김푸:)", "url": "https://www.sooplive.com/station/kimpooh0707/board/69409509"}
]

# 2. DB 초기화
def init_db():
    conn = sqlite3.connect('notices.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            streamer_name TEXT,
            title TEXT,
            post_date TEXT,
            link TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# 3. 크롤링 및 DB 저장
def fetch_and_save():
    init_db()
    conn = sqlite3.connect('notices.db')
    cursor = conn.cursor()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for streamer in TARGET_STREAMERS:
            print(f"[{streamer['name']}] 수집 중...")
            try:
                page.goto(streamer['url'])
                # 게시판 테이블이 로드될 때까지 대기
                page.wait_for_selector("table.board_list", timeout=10000)
                
                # 첫 번째 게시물 데이터 가져오기
                row = page.query_selector("table.board_list tbody tr")
                if row:
                    title_elem = row.query_selector("td.title a")
                    date_elem = row.query_selector("td.date")
                    
                    if title_elem and date_elem:
                        title = title_elem.inner_text().strip()
                        link = "https://www.sooplive.com" + title_elem.get_attribute("href")
                        date = date_elem.inner_text().strip()

                        # 중복 여부 확인 후 저장
                        cursor.execute("SELECT id FROM announcements WHERE link = ?", (link,))
                        if not cursor.fetchone():
                            cursor.execute(
                                "INSERT INTO announcements (streamer_name, title, post_date, link) VALUES (?, ?, ?, ?)",
                                (streamer['name'], title, date, link)
                            )
                            print(f" -> 새 글 발견: {title}")
                            conn.commit()
            except Exception as e:
                print(f" -> 에러 발생 ({streamer['name']}): {e}")
        
        browser.close()
    
    conn.close()
    print("작업 완료.")

if __name__ == "__main__":
    fetch_and_save()