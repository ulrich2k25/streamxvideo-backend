// server.js
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");
const db = require("./db");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL }));

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier trouvé." });

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
        if (err) return res.status(500).json({ error: "Erreur d'insertion en base." });
        res.json({ message: "Vidéo uploadée avec succès !", url: videoUrl });
      }
    );
  } catch (error) {
    console.error("Erreur lors de l'upload S3:", error);
    res.status(500).json({ error: "Erreur upload S3." });
  }
});

app.get("/api/videos", (req, res) => {
  db.query("SELECT id, title, file_path, uploaded_at FROM videos", (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur récupération vidéos." });
    res.json(results);
  });
});

app.post("/api/auth", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur MySQL" });
    if (results.length > 0) {
      res.json({ message: "Connexion réussie", user: results[0] });
    } else {
      db.query(
        "INSERT INTO users (email, password, isSubscribed) VALUES (?, ?, 0)",
        [email, password],
        (err, result) => {
          if (err) return res.status(500).json({ error: "Erreur inscription" });
          res.json({
            message: "Inscription réussie",
            user: { id: result.insertId, email, isSubscribed: 0 },
          });
        }
      );
    }
  });
});

app.get("/api/status", (req, res) => {
  res.json({ message: "Serveur en ligne !" });
});

app.get("/api/test-db", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) return res.status(500).json({ error: "Test DB échoué" });
    res.json({ result: results[0].result });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(Serveur lancé sur le port ${PORT}));



