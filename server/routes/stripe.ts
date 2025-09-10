import type { RequestHandler } from "express";
import Stripe from "stripe";

function getStripe(): Stripe {
  // Prefer non-VITE env var for server secret key
  const secret =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET ||
    process.env.VITE_STRIPE_SECRET_KEY;
  if (!secret) throw new Error("stripe_not_configured: missing secret key");
  // basic sanity: secret key should start with sk_ (test or live)
  if (!/^sk_/.test(secret))
    throw new Error(
      "stripe_not_configured: invalid secret key, expected a secret (sk_...)",
    );
  return new Stripe(secret, { apiVersion: "2024-06-20" });
}

export const createCheckoutSession: RequestHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    const {
      amount,
      currency = "EUR",
      packId,
      description,
      success_url,
      cancel_url,
      uid,
      email,
    } = req.body as any;

    if (!amount) return res.status(400).json({ error: "missing_amount" });
    if (!success_url || !cancel_url)
      return res.status(400).json({ error: "missing_redirect_urls" });

    const unitAmount = Math.round(Number(amount) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0)
      return res.status(400).json({ error: "invalid_amount" });

    // Build a valid line_items array
    const line_items = [
      {
        price_data: {
          currency,
          product_data: { name: String(description || "RotCoins") },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${success_url}?success=1&pack=${encodeURIComponent(String(packId || ""))}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancel_url}?canceled=1`,
      metadata: {
        packId: packId ? String(packId) : "",
        uid: uid ? String(uid) : "",
        email: email ? String(email) : "",
        amount: String(amount),
        currency,
      },
    });

    // Return only the session id; frontend should call stripe.redirectToCheckout({ sessionId })
    res.json({ id: session.id });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("stripe:createCheckoutSession", e?.message || e);
    if (e?.message && String(e.message).includes("stripe_not_configured"))
      return res
        .status(400)
        .json({ error: "stripe_not_configured", message: String(e.message) });
    res.status(500).json({ error: "server_error", message: e?.message });
  }
};

export const verifySession: RequestHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    const id = (req.query.id as string) || (req.body && (req.body as any).id);
    if (!id) return res.status(400).json({ error: "missing_id" });
    const session = await stripe.checkout.sessions.retrieve(id);
    const paid = session.payment_status === "paid";
    res.json({
      ok: true,
      paid,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      metadata: session.metadata || {},
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("stripe:verifySession", e?.message || e);
    if (e?.message && String(e.message).includes("stripe_not_configured"))
      return res
        .status(400)
        .json({ error: "stripe_not_configured", message: String(e.message) });
    res.status(500).json({ error: "server_error", message: e?.message });
  }
};
