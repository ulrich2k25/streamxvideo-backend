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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-email'],
}));

// AWS S3 config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Upload vidéo
app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
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

  try {
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

// ✅ Authentification
app.post("/api/auth", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur DB." });

    if (results.length > 0) {
      const user = results[0];
      const now = new Date();
      const expiration = user.subscription_expiration ? new Date(user.subscription_expiration) : null;

      if (expiration && expiration < now) {
        db.query("UPDATE users SET isSubscribed = 0 WHERE email = ?", [email]);
        user.isSubscribed = 0;
      }

      return res.json({ message: "Connexion réussie", user });
    }

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
  });
});

// ✅ Config PayPal LIVE
const paypalEnv = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// ✅ Créer un lien de paiement
app.post("/api/payments/paypal", async (req, res) => {
  const { email } = req.body;

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: "EUR", value: "2.00" }
    }],
    application_context: {
      return_url: `https://streamxvideo-frontend.vercel.app/success?email=${encodeURIComponent(email)}&token=REPLACEME`,
      cancel_url: "https://streamxvideo-frontend.vercel.app?message=Paiement%20annulé"
    }
  });

  try {
    const order = await paypalClient.execute(request);
    const approvalLink = order.result.links.find(link => link.rel === "approve");
    const orderId = order.result.id;

    // On remplace le token dans l’URL de succès
    const successUrl = `https://streamxvideo-backend-production.up.railway.app/api/payments/success?email=${encodeURIComponent(email)}&token=${orderId}`;
    res.json({ url: approvalLink.href.replace("REPLACEME", orderId), orderId });
  } catch (err) {
    console.error("Erreur PayPal:", err);
    res.status(500).json({ error: "Erreur PayPal" });
  }
});

// ✅ Capture réelle du paiement PayPal
app.get("/api/payments/success", async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) {
    return res.status(400).json({ error: "Email ou token manquant." });
  }

  try {
    const captureRequest = new paypal.orders.OrdersCaptureRequest(token);
    const capture = await paypalClient.execute(captureRequest);

    if (capture.result.status !== "COMPLETED") {
      return res.status(400).send("Paiement non complété.");
    }

    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1);

    db.query(
      "UPDATE users SET isSubscribed = 1, subscription_expiration = ? WHERE email = ?",
      [expirationDate, email],
      (err) => {
        if (err) return res.status(500).send("Erreur lors de la mise à jour de l’abonnement.");
        res.redirect("https://streamxvideo-frontend.vercel.app?message=Abonnement%20activé");
      }
    );
  } catch (err) {
    console.error("Erreur PayPal :", err);
    res.status(500).send("Erreur lors de la capture du paiement.");
  }
});

// ✅ Lancer le serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🚀 Serveur lancé sur le port", PORT));


