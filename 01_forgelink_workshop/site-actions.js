export const WORKSHOP_PRODUCTS = [
  { id: "sliding_gate", name: "Heavy-Duty Sliding Steel Gate", base_labor_usd: 220, steel_rate_per_m2: 95, lead_days: 12 },
  { id: "parrilla_pro", name: "Custom Argentine Parrilla Grill", base_labor_usd: 180, steel_rate_per_m2: 110, lead_days: 8 },
  { id: "industrial_table", name: "Industrial Iron & Wood Dining Table Frame", base_labor_usd: 130, steel_rate_per_m2: 68, lead_days: 6 },
  { id: "security_grille", name: "Window Security Grille (12mm Solid Iron)", base_labor_usd: 95, steel_rate_per_m2: 74, lead_days: 5 }
];

export const FINISH_MULTIPLIER = {
  raw: { label: "Raw Welded Steel", factor: 1.0 },
  epoxy_matte: { label: "Anti-Rust Matte Black Epoxy", factor: 1.18 },
  galvanized: { label: "Hot-Dip Galvanized", factor: 1.28 }
};

export const WorkshopState = {
  version: 1,
  cart: [],
  orders: [],
  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  notify() { this.version += 1; this.listeners.forEach(fn => fn(this)); },

  calculateQuote({ product_id, width_m, height_m, finish = "epoxy_matte" }) {
    const prod = WORKSHOP_PRODUCTS.find(p => p.id === product_id);
    if (!prod) return { ok: false, reason: `Unknown product_id '${product_id}'.` };
    const w = Number(width_m), h = Number(height_m);
    if (!(w >= 0.4 && w <= 8 && h >= 0.4 && h <= 4)) {
      return { ok: false, reason: "Dimensions must be between 0.4m–8.0m width and 0.4m–4.0m height." };
    }
    const fin = FINISH_MULTIPLIER[finish] || FINISH_MULTIPLIER.epoxy_matte;
    const area = +(w * h).toFixed(2);
    const total = +((prod.base_labor_usd + area * prod.steel_rate_per_m2) * fin.factor).toFixed(2);
    return {
      ok: true,
      quote: {
        product_id: prod.id,
        product_name: prod.name,
        width_m: w,
        height_m: h,
        area_m2: area,
        finish: fin.label,
        lead_days: prod.lead_days,
        total_usd: total
      },
      summary: `${prod.name} (${w}m x ${h}m, ${fin.label}) = $${total} USD`
    };
  },

  addQuoteToCart(quoteArgs) {
    const q = this.calculateQuote(quoteArgs);
    if (!q.ok) return q;
    this.cart.push(q.quote);
    this.notify();
    return { ok: true, cart_count: this.cart.length, cart_version: this.version, item: q.quote, summary: `Added ${q.quote.product_name} ($${q.quote.total_usd} USD) to cart` };
  },

  preflightOrder({ customer_name, customer_email, expected_version }) {
    if (this.cart.length === 0) return { ok: false, reason: "Your fabrication cart is empty. Add a quote first." };
    if (!customer_name || !customer_email) return { ok: false, reason: "Customer name and email are required." };
    if (expected_version && expected_version !== this.version) {
      return { ok: false, reason: "Cart changed since quote review. Please review the updated total." };
    }
    const grandTotal = +this.cart.reduce((s, i) => s + i.total_usd, 0).toFixed(2);
    return {
      ok: true,
      dialogTitle: "Confirm Custom Fabrication Order (Demo)",
      confirmLabel: "Place Fabrication Order",
      cancelLabel: "Keep Editing Cart",
      summaryRows: [
        ["Customer", `${customer_name} (${customer_email})`],
        ["Items", this.cart.map(i => `${i.product_name} ${i.width_m}x${i.height_m}m`).join(", ")],
        ["Grand Total", `$${grandTotal.toFixed(2)} USD`],
        ["Cart Version", `v${this.version}`]
      ]
    };
  },

  submitOrder({ customer_name, customer_email }) {
    const grandTotal = +this.cart.reduce((s, i) => s + i.total_usd, 0).toFixed(2);
    const order = {
      order_id: `FL-${Date.now().toString().slice(-6)}`,
      customer_name,
      customer_email,
      items: [...this.cart],
      total_usd: grandTotal,
      created_at: new Date().toISOString()
    };
    this.orders.unshift(order);
    this.cart = [];
    this.notify();
    return { ok: true, order, summary: `Order ${order.order_id} confirmed ($${grandTotal.toFixed(2)} USD)` };
  }
};
