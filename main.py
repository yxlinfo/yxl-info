import requests
from bs4 import BeautifulSoup
import json
import os

streamer_boards = {
    "후잉♥": "https://www.sooplive.com/station/jaeha010/board/42110606",
    "류서하♥": "https://www.sooplive.com/station/smkim82372/board/65560144",
    "백나현": "https://www.sooplive.com/station/wk3220/board/79496724",
    "너의˚멜로디": "https://www.sooplive.com/station/meldoy777/board/108366731",
    "냥냥수주": "https://www.sooplive.com/station/star49/board/121609123",
    "하랑짱♥": "https://www.sooplive.com/station/asy1218/board/113481743",
    "ZO아름♡": "https://www.sooplive.com/station/ahrum0912/board/122843945",
    "김유정S2": "https://www.sooplive.com/station/tkek55/board/112452503",
    "미로。": "https://www.sooplive.com/station/fhwm0602/board/92166558",
    "소다♥": "https://www.sooplive.com/station/zbxlzzz/board/13644761",
    "서니_♥": "https://www.sooplive.com/station/iluvpp/board/91109284",
    "꺼니": "https://www.sooplive.com/station/callgg/board/329000",
    "김푸:)": "https://www.sooplive.com/station/kimpooh0707/board/69409509"
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

notice_list = []

for author, url in streamer_boards.items():
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 'Post_post__'로 시작하는 클래스 검색
        posts = soup.select('li[class^="Post_post__"]')
        
        if posts:
            latest_post = posts[0] # 가장 최신 글 1개
            title_element = latest_post.select_one('[class^="ContentTitle_title__"]')
            
            if title_element:
                is_notice = True if title_element.select_one('[class^="ContentTitle_noti__"]') else False
                title_spans = title_element.find_all('span')
                title = title_spans[-1].text.strip() if title_spans else title_element.text.strip()
                
                date_element = latest_post.select_one('[class^="Interaction_details__"] > div:last-child span')
                date = date_element.text.strip() if date_element else ''
                formatted_date = date[5:10].replace('-', '.') if len(date) >= 10 else date
                
                notice_list.append({
                    "type": "notice" if is_notice else "normal",
                    "title": title,
                    "author": author,
                    "date": formatted_date
                })
        print(f"[{author}] Success")
    except Exception as e:
        print(f"[{author}] Error: {e}")

# JSON 파일로 저장 (현재 스크립트 실행 위치 기준)
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notice_data.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(notice_list, f, ensure_ascii=False, indent=4)

print("Scraping completed and JSON saved.")