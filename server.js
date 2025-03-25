// server.js (ou index.js)
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");
const db = require("./db");

const app = express();
app.use(express.json());

// ✅ Configuration CORS flexible (autorise plusieurs URLs)
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://streamxvideo-frontend.vercel.app",
      "https://streamxvideo-frontend-ulrich2k25.vercel.app"
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({ storage: multer.memoryStorage() });

// Upload vidéo
app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier." });

    const allowedTypes = ["video/mp4", "video/mkv", "video/webm"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Format non supporté." });
    }

    const fileName = ${Date.now()}_${req.file.originalname};
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const uploadResult = await s3.upload(params).promise();
    const videoUrl = uploadResult.Location;

    db.query(
      "INSERT INTO videos (title, file_path, uploaded_at) VALUES (?, ?, NOW())",
      [req.file.originalname, videoUrl],
      (err) => {
        if (err) return res.status(500).json({ error: "Erreur MySQL." });
        res.json({ message: "Vidéo uploadée !", url: videoUrl });
      }
    );
  } catch (err) {
    console.error("Erreur S3:", err);
    res.status(500).json({ error: "Erreur S3." });
  }
});

// Récupération vidéos
app.get("/api/videos", (req, res) => {
  db.query("SELECT id, title, file_path, uploaded_at FROM videos", (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur base de données." });
    res.json(results);
  });
});

// Auth simple
app.post("/api/auth", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur DB." });

    if (results.length > 0) {
      res.json({ message: "Connexion réussie", user: results[0] });
    } else {
      db.query(
        "INSERT INTO users (email, password, isSubscribed) VALUES (?, ?, 0)",
        [email, password],
        (err, result) => {
          if (err) return res.status(500).json({ error: "Erreur inscription." });
          res.json({
            message: "Inscription réussie",
            user: { id: result.insertId, email, isSubscribed: 0 },
          });
        }
      );
    }
  });
});

// Serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🚀 Serveur lancé sur le port", PORT));



