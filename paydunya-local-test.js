// ✅ paydunya-test.js
const express = require("express");
const paydunya = require("paydunya");

const app = express();

paydunya.setup({
  masterKey: "fth7y5r8-Ln0H-er44-Zs1S-aB1zGm04BFZq", // ✅ Clé principale (pas dans les clés API)
  privateKey: "test_private_i0euOIEaRnoxx1UFP1dRHsgTkOI",
  publicKey: "test_public_pONyNRgYqkMyDnJ2xe9g0VBTwbo",
  token: "Ra5RoqHIUGBRITRINZ0d",
  mode: "test",
  store: {
    name: "StreamX Video",
    tagline: "Accès premium",
    phoneNumber: "+221772345678",
    postalAddress: "Dakar, Sénégal",
    logoURL: "https://streamxvideo.com/logo.png"
  }
});

app.get("/test-paydunya", async (req, res) => {
  console.log("✅ Route GET /test-paydunya déclenchée");

  const store = new paydunya.Store();
  store.setName("StreamX Video");
  store.setTagline("Accès premium aux vidéos adultes");
  store.setPhoneNumber("+221772345678");
  store.setPostalAddress("Dakar, Sénégal");
  store.setWebsiteUrl("https://streamxvideo.com");
  store.setLogoUrl("https://streamxvideo.com/logo.png");

  const invoice = new paydunya.CheckoutInvoice(store);
  invoice.addItem("Abonnement", 1, 1.0, "Accès complet");
  invoice.setTotalAmount(1);
  invoice.setReturnUrl("https://streamxvideo.com/success");
  invoice.setCancelUrl("https://streamxvideo.com/cancel");

  try {
    const resp = await invoice.create();
    res.json({ url: resp.response.invoice_url });
  } catch (err) {
    console.error("❌ Erreur PayDunya :", err);
    res.status(500).json({ error: "Erreur PayDunya" });
  }
});

app.listen(8080, () => {
  console.log("🚀 Serveur local PayDunya actif : http://localhost:8080");
});
