import PDFDocument from "pdfkit";

const MARGIN     = 50;
const PAGE_W     = 595.28;
const CONTENT_W  = PAGE_W - MARGIN * 2;   // 495.28

// ─── Invoice Number ───────────────────────────────────────────────────────────

export const generateInvoiceNumber = (): string => {
  const year   = new Date().getFullYear();
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `INV-${year}-${suffix}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  bindingType?: string;
  bindingExtra?: number;
};

export type InvoiceData = {
  invoiceNumber: string;
  orderId: string;
  createdAt: Date | string;
  customerName: string;
  customerEmail?: string;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  deliveryCharge?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  isPrintOrder?: boolean;
  printSpecs?: {
    colorType?: string;
    printSide?: string;
    orientation?: string;
    bindingType?: string;
    pageCount?: number;
    copies?: number;
  };
};

// ─── PDF Generation ───────────────────────────────────────────────────────────

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on("data",  (c: Buffer) => chunks.push(c));
      doc.on("end",   () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const DARK  = "#1d1a17";
      const RED   = "#8f2d22";
      const MUTED = "#9a9a9a";
      const BGLT  = "#f8f4ee";
      const WHITE = "#ffffff";

      const fmt = (n: number) => `Rs. ${n.toFixed(2)}`;
      const dateStr = new Date(data.createdAt).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });

      // ── Header ─────────────────────────────────────────────────────────────
      doc.rect(MARGIN, MARGIN, CONTENT_W, 70).fill(DARK);

      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(18)
        .text("AKASH BOOK CENTRE", MARGIN + 18, MARGIN + 14, { width: CONTENT_W * 0.55 });
      doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(9)
        .text("TAX INVOICE", MARGIN + 18, MARGIN + 38, { width: CONTENT_W * 0.55 });

      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(11)
        .text(data.invoiceNumber, MARGIN + CONTENT_W * 0.55, MARGIN + 14, {
          width: CONTENT_W * 0.45 - 18, align: "right",
        });
      doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(9)
        .text(dateStr, MARGIN + CONTENT_W * 0.55, MARGIN + 38, {
          width: CONTENT_W * 0.45 - 18, align: "right",
        });

      // ── Order reference band ───────────────────────────────────────────────
      doc.rect(MARGIN, MARGIN + 70, CONTENT_W, 24).fill(BGLT);
      doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("ORDER REFERENCE", MARGIN + 18, MARGIN + 79, { width: CONTENT_W * 0.5 });
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
        .text(`#${data.orderId.slice(0, 8).toUpperCase()}`, MARGIN + 18, MARGIN + 79, {
          width: CONTENT_W - 36, align: "right",
        });

      // ── Bill To ────────────────────────────────────────────────────────────
      let y = MARGIN + 114;
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("BILL TO", MARGIN + 18, y);
      y += 14;

      const addr    = data.shippingAddress;
      const nameTxt = addr?.name ?? data.customerName;
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(nameTxt, MARGIN + 18, y);
      y += 16;

      doc.font("Helvetica").fontSize(9).fillColor("#5a5a5a");
      if (addr?.line1) { doc.text(addr.line1, MARGIN + 18, y); y += 13; }
      if (addr?.line2) { doc.text(addr.line2, MARGIN + 18, y); y += 13; }
      if (addr?.city)  { doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, MARGIN + 18, y); y += 13; }
      if (addr?.phone) { doc.text(`Phone: ${addr.phone}`, MARGIN + 18, y); y += 13; }
      if (data.customerEmail) {
        doc.fillColor(MUTED).text(data.customerEmail, MARGIN + 18, y); y += 13;
      }

      // Payment method (right column)
      doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("PAYMENT METHOD", MARGIN + CONTENT_W * 0.6, MARGIN + 114, {
          width: CONTENT_W * 0.4 - 18, align: "right",
        });
      const pmLabel = data.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)";
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
        .text(pmLabel, MARGIN + CONTENT_W * 0.6, MARGIN + 128, {
          width: CONTENT_W * 0.4 - 18, align: "right",
        });

      // ── Print Specs (print orders only) ────────────────────────────────────
      if (data.isPrintOrder && data.printSpecs) {
        y = Math.max(y, MARGIN + 195) + 8;
        doc.rect(MARGIN, y, CONTENT_W, 18).fill(BGLT);
        doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("PRINT SPECIFICATIONS", MARGIN + 18, y + 5);
        y += 24;

        const specs: [string, string][] = [
          ["Print Type",  data.printSpecs.colorType === "color" ? "Color" : "Black & White"],
          ["Print Side",  data.printSpecs.printSide === "single" ? "Single Side" : "Both Sides"],
          ["Orientation", (data.printSpecs.orientation ?? "").charAt(0).toUpperCase() + (data.printSpecs.orientation ?? "").slice(1)],
          ["Binding",     data.printSpecs.bindingType === "spiral" ? "Spiral Binding" : "Staple Binding"],
          ["Total Pages", String(data.printSpecs.pageCount ?? 0)],
          ["Copies",      String(data.printSpecs.copies ?? 1)],
        ];
        for (const [k, v] of specs) {
          doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(k, MARGIN + 18, y, { width: 120 });
          doc.fillColor(DARK).font("Helvetica").fontSize(9).text(v, MARGIN + 140, y, { width: 200 });
          y += 14;
        }
        y += 6;
      }

      // ── Items table ────────────────────────────────────────────────────────
      y = Math.max(y, MARGIN + 200) + 10;

      // Header row
      doc.rect(MARGIN, y, CONTENT_W, 22).fill(DARK);
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(8);
      doc.text("ITEM",       MARGIN + 10,               y + 7, { width: CONTENT_W * 0.5 });
      doc.text("QTY",        MARGIN + CONTENT_W * 0.5,  y + 7, { width: CONTENT_W * 0.12, align: "center" });
      doc.text("UNIT PRICE", MARGIN + CONTENT_W * 0.62, y + 7, { width: CONTENT_W * 0.18, align: "right" });
      doc.text("AMOUNT",     MARGIN + CONTENT_W * 0.8,  y + 7, { width: CONTENT_W * 0.2 - 10, align: "right" });
      y += 22;

      let rowBg = false;
      for (const item of data.items) {
        const rowH = 20;
        if (rowBg) doc.rect(MARGIN, y, CONTENT_W, rowH).fill("#faf9f7");
        rowBg = !rowBg;

        const itemTotal = item.quantity * item.unitPrice + (item.bindingExtra ?? 0);
        let label = item.name;
        if (item.bindingType && item.bindingType !== "NONE") {
          label += ` (${item.bindingType === "SPIRAL" ? "Spiral" : "Staple"} Binding)`;
        }

        doc.fillColor(DARK).font("Helvetica").fontSize(9);
        doc.text(label,            MARGIN + 10,               y + 6, { width: CONTENT_W * 0.5 - 10, ellipsis: true });
        doc.text(String(item.quantity), MARGIN + CONTENT_W * 0.5,  y + 6, { width: CONTENT_W * 0.12, align: "center" });
        doc.text(fmt(item.unitPrice),   MARGIN + CONTENT_W * 0.62, y + 6, { width: CONTENT_W * 0.18, align: "right" });
        doc.text(fmt(itemTotal),        MARGIN + CONTENT_W * 0.8,  y + 6, { width: CONTENT_W * 0.2 - 10, align: "right" });
        y += rowH;
      }

      doc.rect(MARGIN, y, CONTENT_W, 0.5).fill("#e8e5df");
      y += 12;

      // ── Totals ─────────────────────────────────────────────────────────────
      const TL = MARGIN + CONTENT_W * 0.55;
      const TW = CONTENT_W * 0.45;

      const addRow = (label: string, value: string, bold = false, color = DARK) => {
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label, TL, y, { width: TW * 0.5 });
        doc.fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9)
          .text(value, TL + TW * 0.5, y, { width: TW * 0.5 - 5, align: "right" });
        y += 15;
      };

      addRow("Subtotal", fmt(data.subtotal));
      if ((data.deliveryCharge ?? 0) > 0) addRow("Delivery Charge", `+ ${fmt(data.deliveryCharge!)}`, false, "#92400e");
      if ((data.discount ?? 0) > 0)       addRow("Discount",        `- ${fmt(data.discount!)}`,       false, "#065f46");

      y += 4;
      doc.rect(TL, y, TW - 5, 0.5).fill("#d4d4d4");
      y += 8;

      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("TOTAL", TL, y, { width: TW * 0.5 });
      doc.fillColor(RED).font("Helvetica-Bold").fontSize(16)
        .text(fmt(data.total), TL + TW * 0.5, y - 3, { width: TW * 0.5 - 5, align: "right" });

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.rect(MARGIN, 800, CONTENT_W, 0.5).fill("#e8e5df");
      doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("Thank you for your purchase!  •  Akash Book Centre", MARGIN, 810, {
          width: CONTENT_W, align: "center",
        });
      doc.fillColor(MUTED).font("Helvetica").fontSize(7)
        .text("This is a computer-generated invoice.", MARGIN, 823, {
          width: CONTENT_W, align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
