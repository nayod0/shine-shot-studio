# shine · SHOT STUDIO — เว็บพอร์ตโฟลิโอช่างภาพ

เว็บแกลเลอรีสไตล์แฟชั่น/เอดิทอเรียล (ชมพู-ดำ-ขาว) สำหรับส่งให้ลูกค้าดูผลงาน
รูป + หมวดหมู่มาจาก **Google Drive** โดยตรง — โฟลเดอร์ย่อยใน Drive = หมวดหมู่บนเว็บ
เปิดได้ทุก device (มือถือ / คอม / iPad) โฮสต์ฟรีบน **GitHub Pages**

**จุดเด่น:** ไม่ต้องใช้ Google API key เลย · รูปในกริดโหลดจากเว็บตัวเอง (เร็ว ไม่โดน Drive จำกัด) · อัปเดตอัตโนมัติผ่าน GitHub Action

---

## 🔁 ระบบทำงานยังไง

```
โฟลเดอร์ Google Drive (แชร์สาธารณะ)
        │   ← สคริปต์ tools/build_manifest.py อ่านรายชื่อโฟลเดอร์+รูป
        ▼
photos/manifest.json  +  photos/thumb/*.jpg   ← เก็บไว้ใน repo
        │
        ▼
index.html แสดงเป็นแกลเลอรี  (รูปเต็มตอนกดดู ดึงจาก Drive ทีละรูป)
```

- **โฟลเดอร์ย่อยใน Drive** → กลายเป็น "หมวดหมู่" อัตโนมัติ (เรียงตามชื่อ ก-ฮ / A-Z)
- โฟลเดอร์ที่ยังไม่มีรูป จะไม่ขึ้นบนเว็บ (พอใส่รูปแล้ว sync ใหม่ก็ขึ้นเอง)

---

## ⚙️ แก้ค่าต่าง ๆ — ที่ไฟล์ `assets/js/config.js`

```js
brandName: "shine",
tagline:   "SHOT STUDIO",
logo:      "assets/logo.png",     // โลโก้ (ดูวิธีใส่ด้านล่าง)
contact: { line:"", instagram:"", facebook:"", email:"", phone:"" },
driveFolderId: "https://drive.google.com/drive/folders/xxxxx",  // โฟลเดอร์หลัก
apiKey: "",                       // เว้นว่าง (ไม่ต้องใช้)
```

### 🖼️ ใส่โลโก้ร้าน
เอาไฟล์โลโก้มาตั้งชื่อ **`logo.png`** วางไว้ในโฟลเดอร์ **`assets/`**
(แนะนำเป็น PNG พื้นหลังโปร่ง จัตุรัส) — ถ้าไม่มี เว็บจะใช้ตัวหนังสือ "shine" แทน

---

## ▶️ ดูเว็บบนเครื่องก่อน (พรีวิว)

ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (ห้ามดับเบิลคลิก `index.html` ตรง ๆ)

```bash
cd shine-gallery
python -m http.server 8080
```
เปิด **http://localhost:8080**

---

## 🔄 อัปเดตรูปหลังเพิ่ม/ลบใน Drive

**วิธีที่ 1 — อัตโนมัติ (แนะนำ):** มี GitHub Action ตั้งไว้แล้ว จะ sync ให้เอง**ทุก 6 ชั่วโมง**
หรือกดสั่งเดี๋ยวนั้นได้ที่แท็บ **Actions → Sync photos from Google Drive → Run workflow**

**วิธีที่ 2 — สั่งเองบนเครื่อง:**
```bash
pip install Pillow          # ครั้งแรกครั้งเดียว
python tools/build_manifest.py
```
แล้ว commit/push ไฟล์ในโฟลเดอร์ `photos/` ขึ้น GitHub

---

## 🌤️ ตั้งค่า Google Drive (ทำครั้งเดียว)

1. คลิกขวาโฟลเดอร์หลักใน Drive → **แชร์** → เปลี่ยนเป็น **"ทุกคนที่มีลิงก์" (Anyone with the link)** สิทธิ์ **ผู้ดู**
   > โฟลเดอร์ย่อยข้างในจะถูกแชร์ตามอัตโนมัติ
2. ก๊อปลิงก์โฟลเดอร์หลักมาวางในช่อง `driveFolderId` ใน `config.js`
3. เอารูปไปใส่ในโฟลเดอร์ย่อย (แต่ละโฟลเดอร์ = 1 หมวด) เช่น `บุคคล`, `รับปริญญา`, `กลุ่ม` …
4. รัน sync (ดูหัวข้อด้านบน)

---

## 🚀 ขึ้น GitHub Pages (ฟรี)

1. สร้าง repo ใหม่บน GitHub → อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch `main` / `/ (root)` → **Save**
3. รอ ~1 นาที ได้ลิงก์ `https://ชื่อคุณ.github.io/ชื่อ-repo/` เอาไว้ส่งลูกค้า
4. **เปิดสิทธิ์ให้ Action อัปเดตรูปเองได้:** **Settings → Actions → General → Workflow permissions** → เลือก **Read and write permissions** → Save

---

## 🗂️ โครงไฟล์

```
shine-gallery/
├─ index.html
├─ assets/
│  ├─ css/style.css
│  ├─ js/config.js         ← แก้ตรงนี้ (แบรนด์ / ลิงก์ Drive / ติดต่อ)
│  ├─ js/app.js
│  └─ logo.png             ← วางโลโก้ตรงนี้
├─ photos/
│  ├─ manifest.json        (สร้างอัตโนมัติ)
│  └─ thumb/*.jpg          (รูปย่อ สร้างอัตโนมัติ)
├─ tools/build_manifest.py (สคริปต์ sync จาก Drive)
├─ .github/workflows/sync-drive.yml  (อัปเดตอัตโนมัติ)
└─ .nojekyll · .gitignore · README.md
```

---

## 💡 ทิป

- **อยากคุมลำดับหมวด:** ตั้งชื่อโฟลเดอร์นำหน้าด้วยเลข เช่น `01 รับปริญญา`, `02 บุคคล` (เว็บเรียงตามชื่อ)
- **ปิดปุ่มดาวน์โหลด** ในหน้าดูภาพใหญ่: ตั้ง `allowDownload: false` ใน `config.js`
- **รูปเต็มโหลดช้า/ไม่ขึ้นบางที:** เป็นข้อจำกัดของ Drive (รูปเต็มดึงสดจาก Drive) — ถ้าอยากให้รูปเต็มเก็บในเว็บด้วยเพื่อความเสถียรสูงสุด แจ้งได้ ปรับสคริปต์ให้ดาวน์โหลดไฟล์เต็มมาเก็บได้เลย
- **เปลี่ยนสีธีม:** แก้ตัวแปรสีด้านบนสุดของ `assets/css/style.css` (`--pink`, `--ink` ฯลฯ)
