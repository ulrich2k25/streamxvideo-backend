const express = require("express");
const bodyParser = require("body-parser");
const paydunya = require("paydunya");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

paydunya.setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: "live",
  store: {
    name: "StreamX Video",
    tagline: "Accès premium aux vidéos adultes",
    phoneNumber: "+221772345678",
    postalAddress: "Dakar, Sénégal",
    logoURL: "https://streamxvideo.com/logo.png"
  }
});

app.post("/payer", async (req, res) => {
  console.log("📧 Email reçu :", req.body.email);

  const store = new paydunya.Store();
  store.setName("StreamX Video");
  store.setTagline("Accès premium aux vidéos adultes");
  store.setPhoneNumber("+221772345678");
  store.setPostalAddress("Dakar, Sénégal");
  store.setWebsiteUrl("https://streamxvideo.com");
  store.setLogoUrl("https://streamxvideo.com/logo.png");

  const invoice = new paydunya.CheckoutInvoice(store);
  invoice.addItem("Abonnement", 1, 1, 0, "Accès complet");
  invoice.setTotalAmount(1);
  invoice.setReturnUrl("https://streamxvideo.com/success");
  invoice.setCancelUrl("https://streamxvideo.com/cancel");

  try {
    const resp = await invoice.create();
    res.json({ url: resp.response.invoice_url });
  } catch (err) {
    console.error("❌ Erreur PayDunya:", err);
    res.status(500).json({ error: "Erreur PayDunya" });
  }
});

app.listen(8080, () => {
  console.log("🚀 Serveur local PayDunya : http://localhost:8080");
});
