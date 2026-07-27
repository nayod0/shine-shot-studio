/* ============================================================
   Gallery engine — Drive live-read + demo fallback,
   masonry render, filtering, lightbox
   ============================================================ */
(() => {
  "use strict";
  const CFG = window.GALLERY_CONFIG || {};
  const $  = (s, r = document) => r.querySelector(s);

  /* ---------- helpers ---------- */
  const clean = (v) => (v || "").trim();

  // ยอมรับทั้ง FOLDER ID หรือ ลิงก์เต็มของ Google Drive
  function parseFolderId(v) {
    v = clean(v);
    const m = v.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
              v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : v;
  }

  const FOLDER_ID = parseFolderId(CFG.driveFolderId);
  const API_KEY   = clean(CFG.apiKey);
  const LIVE      = !!(FOLDER_ID && API_KEY);

  // URL รูปจาก Drive (thumb = กริด, full = ดูภาพใหญ่)
  const driveThumb = (id, w = 700)  => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
  const driveFull  = (id, w = 2200) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;

  /* ---------- Google Drive API ---------- */
  const DRIVE = "https://www.googleapis.com/drive/v3/files";

  async function driveQuery(params) {
    const url = new URL(DRIVE);
    url.search = new URLSearchParams({ key: API_KEY, ...params }).toString();
    const res = await fetch(url);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json())?.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function listSubfolders(parentId) {
    const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const d = await driveQuery({ q, fields: "files(id,name)", orderBy: "name", pageSize: "1000",
      supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    return d.files || [];
  }

  async function listImages(parentId) {
    const q = `'${parentId}' in parents and mimeType contains 'image/' and trashed=false`;
    const fields = "nextPageToken,files(id,name,imageMediaMetadata(width,height))";
    let out = [], token = null;
    do {
      const p = { q, fields, orderBy: "name", pageSize: "1000",
        supportsAllDrives: "true", includeItemsFromAllDrives: "true" };
      if (token) p.pageToken = token;
      const d = await driveQuery(p);
      (d.files || []).forEach((f) => out.push({
        name: f.name.replace(/\.[^.]+$/, ""),
        thumb: driveThumb(f.id),
        full:  driveFull(f.id),
        id: f.id,
        w: f.imageMediaMetadata?.width || 0,
        h: f.imageMediaMetadata?.height || 0,
      }));
      token = d.nextPageToken;
    } while (token);
    return out;
  }

  async function loadFromDrive() {
    const cacheKey = "gallery_cache_" + FOLDER_ID;
    const ttl = (CFG.cacheMinutes ?? 10) * 60 * 1000;
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (c && Date.now() - c.t < ttl && c.data?.length) return c.data;
    } catch (_) {}

    const folders = await listSubfolders(FOLDER_ID);
    const cats = (await Promise.all(
      folders.map(async (f) => ({ name: f.name, images: await listImages(f.id) }))
    )).filter((c) => c.images.length);

    const rootImgs = await listImages(FOLDER_ID);
    if (rootImgs.length) cats.push({ name: CFG.rootCategoryLabel || "อื่น ๆ", images: rootImgs });

    try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), data: cats })); } catch (_) {}
    return cats;
  }

  async function loadManifest() {
    const res = await fetch("./photos/manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("โหลด photos/manifest.json ไม่ได้");
    return await res.json();
  }

  /* ---------- state ---------- */
  let CATS = [];        // [{name, images:[...]}]
  let activeCat = 0;    // 0 = ทั้งหมด
  let query = "";
  let view = [];        // รูปที่กำลังโชว์ (ใช้กับ lightbox)

  const ALL = () => CATS.flatMap((c) => c.images);

  function currentImages() {
    let imgs = activeCat === 0 ? ALL() : (CATS[activeCat - 1]?.images || []);
    const q = query.toLowerCase();
    if (q) imgs = imgs.filter((i) => i.name.toLowerCase().includes(q));
    return imgs;
  }

  /* ---------- render ---------- */
  function renderPills() {
    const bar = $("#cats");
    const total = ALL().length;
    const items = [{ name: "ทั้งหมด", n: total }, ...CATS.map((c) => ({ name: c.name, n: c.images.length }))];
    bar.innerHTML = items.map((c, i) =>
      `<button class="pill${i === activeCat ? " active" : ""}" data-i="${i}">${esc(c.name)}<span class="n">${c.n}</span></button>`
    ).join("");
    bar.querySelectorAll(".pill").forEach((b) =>
      b.addEventListener("click", () => { activeCat = +b.dataset.i; renderPills(); renderGrid(); })
    );
  }

  /* ตัวโหลดรูปแบบคุมจำนวนพร้อมกัน (กัน Google Drive throttle เวลารูปเยอะ)
     - โหลดเรียงจากบนลงล่าง ครั้งละไม่เกิน MAX รูป, เสร็จ 1 ค่อยดึงรูปถัดไป
     - รูปไหนพลาด ลองซ้ำ 1 ครั้ง แล้วสลับไปใช้รูปเต็มเป็น fallback */
  const LOADER = {
    queue: [], active: 0, MAX: 5, gen: 0,
    load(imgs) {
      this.gen++;
      this.queue = Array.from(imgs);
      this.active = 0;
      this.pump(this.gen);
    },
    pump(g) {
      if (g !== this.gen) return;
      while (this.active < this.MAX && this.queue.length) {
        const img = this.queue.shift();
        if (!img || img.dataset.done) continue;
        this.active++;
        const src = img.dataset.src;
        let tried = 0;
        const finish = () => { img.dataset.done = "1"; this.active--; this.pump(g); };
        img.onload = () => { img.classList.add("loaded"); finish(); };
        img.onerror = () => {
          tried++;
          if (tried === 1) setTimeout(() => { img.src = src + (src.includes("?") ? "&" : "?") + "retry=1"; }, 1400);
          else if (tried === 2 && img.dataset.full) img.src = img.dataset.full;
          else finish();
        };
        img.src = src;
      }
    },
  };

  function renderGrid() {
    const grid = $("#grid");
    view = currentImages();
    if (!view.length) {
      grid.innerHTML = `<div class="state"><p>ไม่พบรูปในหมวดนี้</p></div>`;
      updateCount();
      return;
    }
    grid.innerHTML = view.map((im, i) => {
      const ar = im.w && im.h ? ` style="aspect-ratio:${im.w}/${im.h}"` : "";
      return `<figure class="card" data-i="${i}">
        <img${ar} decoding="async" alt="${esc(im.name)}" data-src="${im.thumb}" data-full="${im.full}">
        <figcaption class="card__name">${esc(im.name)}</figcaption>
      </figure>`;
    }).join("");
    grid.querySelectorAll(".card").forEach((c) =>
      c.addEventListener("click", () => openLightbox(+c.dataset.i))
    );
    LOADER.load(grid.querySelectorAll(".card img"));
    updateCount();
  }

  function updateCount() {
    const el = $("#count");
    if (el) el.textContent = `${view.length} รูป`;
  }

  /* ---------- lightbox ---------- */
  let lbIndex = 0;
  const lb = {
    el: $("#lb"), img: $("#lbImg"), cap: $("#lbCap"),
    count: $("#lbCount"), dl: $("#lbDl"), spin: $("#lbSpin"),
  };

  function openLightbox(i) {
    lbIndex = i; showLightbox(); document.body.style.overflow = "hidden";
    lb.el.classList.add("open");
  }
  function closeLightbox() {
    lb.el.classList.remove("open"); document.body.style.overflow = "";
  }
  function step(d) {
    lbIndex = (lbIndex + d + view.length) % view.length; showLightbox();
  }
  function showLightbox() {
    const im = view[lbIndex]; if (!im) return;
    lb.img.classList.remove("loaded"); lb.spin.style.display = "block";
    lb.img.onload  = () => { lb.img.classList.add("loaded"); lb.spin.style.display = "none"; };
    lb.img.onerror = () => { lb.img.src = im.thumb; };
    lb.img.src = im.full;
    lb.cap.textContent = im.name;
    lb.count.textContent = `${lbIndex + 1} / ${view.length}`;
    if (CFG.allowDownload !== false) {
      lb.dl.style.display = "inline-flex";
      lb.dl.href = im.full;
      lb.dl.setAttribute("download", im.name + ".jpg");
    } else lb.dl.style.display = "none";
  }

  function bindLightbox() {
    $("#lbClose").onclick = closeLightbox;
    $("#lbPrev").onclick  = () => step(-1);
    $("#lbNext").onclick  = () => step(1);
    lb.el.addEventListener("click", (e) => { if (e.target === lb.el) closeLightbox(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.el.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
    // swipe
    let x0 = null;
    lb.el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.el.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  /* ---------- search ---------- */
  function bindSearch() {
    const inp = $("#search"), clr = $("#searchClear");
    let t;
    inp.addEventListener("input", () => {
      query = inp.value;
      clr.classList.toggle("show", !!query);
      clearTimeout(t); t = setTimeout(renderGrid, 160);
    });
    clr.addEventListener("click", () => { inp.value = ""; query = ""; clr.classList.remove("show"); renderGrid(); inp.focus(); });
  }

  /* ---------- brand / footer ---------- */
  function fillBrand() {
    const b = CFG.brandName || "Gallery", tag = CFG.tagline || "";
    $("#brandName").textContent = b;
    $("#brandTag").textContent  = tag;
    $("#introTitle").textContent = b;
    $("#introTag").textContent   = tag;
    $("#footName").textContent   = b;
    document.title = b + (tag ? " · " + tag : "");

    // โลโก้ badge (ถ้ามีไฟล์) — โชว์เฉพาะตอนโหลดสำเร็จ, โหลดไม่ได้ก็ลบทิ้ง ใช้ตัวหนังสือแทน
    const logoEl = $("#brandLogo");
    if (logoEl) {
      if (CFG.logo) {
        logoEl.alt = b;
        logoEl.onload  = () => { logoEl.hidden = false; };
        logoEl.onerror = () => { logoEl.remove(); };
        logoEl.src = CFG.logo;
      } else {
        logoEl.remove();
      }
    }

    const c = CFG.contact || {};
    const links = [];
    if (c.line)      links.push(["LINE", c.line.startsWith("http") ? c.line : `https://line.me/ti/p/~${c.line.replace(/^@/, "")}`]);
    if (c.instagram) links.push(["Instagram", `https://instagram.com/${c.instagram.replace(/^@/, "")}`]);
    if (c.facebook)  links.push(["Facebook", c.facebook.startsWith("http") ? c.facebook : `https://facebook.com/${c.facebook}`]);
    if (c.email)     links.push(["Email", `mailto:${c.email}`]);
    if (c.phone)     links.push(["โทร", `tel:${c.phone.replace(/[^+\d]/g, "")}`]);
    $("#footLinks").innerHTML = links.map(([t, h]) => `<a href="${h}" target="_blank" rel="noopener">${t}</a>`).join("");
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------- boot ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function showState(html) { $("#grid").innerHTML = `<div class="state">${html}</div>`; }

  async function boot() {
    fillBrand();
    bindLightbox();
    bindSearch();
    showState(`<div class="spinner"></div><p>กำลังโหลดรูป…</p>`);

    try {
      if (LIVE) {
        CATS = await loadFromDrive();
        if (!CATS.length) {
          showState(`<h2>ยังไม่พบรูป</h2><p>เชื่อมต่อ Drive สำเร็จ แต่โฟลเดอร์ยังว่างอยู่ หรือยังไม่ได้แชร์เป็น "ทุกคนที่มีลิงก์ดูได้"</p>`);
          return;
        }
      } else {
        const mf = await loadManifest();
        CATS = mf.categories || [];
        if (mf.mode === "demo") $("#banner").style.display = "block";
        if (!CATS.length) {
          showState(`<h2>ยังไม่มีรูป</h2><p>โฟลเดอร์ใน Google Drive ยังว่างอยู่ — เพิ่มรูปแล้วรัน sync อีกครั้ง</p>`);
          return;
        }
      }
      renderPills();
      renderGrid();
    } catch (err) {
      console.error(err);
      const hint = LIVE
        ? `<p>ดึงข้อมูลจาก Google Drive ไม่สำเร็จ</p>
           <p style="margin-top:10px"><code>${esc(err.message)}</code></p>
           <p style="margin-top:14px;font-size:14px">ตรวจสอบ: โฟลเดอร์แชร์เป็น "ทุกคนที่มีลิงก์ดูได้" · เปิดใช้ Google Drive API · API key ถูกต้อง</p>`
        : `<p>โหลดรูปตัวอย่างไม่สำเร็จ — ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่ใช่ดับเบิลคลิกไฟล์)</p>
           <p style="margin-top:10px"><code>${esc(err.message)}</code></p>`;
      showState(`<h2>เกิดข้อผิดพลาด</h2>${hint}`);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
