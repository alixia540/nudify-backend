import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import paypal from "@paypal/checkout-server-sdk";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// --- 1️⃣ Connexion MongoDB ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connecté à MongoDB"))
  .catch((err) => console.error("❌ Erreur MongoDB :", err));

// --- 2️⃣ Schéma utilisateur ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  credits: { type: Number, default: 0 },
});
const User = mongoose.model("User", userSchema);

// --- 3️⃣ Configuration PayPal ---
const paypalEnv = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// --- 4️⃣ Créer une commande ---
app.post("/api/paypal/create-order", async (req, res) => {
  const { amount } = req.body;

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "EUR", value: amount } }],
  });

  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur création commande");
  }
});

// --- 5️⃣ Capturer une commande PayPal et ajouter des crédits ---
app.post("/api/paypal/capture-order", async (req, res) => {
  const { orderID, email } = req.body;

  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await paypalClient.execute(request);
    const amount = parseFloat(
      capture.result.purchase_units[0].payments.captures[0].amount.value
    );

    let creditsToAdd = 0;
    if (amount === 1) creditsToAdd = 1; // 1€ = 1 crédit
    else if (amount === 15) creditsToAdd = 20; // VIP
    else if (amount === 30) creditsToAdd = 50; // PREMIUM

    const user = await User.findOneAndUpdate(
      { email },
      { $inc: { credits: creditsToAdd } },
      { new: true, upsert: true }
    );

    res.json({ success: true, credits: user.credits });
  } catch (err) {
    console.error("Erreur capture PayPal :", err);
    res.status(500).send("Erreur capture commande");
  }
});

// --- 6️⃣ Récupérer les crédits d’un utilisateur ---
app.get("/api/credits/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Si l'utilisateur n'existe pas encore → renvoyer 0
      return res.json({ credits: 0 });
    }
    // Sinon renvoyer ses vrais crédits
    res.json({ credits: user.credits });
  } catch (err) {
    console.error("Erreur récupération crédits :", err);
    res.status(500).send("Erreur récupération crédits");
  }
});


// --- 7️⃣ Lancement du serveur ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
