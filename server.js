// 🟢 Redeploy trigger - PayDunya update

require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");
const db = require("./db");
const paypal = require("@paypal/checkout-server-sdk");
const paydunya = require("paydunya"); // ✅ Ajout PayDunya

const app = express();
app.use(express.json());

const allowedOrigins = [
  "https://www.streamxvideo.com",
  "https://streamxvideo.com",
  "https://streamxvideo-frontend.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS non autorisé"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "user-email"]
}));


// ✅ AWS S3 Config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const upload = multer({ storage: multer.memoryStorage() });

// ✅ PayDunya Setup (mode production)
paydunya.setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: "live", 
});

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
  db.query("SELECT id, title, file_path, thumbnail_path, uploaded_at FROM videos", (err, results) => {
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

// ✅ PayPal Live Config
const paypalEnv = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// ✅ Création lien de paiement PayPal
app.post("/api/payments/paypal", async (req, res) => {
  const { email } = req.body;

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "EUR", value: "2.00" } }],
    application_context: {
      return_url: `https://streamxvideo-frontend.vercel.app/success?email=${encodeURIComponent(email)}`,
      cancel_url: "https://streamxvideo-frontend.vercel.app?message=Paiement%20annulé"
    }
  });

  try {
    const order = await paypalClient.execute(request);
    const approvalLink = order.result.links.find(link => link.rel === "approve");
    res.json({ url: approvalLink.href });
  } catch (err) {
    console.error("Erreur PayPal:", err);
    res.status(500).json({ error: "Erreur PayPal" });
  }
});

// ✅ Capture PayPal
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

app.post("/api/payments/paydunya", async (req, res) => {
  const { email } = req.body;
  console.log("📩 Reçu du frontend :", req.body);

  if (!email) {
    return res.status(400).json({ error: "Email manquant dans la requête" });
  }

  try {
    const store = new paydunya.Store();
    store.setName("StreamX Video");
    store.setTagline("Accès premium 1 mois");
    store.setPhoneNumber("+491234567890");
    store.setPostalAddress("Kaiserslautern, Allemagne");
    store.setWebsiteUrl("https://streamxvideo.com");
    store.setLogoUrl("https://streamxvideo.com/logo.png");

    const invoice = new paydunya.CheckoutInvoice(store);

    // ✅ Produit avec valeurs cohérentes (nom, quantité, prix unitaire, prix total, description)
    invoice.addItem("Abonnement 1 mois", 1, 1300, 1300, "Accès complet aux vidéos");

    // ✅ Montant total
    invoice.setTotalAmount(1300);

    // ✅ URLs de redirection (important !)
    invoice.setReturnUrl("https://streamxvideo.com/success");
    invoice.setCancelUrl("https://streamxvideo.com/cancel");

    // ✅ Callback pour activer l'abonnement après paiement
    invoice.setCallbackUrl("https://streamxvideo-backend-production.up.railway.app/api/payments/paydunya/ipn");

    // ✅ Informations personnalisées (email)
    invoice.setCustomData({ email });

    // ✅ Devise
    invoice.setCurrency("XOF"); // Obligatoire pour les montants en FCFA

    const resp = await invoice.create();

    if (resp && resp.response && resp.response.invoice_url) {
      return res.json({ url: resp.response.invoice_url });
    } else {
      console.error("❌ Réponse inattendue PayDunya :", resp);
      return res.status(500).json({ error: "Lien non généré" });
    }

  } catch (err) {
    console.error("❌ Erreur PayDunya :", err?.response || err.message || err);
    res.status(500).json({ error: "Erreur PayDunya" });
  }
});



// ✅ IPN (notifié par PayDunya)
app.post("/api/payments/paydunya/ipn", (req, res) => {
  const { status, custom_data } = req.body;
  const email = custom_data?.email;

  if (status === "completed" && email) {
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1);

    db.query(
      "UPDATE users SET isSubscribed = 1, subscription_expiration = ? WHERE email = ?",
      [expirationDate, email],
      (err) => {
        if (err) {
          console.error("Erreur DB PayDunya:", err);
          return res.status(500).send("Erreur DB.");
        }
        res.send("Abonnement activé !");
      }
    );
  } else {
    res.status(400).send("Paiement non valide ou email manquant.");
  }
});

// ✅ Lancer serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🚀 Serveur lancé sur le port", PORT));
