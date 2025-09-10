import type { RequestHandler } from "express";

const PAYPAL_API_LIVE = "https://api-m.paypal.com";
const PAYPAL_API_SANDBOX = "https://api-m.sandbox.paypal.com";

async function getAccessTokenFor(
  apiBase: string,
  clientId: string,
  secret: string,
) {
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `Failed to obtain PayPal token from ${apiBase}: ${res.status} ${txt}`,
    );
  }
  const data = await res.json();
  return data.access_token as string;
}

export const createOrder: RequestHandler = async (req, res) => {
  try {
    const {
      amount,
      currency = "EUR",
      return_url,
      cancel_url,
      custom_id,
    } = req.body as any;
    const clientId =
      process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const secret =
      process.env.PAYPAL_CLIENT_SECRET ||
      process.env.VITE_PAYPAL_CLIENT_SECRET ||
      process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret)
      return res.status(400).json({ error: "paypal_not_configured" });

    if (!amount) return res.status(400).json({ error: "missing_amount" });

    // Try live first, then sandbox if authentication fails
    let accessToken: string | null = null;
    let apiBase = PAYPAL_API_LIVE;
    try {
      accessToken = await getAccessTokenFor(apiBase, clientId, secret);
    } catch (e) {
      console.warn(
        "Live PayPal token request failed, trying sandbox:",
        e?.message || e,
      );
      try {
        apiBase = PAYPAL_API_SANDBOX;
        accessToken = await getAccessTokenFor(apiBase, clientId, secret);
      } catch (e2) {
        console.error(
          "Both live and sandbox token requests failed:",
          e2?.message || e2,
        );
        return res
          .status(502)
          .json({
            error: "paypal_auth_failed",
            message: String(e2?.message || e2),
          });
      }
    }

    const orderBody: any = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
          },
        },
      ],
    };
    if (custom_id) orderBody.purchase_units[0].custom_id = String(custom_id);
    if (return_url || cancel_url) {
      orderBody.application_context = {
        return_url: return_url || undefined,
        cancel_url: cancel_url || undefined,
      };
    }

    const createRes = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    if (!createRes.ok) {
      const status = createRes.status;
      // attempt to parse JSON body
      let bodyTxt = await createRes.text();
      try {
        const parsed = JSON.parse(bodyTxt);
        // If PayPal returns unprocessable entity with payee restriction, surface that clearly
        if (
          status === 422 &&
          parsed?.details?.some(
            (d: any) => d.issue === "PAYEE_ACCOUNT_RESTRICTED",
          )
        ) {
          console.error(
            "PayPal create order failed - PAYEE_ACCOUNT_RESTRICTED:",
            parsed,
          );
          return res
            .status(422)
            .json({
              error: "payee_account_restricted",
              debug_id: parsed?.debug_id || parsed?.details?.[0]?.debug_id || null,
              details: parsed,
            });
        }
        console.error("PayPal create order failed:", status, parsed);
        return res
          .status(500)
          .json({
            error: "create_order_failed",
            debug_id: parsed?.debug_id || null,
            details: parsed,
          });
      } catch (e) {
        console.error(
          "PayPal create order failed (non-JSON):",
          status,
          bodyTxt,
        );
        return res
          .status(500)
          .json({ error: "create_order_failed", details: bodyTxt });
      }
    }

    const order = await createRes.json();
    // find approval link
    const approve = (order.links || []).find((l: any) => l.rel === "approve");
    res.json({ order, approveUrl: approve?.href || null });
  } catch (e: any) {
    console.error("createOrder error", e?.message || e);
    res.status(500).json({ error: "server_error", message: e?.message });
  }
};
