const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "users.json");

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8") || "{}");
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Inscription
app.post("/api/register", async (req, res) => {
  const { email, password, pseudo, icon } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

  const db = loadDB();
  if (db[email]) return res.status(400).json({ error: "Cet email existe déjà" });

  const hash = await bcrypt.hash(password, 10);

  db[email] = {
    email,
    password: hash,
    pseudo: pseudo || "Utilisateur",
    icon: icon || "🙂",
    pixels: 0
  };

  saveDB(db);
  res.json({ success: true });
});

// Connexion
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const db = loadDB();
  const user = db[email];

  if (!user) return res.status(400).json({ error: "Email ou mot de passe incorrect" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Email ou mot de passe incorrect" });

  res.json({
    success: true,
    user: {
      email: user.email,
      pseudo: user.pseudo,
      icon: user.icon,
      pixels: user.pixels
    }
  });
});

// Mise à jour profil
app.post("/api/profile", (req, res) => {
  const { email, pseudo, icon } = req.body;
  const db = loadDB();
  const user = db[email];

  if (!user) return res.status(400).json({ error: "Utilisateur introuvable" });

  if (pseudo) user.pseudo = pseudo;
  if (icon) user.icon = icon;

  saveDB(db);
  res.json({ success: true });
});

// Ajouter un pixel
app.post("/api/addPixel", (req, res) => {
  const { email } = req.body;
  const db = loadDB();
  const user = db[email];

  if (!user) return res.status(400).json({ error: "Utilisateur introuvable" });

  user.pixels += 1;
  saveDB(db);

  res.json({ success: true, pixels: user.pixels });
});

// Classement
app.get("/api/leaderboard", (req, res) => {
  const db = loadDB();
  const list = Object.values(db)
    .sort((a, b) => b.pixels - a.pixels)
    .map(u => ({
      pseudo: u.pseudo,
      icon: u.icon,
      pixels: u.pixels
    }));

  res.json(list);
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.listen(PORT, () => console.log("Serveur lancé sur Render"));
let pixels = [];
app.post("/api/pixel", (req, res) => {
    const pixel = req.body;
    pixels.push(pixel);
    res.json({ success: true });
});
app.get("/api/pixels", (req, res) => {
    res.json(pixels);
});