const paypal = require('@paypal/checkout-server-sdk');
require('dotenv').config();

function environment() {
  if (process.env.PAYPAL_MODE === "live") {
    return new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
  }
  return new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
}

const client = new paypal.core.PayPalHttpClient(environment());

module.exports = { paypal, client };
