const express = require("express");
const router = express.Router();

// Exemple d'endpoint pour Stripe (ajouter clé API dans .env)
router.post("/stripe", async (req, res) => {
    try {
        const { amount, currency, userId } = req.body;

        // Simuler une transaction (à remplacer par l'API Stripe)
        const paymentIntent = {
            id: "pi_123456789",
            amount,
            currency,
            status: "succeeded",
        };

        res.json({ message: "Paiement réussi", paymentIntent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Exemple d'endpoint pour Crypto/Mobile Money
router.post("/crypto", async (req, res) => {
    try {
        const { userId, transactionId, amount } = req.body;
        // Simuler une validation de paiement
        res.json({ message: "Paiement en crypto validé", transactionId, amount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
