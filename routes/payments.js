const express = require("express");
const router = express.Router();

const express = require("express");
const router = express.Router();
const db = require("../db"); // Connexion MySQL
const paypal = require("@paypal/checkout-server-sdk");

// 📌 Configuration du SDK PayPal
const paypalClient = new paypal.core.PayPalHttpClient(
    new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET)
);

// ✅ Endpoint de paiement via PayPal
router.post("/paypal", async (req, res) => {
    try {
        const { orderID, userId } = req.body;

        // Vérifier le paiement PayPal
        const request = new paypal.orders.OrdersGetRequest(orderID);
        const response = await paypalClient.execute(request);

        if (response.result.status !== "COMPLETED") {
            return res.status(400).json({ error: "Le paiement PayPal n'est pas complété." });
        }

        // Mise à jour de l'abonnement de l'utilisateur
        db.query("UPDATE users SET isSubscribed = 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: "Erreur mise à jour abonnement." });
            res.json({ message: "✅ Paiement PayPal validé, abonnement activé !" });
        });
    } catch (error) {
        console.error("❌ Erreur PayPal:", error);
        res.status(500).json({ error: "Erreur lors du paiement PayPal" });
    }
});

// ✅ Endpoint pour paiement Crypto/Mobile Money (simulé)
router.post("/crypto", async (req, res) => {
    try {
        const { userId, transactionId, amount } = req.body;

        // 🔥 Ici, tu devras ajouter la logique de validation des paiements Crypto/Mobile Money

        // Mise à jour de l'abonnement en base
        db.query("UPDATE users SET isSubscribed = 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: "Erreur mise à jour abonnement." });
            res.json({ message: "✅ Paiement Crypto/Mobile Money validé, abonnement activé !" });
        });
    } catch (error) {
        console.error("❌ Erreur Crypto/Mobile Money:", error);
        res.status(500).json({ error: "Erreur validation paiement Crypto/Mobile Money" });
    }
});

module.exports = router;
