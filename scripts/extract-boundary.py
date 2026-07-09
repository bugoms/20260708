# -*- coding: utf-8 -*-
"""
역삼동(역삼1동+역삼2동) 행정 경계 추출 스크립트

데이터: vuski/admdongkor (행정안전부 행정동 경계 기반, 정기 갱신)
출력: public/boundary.json  { rings: [ [lng,lat][] , ... ] }

OSM 경계는 저해상도 직선 근사라 사용하지 않음.
사용법: python scripts/extract-boundary.py
"""
import urllib.request, json, os

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(BASE_DIR, 'public', 'boundary.json')

# 최신 버전 폴더 탐색
req = urllib.request.Request(
    'https://api.github.com/repos/vuski/admdongkor/contents/',
    headers={'User-Agent': 'shade-route-webapp'})
with urllib.request.urlopen(req, timeout=30) as r:
    items = json.load(r)
ver = sorted([i['name'] for i in items if i['name'].startswith('ver')])[-1]
url = f'https://raw.githubusercontent.com/vuski/admdongkor/master/{ver}/HangJeongDong_{ver}.geojson'
print('다운로드:', url)

with urllib.request.urlopen(url, timeout=120) as r:
    d = json.load(r)

rings = []
for feat in d['features']:
    nm = feat['properties'].get('adm_nm', '')
    if '역삼1동' in nm or '역삼2동' in nm:
        print(' -', nm)
        for poly in feat['geometry']['coordinates']:  # MultiPolygon
            rings.append(poly[0])  # 외곽 링만

assert len(rings) >= 2, '역삼1동/역삼2동을 찾지 못함'

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'rings': rings, 'source': f'admdongkor {ver} (행정안전부 행정동 경계 기반)'}, f, ensure_ascii=False)
print('저장:', OUT, os.path.getsize(OUT), 'bytes')
