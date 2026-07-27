#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
สร้าง photos/manifest.json จากโฟลเดอร์ Google Drive สาธารณะ — ไม่ต้องใช้ API key

ทำอะไรบ้าง:
  • อ่านรายชื่อโฟลเดอร์ย่อย (= หมวดหมู่) และรูปในแต่ละโฟลเดอร์ (ผ่านหน้า public ของ Drive)
  • ดาวน์โหลด "รูปย่อ (thumbnail)" มาเก็บที่ photos/thumb/  → กริดโหลดจากเว็บตัวเอง เร็ว/เสถียร
    ไม่โดน Google Drive จำกัดโหลด (สำคัญมากตอนลูกค้าเปิดดู)
  • รูปเต็ม (ตอนกดดูภาพใหญ่) ยังลิงก์จาก Drive ทีละรูป → ประหยัดพื้นที่ repo
  • เก็บ "ขนาดรูป (w,h)" ไว้ให้เลย์เอาต์ masonry ไม่กระตุก

เงื่อนไข: โฟลเดอร์หลักต้องแชร์เป็น "ทุกคนที่มีลิงก์ดูได้"
รัน:  python tools/build_manifest.py
"""
import io, json, re, sys, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "assets" / "js" / "config.js"
THUMB_DIR = ROOT / "photos" / "thumb"
OUT = ROOT / "photos" / "manifest.json"
THUMB_W = 800          # ความกว้าง thumbnail ที่เก็บ (px)
FULL_W = 2200          # ความกว้างรูปเต็มตอนกดดู (px)
WORKERS = 8
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def read_folder_id() -> str:
    txt = CONFIG.read_text(encoding="utf-8")
    m = re.search(r"driveFolderId:\s*[\"']([^\"']*)[\"']", txt)
    raw = (m.group(1) if m else "").strip()
    fm = re.search(r"/folders/([a-zA-Z0-9_-]+)", raw) or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", raw)
    return fm.group(1) if fm else raw


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def list_entries(folder_id: str):
    """คืน [(id, name), ...] ของสิ่งที่อยู่ในโฟลเดอร์ (ตามลำดับที่ Drive คืนมา)"""
    html = http_get(f"https://drive.google.com/embeddedfolderview?id={folder_id}#list").decode("utf-8", "replace")
    out, seen = [], set()
    for m in re.finditer(
        r'flip-entry"\s+id="entry-([a-zA-Z0-9_-]+)".*?flip-entry-title">([^<]+)<',
        html, re.S,
    ):
        fid, name = m.group(1), m.group(2).strip()
        if fid not in seen:
            seen.add(fid)
            out.append((fid, name))
    return out


def full_url(fid: str) -> str:
    return f"https://lh3.googleusercontent.com/d/{fid}=w{FULL_W}"


def cache_thumb(fid: str):
    """ดาวน์โหลด thumbnail (ถ้ายังไม่มี) แล้วคืน (relpath, w, h) — คืน None ถ้าไม่ใช่รูป"""
    from PIL import Image
    path = THUMB_DIR / f"{fid}.jpg"
    try:
        if path.exists() and path.stat().st_size > 0:
            with Image.open(path) as im:
                return (f"photos/thumb/{fid}.jpg", im.width, im.height)
        data = http_get(f"https://drive.google.com/thumbnail?id={fid}&sz=w{THUMB_W}")
        im = Image.open(io.BytesIO(data))
        im.load()
        w, h = im.size
        im.convert("RGB").save(path, "JPEG", quality=82, optimize=True, progressive=True)
        return (f"photos/thumb/{fid}.jpg", w, h)
    except Exception:
        return None  # ไม่ใช่รูป (เช่น เป็นโฟลเดอร์ย่อย) หรือโหลดพลาด → ข้าม


def build():
    fid = read_folder_id()
    if not fid:
        sys.exit("ไม่พบ driveFolderId ใน config.js")
    print(f"root folder: {fid}")
    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    folders = list_entries(fid)
    print(f"พบโฟลเดอร์ย่อย {len(folders)} อัน")

    categories, keep = [], set()
    for sub_id, sub_name in folders:
        items = list_entries(sub_id)
        results = list(ThreadPoolExecutor(WORKERS).map(lambda it: (it, cache_thumb(it[0])),
                       sorted(items, key=lambda x: x[1])))
        images = []
        for (img_id, img_name), thumb in results:
            if not thumb:
                continue
            rel, w, h = thumb
            keep.add(img_id)
            images.append({
                "name": re.sub(r"\.[^.]+$", "", img_name),
                "id": img_id,
                "thumb": rel,
                "full": full_url(img_id),
                "w": w, "h": h,
            })
        print(f"  • {sub_name:<12} {len(images):>4} รูป")
        if images:
            categories.append({"name": sub_name, "images": images})

    # ลบ thumbnail เก่าที่ไม่มีใน Drive แล้ว
    removed = 0
    for f in THUMB_DIR.glob("*.jpg"):
        if f.stem not in keep:
            f.unlink(); removed += 1

    total = sum(len(c["images"]) for c in categories)
    OUT.write_text(json.dumps(
        {"mode": "drive", "folderId": fid, "categories": categories},
        ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ {len(categories)} หมวด · {total} รูป · ลบ thumbnail เก่า {removed} ไฟล์")
    print(f"   เขียน {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
