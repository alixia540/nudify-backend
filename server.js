const db = require('./db');
// === ROUTES CREDITS ===

// Récupérer le solde d'un utilisateur
app.get('/api/credits/:email', (req, res) => {
  const { email } = req.params;
  const row = db.prepare('SELECT credits FROM users WHERE email = ?').get(email);
  res.json({ credits: row ? row.credits : 0 });
});

// Ajouter des crédits (après paiement)
app.post('/api/credits/add', (req, res) => {
  const { email, amount } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    db.prepare('UPDATE users SET credits = credits + ? WHERE email = ?').run(amount, email);
  } else {
    db.prepare('INSERT INTO users (email, credits) VALUES (?, ?)').run(email, amount);
  }
  res.json({ success: true });
});

// Déduire des crédits (après génération d'image)
app.post('/api/credits/use', (req, res) => {
  const { email, amount } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || user.credits < amount) {
    return res.status(400).json({ error: "Crédits insuffisants" });
  }
  db.prepare('UPDATE users SET credits = credits - ? WHERE email = ?').run(amount, email);
  res.json({ success: true });
});

// === Importations et configuration ===
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { paypal, client } = require('./paypal');

// Initialise Express
const app = express();

// Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'https://nudify-france.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true
}));


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
   // Après paiement réussi, on ajoute 100 crédits à l'utilisateur
if (capture.result.status === "COMPLETED") {
  const email = req.body.email;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    db.prepare('UPDATE users SET credits = credits + 100 WHERE email = ?').run(email);
  } else {
    db.prepare('INSERT INTO users (email, credits) VALUES (?, ?)').run(email, 100);
  }
}

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
