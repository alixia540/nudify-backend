import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// 🧠 Vérification clé API sauf pour routes publiques
app.use((req, res, next) => {
  const openPaths = ["/api/login", "/api/register", "/api/paypal"];
  const isOpen = openPaths.some((p) => req.path.startsWith(p));

  if (isOpen) return next();

  const key = req.headers["x-api-key"];
  if (key === process.env.API_SECRET_KEY) return next();

  return res.status(403).json({ error: "Accès refusé : clé API invalide" });
});

// 💾 Connexion MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connecté à MongoDB"))
  .catch((err) => console.error("❌ Erreur MongoDB :", err));

// 🧱 Schéma utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  credits: { type: Number, default: 0 },
});
const User = mongoose.model("User", userSchema);

//
// 🧩 ROUTE INSCRIPTION
//
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Cet utilisateur existe déjà." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed, credits: 0 });
    await user.save();

    res.json({ message: "Compte créé avec succès" });
  } catch (err) {
    console.error("❌ Erreur création compte :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//
// 🧩 ROUTE CONNEXION
//
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Utilisateur introuvable" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Mot de passe incorrect" });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Connexion réussie", token });
  } catch (err) {
    console.error("❌ Erreur login :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//
// 💰 ROUTE CRÉDITS
//
app.get("/api/credits/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.json({ credits: 0 });
    res.json({ credits: user.credits });
  } catch (err) {
    console.error("❌ Erreur crédits :", err);
    res.status(500).json({ error: "Erreur récupération crédits" });
  }
});

//
// 💳 PAYPAL : créer une commande
//
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const basicAuth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString("base64");

    const response = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: amount,
            },
          },
        ],
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Erreur création commande PayPal :", err);
    res.status(500).json({ error: "Erreur création commande" });
  }
});

//
// 💳 PAYPAL : capturer le paiement et créditer le compte
//
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderId, email } = req.body;

    const basicAuth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString("base64");

    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.status === "COMPLETED") {
      const amount = parseFloat(data.purchase_units[0].payments.captures[0].amount.value);
      const creditsToAdd = Math.floor(amount); // 1€ = 1 crédit
      await User.findOneAndUpdate({ email }, { $inc: { credits: creditsToAdd } });
      res.json({ message: "✅ Paiement capturé", added: creditsToAdd });
    } else {
      res.status(400).json({ error: "Paiement non complété", data });
    }
  } catch (err) {
    console.error("❌ Erreur capture commande PayPal :", err);
    res.status(500).json({ error: "Erreur capture paiement" });
  }
});

//
// 🧪 ROUTE TEST
//
app.get("/api/test", (req, res) => {
  res.json({ message: "✅ Backend Nudify en ligne et fonctionnel !" });
});

//
// 🚀 Lancement du serveur
//
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur actif sur le port ${PORT} (mode sandbox)`);
});
