// =========================
// CONFIG
// =========================
const API_BASE = ""; // même domaine sur Render
const PIXEL_LIMIT = 200;
const WINDOW_MS = 15 * 60 * 1000;

// =========================
// VARIABLES
// =========================
let currentUser = null;
let historyPixels = [];
let currentColor = "#f97316";
let eraseMode = false;

let map;
let pixelLayerGroup;

// =========================
// LIMITES DE PIXELS
// =========================
function cleanHistory() {
  const now = Date.now();
  historyPixels = historyPixels.filter(t => now - t <= WINDOW_MS);
}

function canColorPixel() {
  cleanHistory();
  return historyPixels.length < PIXEL_LIMIT;
}

function registerPixelLocal() {
  historyPixels.push(Date.now());
  updateLimitInfo();
}

function updateLimitInfo() {
  cleanHistory();
  const left = PIXEL_LIMIT - historyPixels.length;
  document.getElementById("pixelsLeft").textContent = left;
}

// =========================
// AUTH UI
// =========================
const authCard = document.getElementById("authCard");
const userCard = document.getElementById("userCard");
const authMsg = document.getElementById("authMsg");
const userIconEl = document.getElementById("userIcon");
const userPseudoLabel = document.getElementById("userPseudoLabel");
const userEmailLabel = document.getElementById("userEmailLabel");

function setUser(user) {
  currentUser = user;

  if (user) {
    authCard.style.display = "none";
    userCard.style.display = "block";

    userPseudoLabel.textContent = user.pseudo;
    userEmailLabel.textContent = user.email;

    if (user.icon.startsWith("http://") || user.icon.startsWith("https://")) {
      userIconEl.style.backgroundImage = `url("${user.icon}")`;
      userIconEl.textContent = "";
    } else {
      userIconEl.style.backgroundImage = "none";
      userIconEl.textContent = user.icon;
    }
  } else {
    authCard.style.display = "block";
    userCard.style.display = "none";
  }
}

// =========================
// AUTH API
// =========================
async function register() {
  authMsg.textContent = "";
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const pseudo = document.getElementById("regPseudo").value.trim();
  const icon = document.getElementById("regIcon").value.trim();

  try {
    const res = await fetch(API_BASE + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, pseudo, icon })
    });

    const data = await res.json();

    if (!res.ok) {
      authMsg.textContent = data.error;
    } else {
      authMsg.style.color = "#16a34a";
      authMsg.textContent = "Inscription réussie ! Connecte-toi.";
    }
  } catch {
    authMsg.textContent = "Erreur réseau.";
  }
}

async function login() {
  authMsg.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      authMsg.textContent = data.error;
    } else {
      setUser(data.user);
      localStorage.setItem("currentEmail", data.user.email);
    }
  } catch {
    authMsg.textContent = "Erreur réseau.";
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("currentEmail");
  setUser(null);
}

async function saveProfile() {
  if (!currentUser) return;

  const pseudo = document.getElementById("profilePseudo").value.trim();
  const icon = document.getElementById("profileIcon").value.trim();

  try {
    const res = await fetch(API_BASE + "/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUser.email, pseudo, icon })
    });

    if (res.ok) {
      if (pseudo) currentUser.pseudo = pseudo;
      if (icon) currentUser.icon = icon;
      setUser(currentUser);
    }
  } catch {}
}

// =========================
// CLASSEMENT
// =========================
const leaderboardModal = document.getElementById("leaderboardModal");
const leaderboardList = document.getElementById("leaderboardList");

async function openLeaderboard() {
  leaderboardList.innerHTML = "";

  try {
    const res = await fetch(API_BASE + "/api/leaderboard");
    const data = await res.json();

    data.forEach((u, i) => {
      const li = document.createElement("li");
      const icon = (u.icon.startsWith("http")) ? "🖼️" : u.icon;
      li.innerHTML = `<span>${i + 1}. ${icon} ${u.pseudo}</span><span>${u.pixels} px</span>`;
      leaderboardList.appendChild(li);
    });
  } catch {
    leaderboardList.innerHTML = "<li>Erreur de chargement</li>";
  }

  leaderboardModal.style.display = "flex";
}

function closeLeaderboard() {
  leaderboardModal.style.display = "none";
}

// =========================
// CARTE & PIXELS
// =========================
function metersToLat(m) {
  return m / 111320;
}

function metersToLng(m, lat) {
  return m / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
}

function generatePixelsInView() {
  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  const PIXEL_SIZE = 5;

  pixelLayerGroup.clearLayers();

  for (let lat = south; lat < north; lat += metersToLat(PIXEL_SIZE)) {
    for (let lng = west; lng < east; lng += metersToLng(PIXEL_SIZE, lat)) {
      const p1 = L.latLng(lat, lng);
      const p2 = L.latLng(
        lat + metersToLat(PIXEL_SIZE),
        lng + metersToLng(PIXEL_SIZE, lat)
      );

      const rect = L.rectangle([p1, p2], {
        color: "#00000033",
        weight: 0.3,
        fillColor: "#00000000",
        fillOpacity: 0
      });

      rect.addTo(pixelLayerGroup);

      rect.on("click", () => handlePixelClick(rect));
    }
  }
}

async function handlePixelClick(rect) {
  if (!currentUser) {
    alert("Tu dois être connecté(e).");
    return;
  }

  if (eraseMode) {
    rect.setStyle({
      fillColor: "#00000000",
      fillOpacity: 0,
      color: "#00000033",
      weight: 0.3
    });
    return;
  }

  if (!canColorPixel()) {
    alert("Limite atteinte.");
    return;
  }

  rect.setStyle({
    fillColor: currentColor,
    fillOpacity: 0.9,
    color: currentColor,
    weight: 0.3
  });

  registerPixelLocal();

  await fetch(API_BASE + "/api/addPixel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentUser.email })
  });
}

function initMap() {
  map = L.map("map");
  map.setView([48.8584, 2.2945], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  pixelLayerGroup = L.layerGroup().addTo(map);

  map.on("moveend zoomend", generatePixelsInView);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 17);
        generatePixelsInView();
      },
      () => generatePixelsInView()
    );
  } else {
    generatePixelsInView();
  }
}

// =========================
// EVENTS
// =========================
document.getElementById("btnRegister").addEventListener("click", register);
document.getElementById("btnLogin").addEventListener("click", login);
document.getElementById("btnLogout").addEventListener("click", logout);
document.getElementById("btnSaveProfile").addEventListener("click", saveProfile);
document.getElementById("btnLeaderboard").addEventListener("click", openLeaderboard);
document.getElementById("btnCloseLeaderboard").addEventListener("click", closeLeaderboard);

// Palette
document.querySelectorAll(".color-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.id === "btnErase") {
      eraseMode = true;
    } else {
      currentColor = btn.dataset.color;
      eraseMode = false;
    }
  });
});

// =========================
// INIT
// =========================
window.addEventListener("load", () => {
  initMap();
  updateLimitInfo();
});
await fetch("/api/pixel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, color })
});
async function loadPixels() {
    const res = await fetch("/api/pixels");
    const pixels = await res.json();
    pixels.forEach(p => drawPixel(p.x, p.y, p.color));
}

loadPixels();
map.on("moveend", loadPixels);