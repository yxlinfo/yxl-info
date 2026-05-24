import requests
from bs4 import BeautifulSoup
import json
import os

# 스트리머 방송국 메인 주소만 있으면 됩니다 (이제 게시판 주소록 불필요)
streamer_stations = {
    "후잉♥": "https://www.sooplive.com/station/jaeha010",
    "류서하♥": "https://www.sooplive.com/station/smkim82372",
    "백나현": "https://www.sooplive.com/station/wk3220",
    "너의˚멜로디": "https://www.sooplive.com/station/meldoy777",
    "냥냥수주": "https://www.sooplive.com/station/star49",
    "하랑짱♥": "https://www.sooplive.com/station/asy1218",
    "ZO아름♡": "https://www.sooplive.com/station/ahrum0912",
    "김유정S2": "https://www.sooplive.com/station/tkek55",
    "미로。": "https://www.sooplive.com/station/fhwm0602",
    "소다♥": "https://www.sooplive.com/station/zbxlzzz",
    "서니_♥": "https://www.sooplive.com/station/iluvpp",
    "꺼니": "https://www.sooplive.com/station/callgg",
    "김푸:)": "https://www.sooplive.com/station/kimpooh0707"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

notice_list = []

for author, base_url in streamer_stations.items():
    try:
        # 게시판(board) 주소로 접속
        board_url = f"{base_url}/board"
        response = requests.get(board_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        posts = soup.select('li[class^="Post_post__"]')
        
        if posts:
            latest_post = posts[0]
            
            # 제목 및 공지 여부
            title_box = latest_post.select_one('[class^="ContentTitle_title__"]')
            if title_box:
                is_notice = True if title_box.select_one('[class^="ContentTitle_noti__"]') else False
                title = title_box.find_all('span')[-1].text.strip()
                
                # 게시글 고유 링크 추출 (a 태그 href)
                link_tag = latest_post.select_one('a[href^="/station/"]')
                full_link = f"https://www.sooplive.com{link_tag['href']}" if link_tag else "#"
                
                # 날짜
                date_box = latest_post.select_one('[class^="Interaction_details__"]')
                date_text = date_box.find_all('span')[-1].text.strip()
                
                notice_list.append({
                    "type": "notice" if is_notice else "normal",
                    "title": title,
                    "author": author,
                    "date": date_text[5:],
                    "link": full_link # 상세 페이지 링크 저장
                })
        print(f"[OK] {author}")
    except Exception as e:
        print(f"[Error] {author}: {e}")

# JSON 저장
with open('notice_data.json', 'w', encoding='utf-8') as f:
    json.dump(notice_list, f, ensure_ascii=False, indent=4)