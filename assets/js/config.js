/* ============================================================
   ⚙️  ตั้งค่าเว็บแกลเลอรี — แก้แค่ไฟล์นี้ไฟล์เดียวพอ
   ============================================================ */
window.GALLERY_CONFIG = {

  /* ---------- ข้อมูลแบรนด์ / ช่างภาพ ---------- */
  brandName: "SHINE SHOT",
  tagline: "studio",
  logo: "assets/logo.png",   // ไฟล์โลโก้ (วางไว้ที่ assets/logo.png) — เว้นว่าง = ใช้ชื่อตัวหนังสือแทน

  /* ช่องทางติดต่อ (เว้นว่างไว้ = ไม่แสดง) */
  contact: {
    line:      "",   // เช่น "@studioo"
    instagram: "shine_shot_studio",
    facebook:  "",   // เช่น "studioophoto"
    email:     "",   // เช่น "hello@studioo.com"
    phone:     "",   // เช่น "08x-xxx-xxxx"
  },

  /* ---------- Google Drive (โหมด LIVE — รูปลิงก์สดจาก Drive) ----------
     ใส่ apiKey แล้วเว็บจะ:
       • ลิงก์รูปทุกภาพตรงจาก Google Drive (ไม่เก็บใน GitHub)
       • เพิ่มรูป/โฟลเดอร์ใน Drive แล้ว "ขึ้นเองอัตโนมัติ" ตอนเปิด/รีเฟรชเว็บ
     เงื่อนไข: แชร์โฟลเดอร์หลักเป็น "ทุกคนที่มีลิงก์ดูได้" + ขอ API key (ดู README)  */
  driveFolderId: "https://drive.google.com/drive/folders/1VD1YCGpZIhw8Avw1nIDfXbjiT-1XJ7iU",
  apiKey: "AIzaSyD2pQBCBvMymccKl1sC-dkDKa0cpW51Qt0",   // ← Google API key (โหมด live เปิดอยู่)

  /* ป้ายกำกับรูปที่วางไว้ในโฟลเดอร์หลักตรง ๆ (ไม่ได้อยู่ในโฟลเดอร์ย่อย) */
  rootCategoryLabel: "อื่น ๆ",

  /* ---------- หน้าปก Hero (รูปเด่น + ข้อความแนะนำสั้นๆ) ---------- */
  showHero: true,
  heroText: "รับถ่ายภาพรับปริญญา พรีเวดดิ้ง และภาพบุคคล — ผลงานจริงจากลูกค้า",

  /* ---------- ตัวเลือกอื่น ---------- */
  allowDownload: true,     // ให้กดดาวน์โหลดรูปจากหน้าดูภาพใหญ่ได้ไหม
  enableFavorites: true,   // เปิดปุ่ม "เลือกรูปโปรด" ให้ลูกค้ากดคัดรูปที่ชอบ
  enableContactFab: true,  // เปิดปุ่มติดต่อลอยมุมจอ (ใช้ข้อมูลจาก contact ด้านบน)
  columnGap: 16,           // ระยะห่างระหว่างรูป (px)
  cacheMinutes: 1,         // จำรายการจาก Drive ไว้กี่นาที (รูปใหม่ขึ้นภายใน ~นาทีนี้)
};
