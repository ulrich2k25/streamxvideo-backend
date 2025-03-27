// server.js (backend complet avec paiement PayPal uniquement)
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");
const db = require("./db");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
app.use(express.json());

// ✅ CORS autorise tout domaine (mettre domaine Vercel si tu veux restreindre)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-email'],
}));

// ✅ Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({ storage: multer.memoryStorage() });

// ✅ Upload vidéo
app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier." });

    const allowedTypes = ["video/mp4", "video/mkv", "video/webm"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Format non supporté." });
    }

    const fileName = `${Date.now()}_${req.file.originalname}`;
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

// ✅ Liste des vidéos
app.get("/api/videos", (req, res) => {
  db.query("SELECT id, title, file_path, uploaded_at FROM videos", (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur base de données." });
    res.json(results);
  });
});

// ✅ Auth simple
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

// ✅ Configuration PayPal
const paypalEnv = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// ✅ Paiement PayPal
app.post("/api/payments/paypal", async (req, res) => {
  const { email } = req.body;

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "USD", value: "5.00" } }],
    application_context: {
      return_url: `https://streamxvideo-frontend.vercel.app/?message=Abonnement%20activé&email=${encodeURIComponent(email)}`,
      cancel_url: "https://streamxvideo-frontend.vercel.app/?message=Paiement%20PayPal%20échoué",
    },
  });

  try {
    const order = await paypalClient.execute(request);
    const approvalUrl = order.result.links.find((l) => l.rel === "approve").href;
    res.json({ url: approvalUrl });
  } catch (error) {
    console.error("PayPal error:", error);
    res.status(500).json({ error: "Erreur lors du paiement PayPal" });
  }
});

// ✅ Valider l'abonnement après paiement
app.get("/api/payments/success", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email manquant" });

  db.query("UPDATE users SET isSubscribed = 1 WHERE email = ?", [email], (err) => {
    if (err) return res.status(500).json({ error: "Erreur MySQL" });
    res.redirect(`https://streamxvideo-frontend.vercel.app/?message=Abonnement%20activé`);
  });
});

// ✅ Lancer serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🚀 Serveur lancé sur le port", PORT));




