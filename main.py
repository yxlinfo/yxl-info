import requests
from bs4 import BeautifulSoup
import json

# 1. 아까 알려주신 스트리머별 게시판 주소 목록
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

# 봇 차단을 막기 위한 일반 브라우저 헤더 세팅
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

notice_list = []

print("데이터 크롤링을 시작합니다...")

# 2. 각 스트리머 게시판을 순회하며 데이터 추출
for author, url in streamer_boards.items():
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 'Post_post__'로 시작하는 모든 리스트(게시글) 찾기 (안전한 부분 일치 검색)
        posts = soup.select('li[class^="Post_post__"]')
        
        # 최신 글 1~2개만 가져오기 원하신다면 [:2] 등으로 조절 가능합니다.
        # 여기서는 가장 첫 번째(최신) 게시글 1개씩만 가져오도록 설정했습니다.
        if posts:
            latest_post = posts[0]
            
            # 제목 및 공지 여부 찾기 ('ContentTitle_title__'로 시작)
            title_element = latest_post.select_one('[class^="ContentTitle_title__"]')
            
            if title_element:
                # 공지 뱃지 확인
                is_notice = True if title_element.select_one('[class^="ContentTitle_noti__"]') else False
                
                # 제목 추출 (span 태그 안의 텍스트)
                title_spans = title_element.find_all('span')
                title = title_spans[-1].text.strip() if title_spans else title_element.text.strip()
                
                # 작성일 추출 (Interaction_details__ 하위의 날짜)
                date_element = latest_post.select_one('[class^="Interaction_details__"] > div:last-child span')
                date = date_element.text.strip() if date_element else ''
                
                # "2026-05-24" 포맷을 "05.24"로 변경
                formatted_date = date[5:10].replace('-', '.') if len(date) >= 10 else date
                
                # 리스트에 데이터 추가
                notice_list.append({
                    "type": "notice" if is_notice else "normal",
                    "title": title,
                    "author": author,
                    "date": formatted_date
                })
                
        print(f"[{author}] 크롤링 완료")
        
    except Exception as e:
        print(f"[{author}] 크롤링 실패: {e}")

# 3. 추출한 데이터를 index.html이 읽을 수 있게 json 파일로 저장
output_filename = 'notice_data.json'
with open(output_filename, 'w', encoding='utf-8') as f:
    json.dump(notice_list, f, ensure_ascii=False, indent=4)

print(f"\n모든 작업이 완료되었습니다. 결과가 '{output_filename}'에 저장되었습니다.")