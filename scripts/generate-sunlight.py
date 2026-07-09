# -*- coding: utf-8 -*-
"""
역삼동 일조량 히트맵 이미지 생성 스크립트 (오프라인 1회 실행)

- 시각: 한여름(7/15) 기준 09/12/15/18시 KST
- 셀 판정: 건물 내부/건물 그림자 = 그늘(남색), 공원 = 수목 그늘(초록),
  나머지 = 햇빛(노랑), 역삼동 경계 밖 = 투명
- 출력: public/sunlight/sunlight-{09,12,15,18}.png + meta.json

사용법: python scripts/generate-sunlight.py
"""
import urllib.request, urllib.parse, json, math, os, sys
from datetime import datetime, timezone
from PIL import Image

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
OUT_DIR = os.path.join(BASE_DIR, 'public', 'sunlight')

# ---------- 태양 위치 (suncalc 알고리즘 - src/utils/sun.ts와 동일) ----------
RAD = math.pi / 180
DAY_MS = 1000 * 60 * 60 * 24
J1970, J2000 = 2440588, 2451545
OBLIQUITY = RAD * 23.4397

def sun_position(dt_utc, lat, lng):
    ms = dt_utc.timestamp() * 1000
    d = ms / DAY_MS - 0.5 + J1970 - J2000
    M = RAD * (357.5291 + 0.98560028 * d)
    C = RAD * (1.9148 * math.sin(M) + 0.02 * math.sin(2 * M) + 0.0003 * math.sin(3 * M))
    L = M + C + RAD * 102.9372 + math.pi
    dec = math.asin(math.sin(L) * math.sin(OBLIQUITY))
    ra = math.atan2(math.sin(L) * math.cos(OBLIQUITY), math.cos(L))
    lw, phi = RAD * -lng, RAD * lat
    H = RAD * (280.16 + 360.9856235 * d) - lw - ra
    alt = math.asin(math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(H))
    az = math.atan2(math.sin(H), math.cos(H) * math.sin(phi) - math.tan(dec) * math.cos(phi)) / RAD + 180
    return alt / RAD, az % 360

# ---------- 지리 유틸 ----------
def dist_m(lat1, lng1, lat2, lng2):
    dlat = (lat2 - lat1) * 111320
    dlng = (lng2 - lng1) * 111320 * math.cos(lat1 * RAD)
    return math.hypot(dlat, dlng)

def bearing_deg(lat1, lng1, lat2, lng2):
    dlng = (lng2 - lng1) * RAD
    y = math.sin(dlng) * math.cos(lat2 * RAD)
    x = math.cos(lat1 * RAD) * math.sin(lat2 * RAD) - math.sin(lat1 * RAD) * math.cos(lat2 * RAD) * math.cos(dlng)
    return (math.atan2(y, x) / RAD) % 360

def angle_diff(a, b):
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d

def point_in_poly(lat, lng, poly):  # poly: [(lat,lng)]
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]; yj, xj = poly[j]
        if (xi > lng) != (xj > lng) and lat < (yj - yi) * (lng - xi) / (xj - xi) + yi:
            inside = not inside
        j = i
    return inside

# ---------- 데이터 로드 ----------
def overpass(query):
    data = urllib.parse.urlencode({'data': query}).encode()
    for mirror in ['https://maps.mail.ru/osm/tools/overpass/api/interpreter',
                   'https://overpass-api.de/api/interpreter']:
        try:
            req = urllib.request.Request(mirror, data=data, headers={
                'User-Agent': 'shade-route-webapp/1.0', 'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('mirror fail:', mirror, e)
    raise RuntimeError('all overpass mirrors failed')

print('경계 로드...')
with urllib.request.urlopen('https://20260708-peach.vercel.app/api/boundary', timeout=60) as r:
    rings = json.load(r)['rings']
boundary = [[(c[1], c[0]) for c in ring] for ring in rings]  # (lat,lng)

lats = [p[0] for ring in boundary for p in ring]
lngs = [p[1] for ring in boundary for p in ring]
SOUTH, NORTH, WEST, EAST = min(lats), max(lats), min(lngs), max(lngs)
print(f'bbox: {SOUTH:.4f}~{NORTH:.4f}, {WEST:.4f}~{EAST:.4f}')

print('건물/공원 로드...')
q = f'''
[out:json][timeout:25];
(
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  way["leisure"="park"]({SOUTH},{WEST},{NORTH},{EAST});
);
out tags geom;
'''
d = overpass(q)
buildings, parks = [], []
for el in d['elements']:
    tags = el.get('tags', {})
    geom = el.get('geometry')
    if not geom or len(geom) < 3:
        continue
    poly = [(g['lat'], g['lon']) for g in geom]
    clat = sum(p[0] for p in poly) / len(poly)
    clng = sum(p[1] for p in poly) / len(poly)
    if tags.get('building'):
        h = 12.0
        try:
            if tags.get('height'): h = float(tags['height'].replace('m','').strip())
            elif tags.get('building:levels'): h = float(tags['building:levels']) * 3.0
        except ValueError:
            pass
        # bbox 프리필터용
        blats = [p[0] for p in poly]; blngs = [p[1] for p in poly]
        buildings.append({'poly': poly, 'c': (clat, clng), 'h': h,
                          'bb': (min(blats), max(blats), min(blngs), max(blngs))})
    elif tags.get('leisure') == 'park':
        parks.append({'poly': poly})
print(f'건물 {len(buildings)}, 공원 {len(parks)}')

# 건물 그리드 인덱스 (0.001도 셀)
CELL = 0.001
bindex = {}
for b in buildings:
    key = (int(b['c'][0] / CELL), int(b['c'][1] / CELL))
    bindex.setdefault(key, []).append(b)

def nearby(lat, lng):
    ci, cj = int(lat / CELL), int(lng / CELL)
    out = []
    for i in range(ci-1, ci+2):
        for j in range(cj-1, cj+2):
            out.extend(bindex.get((i, j), []))
    return out

# ---------- 렌더링 ----------
PX_M = 6.0  # 픽셀당 미터
W = int(dist_m(SOUTH, WEST, SOUTH, EAST) / PX_M)
H = int(dist_m(SOUTH, WEST, NORTH, WEST) / PX_M)
print(f'이미지 크기: {W}x{H}')

COL_SUN = (255, 196, 32, 235)     # 햇빛
COL_SHADE = (44, 62, 112, 235)    # 건물 그림자/건물
COL_PARK = (46, 125, 80, 235)     # 공원 수목 그늘
TRANSPARENT = (0, 0, 0, 0)

# 경계/건물내부/공원 마스크는 시각과 무관 - 한 번만 계산
print('마스크 계산...')
mask = [[0] * W for _ in range(H)]  # 0=밖, 1=햇빛후보, 2=건물, 3=공원
for py in range(H):
    lat = NORTH - (py + 0.5) * (NORTH - SOUTH) / H
    for px in range(W):
        lng = WEST + (px + 0.5) * (EAST - WEST) / W
        if not any(point_in_poly(lat, lng, ring) for ring in boundary):
            continue
        cell = 1
        for b in nearby(lat, lng):
            bb = b['bb']
            if bb[0] <= lat <= bb[1] and bb[2] <= lng <= bb[3] and point_in_poly(lat, lng, b['poly']):
                cell = 2
                break
        if cell == 1:
            for p in parks:
                if point_in_poly(lat, lng, p['poly']):
                    cell = 3
                    break
        mask[py][px] = cell
    if py % 60 == 0:
        print(f'  mask {py}/{H}')

def in_shadow(lat, lng, sun_az, tan_alt):
    for b in nearby(lat, lng):
        cdist = dist_m(lat, lng, b['c'][0], b['c'][1])
        if cdist > 80: continue
        if angle_diff(bearing_deg(lat, lng, b['c'][0], b['c'][1]), sun_az) > 75: continue
        shadow_len = min(b['h'] / tan_alt, 120)
        mind = cdist
        for v in b['poly']:
            dd = dist_m(lat, lng, v[0], v[1])
            if dd < mind: mind = dd
        if mind <= shadow_len:
            return True
    return False

TIMES = {'09': 0, '12': 3, '15': 6, '18': 9}  # KST -> UTC hour
os.makedirs(OUT_DIR, exist_ok=True)

for label, utc_h in TIMES.items():
    dt = datetime(2026, 7, 15, utc_h, 0, 0, tzinfo=timezone.utc)
    alt, az = sun_position(dt, (SOUTH+NORTH)/2, (WEST+EAST)/2)
    print(f'[{label}시 KST] 태양고도 {alt:.1f}, 방위각 {az:.1f}')
    tan_alt = math.tan(alt * RAD) if alt > 0 else 0

    img = Image.new('RGBA', (W, H), TRANSPARENT)
    pix = img.load()
    for py in range(H):
        lat = NORTH - (py + 0.5) * (NORTH - SOUTH) / H
        for px in range(W):
            m = mask[py][px]
            if m == 0:
                continue
            if m == 2:
                pix[px, py] = COL_SHADE
            elif m == 3:
                pix[px, py] = COL_PARK
            else:
                lng = WEST + (px + 0.5) * (EAST - WEST) / W
                if alt <= 0 or in_shadow(lat, lng, az, tan_alt):
                    pix[px, py] = COL_SHADE
                else:
                    pix[px, py] = COL_SUN
        if py % 100 == 0:
            print(f'  {label}: {py}/{H}')
    out = os.path.join(OUT_DIR, f'sunlight-{label}.png')
    img.save(out)
    print('saved', out, os.path.getsize(out), 'bytes')

meta = {'south': SOUTH, 'west': WEST, 'north': NORTH, 'east': EAST,
        'basis': '2026-07-15 (한여름 기준)', 'times': list(TIMES.keys())}
with open(os.path.join(OUT_DIR, 'meta.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print('meta.json saved')
print('DONE')
