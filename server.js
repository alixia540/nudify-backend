require("dotenv").config();
const express = require("express");
const cors = require("cors");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
app.use(express.json());

// ✅ Autorise ton site local ET ton site en ligne
app.use(
  cors({
    origin: ["http://localhost:3000", "https://nudify-france.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// ✅ Configuration PayPal
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

// ✅ Créer une commande PayPal
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "EUR",
            value: "5.00", // 💶 Montant à adapter si besoin
          },
        },
      ],
    });

    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Capturer une commande PayPal
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client.execute(request);
    res.json(capture.result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Exemple : gestion des crédits (factice pour l’instant)
app.get("/api/credits/:email", (req, res) => {
  const { email } = req.params;
  res.json({ email, credits: 10 }); // Tu pourras remplacer ça par une vraie BDD plus tard
});

// ✅ Démarrage du serveur
const PORT = process.env.PORT || 5000;
// ✅ Route temporaire pour tester les crédits
app.get("/api/credits/:email", (req, res) => {
  const { email } = req.params;
  res.json({ email, credits: 10 });
});

app.listen(PORT, () => console.log(`✅ Serveur backend en ligne sur le port ${PORT}`));
