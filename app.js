import { db, storage } from "./firebase.js";
import {
  collection, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ─── CONFIG ───────────────────────────────────────────────
const ADMIN_PASSWORD = "admin1234";

const STAGES_DEFAULT = [
  { id: 1,  name: "تخریب و آماده‌سازی زمین",    desc: "تخریب سازه قدیمی، پاکسازی و آماده‌سازی زمین برای شروع عملیات ساختمانی.",       status: "done",    pct: 100, photos: [] },
  { id: 2,  name: "گودبرداری",                    desc: "عملیات گودبرداری طبق نقشه‌های تأییدشده و با رعایت اصول ایمنی.",                status: "done",    pct: 100, photos: [] },
  { id: 3,  name: "فونداسیون",                    desc: "اجرای فونداسیون، آرماتوربندی و بتون‌ریزی پی ساختمان.",                        status: "done",    pct: 100, photos: [] },
  { id: 4,  name: "اسکلت زیرزمین",               desc: "اجرای سقف و ستون‌های زیرزمین، آرماتوربندی و قالب‌بندی.",                     status: "done",    pct: 100, photos: [] },
  { id: 5,  name: "اسکلت همکف",                  desc: "اجرای ستون‌ها، تیرها و سقف طبقه همکف.",                                      status: "done",    pct: 100, photos: [] },
  { id: 6,  name: "اسکلت طبقات ۱ تا ۴",          desc: "ادامه عملیات بتون‌ریزی ستون و سقف طبقات اول تا چهارم.",                      status: "active",  pct: 65,  photos: [] },
  { id: 7,  name: "اسکلت طبقات ۵ تا ۸",          desc: "اجرای سازه طبقات پنجم تا هشتم.",                                              status: "pending", pct: 0,   photos: [] },
  { id: 8,  name: "سقف آخر و پشت‌بام",            desc: "اجرای سقف آخرین طبقه، واترپروف و عایق‌بندی پشت‌بام.",                       status: "pending", pct: 0,   photos: [] },
  { id: 9,  name: "دیوارچینی و تیغه‌بندی",        desc: "اجرای دیوارهای خارجی و تیغه‌چینی داخلی تمام طبقات.",                        status: "pending", pct: 0,   photos: [] },
  { id: 10, name: "نما",                           desc: "اجرای نمای خارجی ساختمان شامل سنگ، شیشه و آلومینیوم.",                      status: "pending", pct: 0,   photos: [] },
  { id: 11, name: "تاسیسات برقی",                 desc: "اجرای شبکه برق، روشنایی، آیفون، دوربین‌ها و سیستم هوشمند.",                 status: "pending", pct: 0,   photos: [] },
  { id: 12, name: "تاسیسات مکانیکی",              desc: "اجرای لوله‌کشی آب و فاضلاب، سیستم گرمایش و سرمایش مرکزی.",                  status: "pending", pct: 0,   photos: [] },
  { id: 13, name: "کاشی و سرامیک",                desc: "اجرای کاشی‌کاری سرویس‌ها، آشپزخانه و کف‌پوش‌های سرامیکی.",                status: "pending", pct: 0,   photos: [] },
  { id: 14, name: "گچ‌کاری و نقاشی",              desc: "اجرای گچ‌کاری دیوارها، سقف و رنگ‌آمیزی تمامی فضاهای داخلی.",              status: "pending", pct: 0,   photos: [] },
  { id: 15, name: "محوطه‌سازی و تحویل",           desc: "اجرای محوطه، فضای سبز، پارکینگ، نصب تجهیزات نهایی و تحویل به مالکین.",    status: "pending", pct: 0,   photos: [] },
];

// ─── STATE ────────────────────────────────────────────────
let stages = [];
let isAdmin = false;
let currentGalleryId = null;

// ─── FIRESTORE ────────────────────────────────────────────
const PROJECT_DOC = doc(db, "project", "main");

async function initFirestore() {
  const snap = await getDoc(PROJECT_DOC);
  if (!snap.exists()) {
    await setDoc(PROJECT_DOC, { stages: STAGES_DEFAULT });
  }
}

function listenFirestore() {
  onSnapshot(PROJECT_DOC, (snap) => {
    if (snap.exists()) {
      stages = snap.data().stages || STAGES_DEFAULT;
    } else {
      stages = STAGES_DEFAULT;
    }
    renderAll();
  });
}

async function saveToFirestore() {
  await setDoc(PROJECT_DOC, { stages });
}

// ─── RENDER ───────────────────────────────────────────────
function toFarsiNum(n) {
  return String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

function calcTotal() {
  const sum = stages.reduce((a, s) => a + (s.pct || 0), 0);
  return Math.round(sum / stages.length);
}

function statusLabel(s) {
  if (s === "done")    return `<span class="stage-status-label label-done">تکمیل‌شده</span>`;
  if (s === "active")  return `<span class="stage-status-label label-active">در حال اجرا</span>`;
  return `<span class="stage-status-label label-pending">در انتظار</span>`;
}

function numClass(s) {
  if (s === "done")   return "done";
  if (s === "active") return "active";
  return "";
}

function cardClass(s) {
  if (s === "done")   return "done-stage";
  if (s === "active") return "active-stage";
  return "";
}

function renderAll() {
  renderStages();
  renderProgress();
  if (isAdmin) renderAdminPanel();
}

function renderProgress() {
  const total = calcTotal();
  document.getElementById("totalPct").textContent = toFarsiNum(total) + "٪";
  document.getElementById("progressFill").style.width = total + "%";
}

function renderStages() {
  const list = document.getElementById("stagesList");
  list.innerHTML = stages.map(s => {
    const thumbs = (s.photos || []).slice(0, 3).map(p =>
      `<img class="stage-photo-thumb" src="${p.url}" alt="" data-url="${p.url}">`
    ).join("");

    const hasPhotos = s.photos && s.photos.length > 0;

    return `
    <div class="stage-card ${cardClass(s.status)}" id="stage-card-${s.id}">
      <div class="stage-header" data-id="${s.id}">
        <div class="stage-num ${numClass(s.status)}">${s.status === "done" ? "✓" : toFarsiNum(s.id)}</div>
        <div class="stage-info">
          <div class="stage-name">${s.name} ${statusLabel(s.status)}</div>
          <div class="stage-date">${s.status === "pending" ? "در انتظار اجرا" : s.status === "active" ? "در حال اجرا" : "تکمیل‌شده"}</div>
        </div>
        <div class="stage-pct">${toFarsiNum(s.pct)}٪</div>
        <div class="stage-chevron">▼</div>
      </div>
      <div class="stage-body">
        <p class="stage-desc">${s.desc}</p>
        <div class="stage-progress-mini">
          <div class="progress-label">
            <span>پیشرفت این مرحله</span>
            <span>${toFarsiNum(s.pct)}٪</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${s.pct}%"></div>
          </div>
        </div>
        ${hasPhotos ? `
          <div class="stage-photos-row">${thumbs}</div>
          <button class="btn-gallery" data-gallery="${s.id}">مشاهده همه عکس‌ها (${toFarsiNum(s.photos.length)})</button>
        ` : `<p class="no-photos">عکسی برای این مرحله ثبت نشده است.</p>`}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".stage-header").forEach(h => {
    h.addEventListener("click", () => {
      const card = h.closest(".stage-card");
      card.classList.toggle("open");
    });
  });

  list.querySelectorAll(".stage-photo-thumb").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.dataset.url));
  });

  list.querySelectorAll(".btn-gallery").forEach(btn => {
    btn.addEventListener("click", () => openGallery(Number(btn.dataset.gallery)));
  });
}

function renderAdminPanel() {
  const list = document.getElementById("adminStagesList");
  list.innerHTML = stages.map(s => {
    const thumbs = (s.photos || []).map(p =>
      `<div class="admin-thumb-wrap">
        <img class="admin-thumb" src="${p.url}" alt="">
        <button class="btn-del-photo" data-id="${s.id}" data-path="${p.path}" title="حذف">✕</button>
      </div>`
    ).join("");

    return `
    <div class="admin-stage-item">
      <div class="admin-stage-top">
        <div class="admin-stage-name">${toFarsiNum(s.id)}. ${s.name}</div>
        <div class="admin-stage-controls">
          <select class="select-status" data-id="${s.id}">
            <option value="pending" ${s.status==="pending"?"selected":""}>در انتظار</option>
            <option value="active"  ${s.status==="active" ?"selected":""}>در حال اجرا</option>
            <option value="done"    ${s.status==="done"   ?"selected":""}>تکمیل‌شده</option>
          </select>
          <input type="number" class="input-pct" min="0" max="100" value="${s.pct}" data-id="${s.id}" placeholder="٪" />
          <button class="btn-save-stage" data-id="${s.id}">ذخیره</button>
        </div>
      </div>
      <label class="upload-area" for="upload-${s.id}">
        <input type="file" id="upload-${s.id}" accept="image/*" multiple data-id="${s.id}">
        📷 آپلود عکس (می‌توانید چند عکس انتخاب کنید)
      </label>
      <div class="upload-progress" id="upload-prog-${s.id}"></div>
      <div class="admin-thumbs">${thumbs}</div>
    </div>`;
  }).join("");

  list.querySelectorAll(".btn-save-stage").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const st = list.querySelector(`.select-status[data-id="${id}"]`).value;
      const pct = Math.min(100, Math.max(0, Number(list.querySelector(`.input-pct[data-id="${id}"]`).value) || 0));
      const idx = stages.findIndex(s => s.id === id);
      if (idx !== -1) {
        stages[idx].status = st;
        stages[idx].pct = pct;
        saveToFirestore();
      }
    });
  });

  list.querySelectorAll("input[type=file]").forEach(inp => {
    inp.addEventListener("change", () => {
      const id = Number(inp.dataset.id);
      [...inp.files].forEach(file => uploadPhoto(id, file));
      inp.value = "";
    });
  });

  list.querySelectorAll(".btn-del-photo").forEach(btn => {
    btn.addEventListener("click", () => deletePhoto(Number(btn.dataset.id), btn.dataset.path));
  });
}

// ─── UPLOAD ───────────────────────────────────────────────
function uploadPhoto(stageId, file) {
  const progEl = document.getElementById(`upload-prog-${stageId}`);
  const path = `stages/${stageId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);
  task.on("state_changed",
    snap => {
      const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
      if (progEl) progEl.textContent = `در حال آپلود... ${pct}٪`;
    },
    err => {
      if (progEl) progEl.textContent = "خطا در آپلود: " + err.message;
    },
    async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      const idx = stages.findIndex(s => s.id === stageId);
      if (idx !== -1) {
        stages[idx].photos = stages[idx].photos || [];
        stages[idx].photos.push({ url, path });
        await saveToFirestore();
      }
      if (progEl) progEl.textContent = "آپلود با موفقیت انجام شد ✓";
      setTimeout(() => { if (progEl) progEl.textContent = ""; }, 3000);
    }
  );
}

async function deletePhoto(stageId, path) {
  if (!confirm("آیا مطمئن هستید؟")) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (_) {}
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx !== -1) {
    stages[idx].photos = stages[idx].photos.filter(p => p.path !== path);
    await saveToFirestore();
  }
}

// ─── GALLERY ──────────────────────────────────────────────
function openGallery(stageId) {
  currentGalleryId = stageId;
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return;
  document.getElementById("galleryTitle").textContent = stage.name;
  const grid = document.getElementById("galleryGrid");
  grid.innerHTML = (stage.photos || []).map(p =>
    `<img src="${p.url}" alt="" data-url="${p.url}">`
  ).join("") || `<p class="no-photos">عکسی یافت نشد.</p>`;
  grid.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.dataset.url));
  });
  openModal("galleryModal");
}

// ─── LIGHTBOX ─────────────────────────────────────────────
function openLightbox(url) {
  document.getElementById("lightboxImg").src = url;
  document.getElementById("lightbox").classList.add("open");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  document.getElementById("lightboxImg").src = "";
}

// ─── MODALS ───────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

// ─── QR CODE ──────────────────────────────────────────────
function initQR() {
  const url = location.href;
  document.getElementById("qrUrl").textContent = url;
  const container = document.getElementById("qrCode");
  container.innerHTML = "";
  new QRCode(container, {
    text: url,
    width: 180,
    height: 180,
    colorDark: "#f0d080",
    colorLight: "#1a1d26",
    correctLevel: QRCode.CorrectLevel.H,
  });
}

// ─── EVENTS ───────────────────────────────────────────────
function bindEvents() {
  // QR
  document.getElementById("btnQR").addEventListener("click", () => {
    initQR();
    openModal("qrModal");
  });
  document.getElementById("qrClose").addEventListener("click", () => closeModal("qrModal"));

  // Admin login
  document.getElementById("btnAdminOpen").addEventListener("click", () => {
    if (isAdmin) {
      openModal("adminPanel");
    } else {
      document.getElementById("adminPass").value = "";
      document.getElementById("adminError").textContent = "";
      openModal("adminModal");
    }
  });
  document.getElementById("adminClose").addEventListener("click", () => closeModal("adminModal"));
  document.getElementById("adminLogin").addEventListener("click", doAdminLogin);
  document.getElementById("adminPass").addEventListener("keydown", e => {
    if (e.key === "Enter") doAdminLogin();
  });

  // Admin panel
  document.getElementById("adminPanelClose").addEventListener("click", () => closeModal("adminPanel"));

  // Gallery
  document.getElementById("galleryClose").addEventListener("click", () => closeModal("galleryModal"));

  // Lightbox
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightbox").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeLightbox();
  });

  // Close modals on overlay click
  ["qrModal", "adminModal", "adminPanel", "galleryModal"].forEach(id => {
    document.getElementById(id).addEventListener("click", e => {
      if (e.target === e.currentTarget) closeModal(id);
    });
  });
}

function doAdminLogin() {
  const pass = document.getElementById("adminPass").value;
  if (pass === ADMIN_PASSWORD) {
    isAdmin = true;
    closeModal("adminModal");
    renderAdminPanel();
    openModal("adminPanel");
    document.getElementById("btnAdminOpen").textContent = "پنل مدیر ✓";
  } else {
    document.getElementById("adminError").textContent = "رمز عبور اشتباه است.";
  }
}

// ─── INIT ─────────────────────────────────────────────────
(async () => {
  bindEvents();
  await initFirestore();
  listenFirestore();
})();
