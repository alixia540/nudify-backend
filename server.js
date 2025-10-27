// === Importations et configuration ===
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { paypal, client } = require('./paypal');

// Initialise Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// === ROUTES PAYPAL ===

// Créer une commande
app.post('/api/paypal/create-order', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email requis" });

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: "EUR", value: "5.00" },
      description: "Pack de 100 crédits Nudify",
    }],
  });

  try {
    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création commande PayPal" });
  }
});

// Capturer le paiement
app.post('/api/paypal/capture-order', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "orderId manquant" });

  const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
  captureRequest.requestBody({});

  try {
    const capture = await client.execute(captureRequest);
    console.log("✅ Paiement PayPal capturé:", capture.result.status);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur capture paiement" });
  }
});

// === Lancement du serveur ===
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`✅ Backend on http://localhost:${PORT}`);
});
