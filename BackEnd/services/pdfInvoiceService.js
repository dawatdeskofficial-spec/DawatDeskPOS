const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Ensure storage directory exists (uses /tmp on serverless environments like Vercel)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const INVOICE_DIR = isServerless ? path.join('/tmp', 'invoices') : path.join(__dirname, '../public/invoices');

try {
  if (!fs.existsSync(INVOICE_DIR)) {
    fs.mkdirSync(INVOICE_DIR, { recursive: true });
  }
} catch (dirErr) {
  logger.warn(`Could not create INVOICE_DIR: ${dirErr.message}`);
}

class PdfInvoiceService {
  /**
   * Generates a professional PDF invoice for a completed payment.
   * @param {Object} params
   * @param {Object} params.payment - The Payment document or object
   * @param {Object} params.order - The Order document or object
   * @param {Array} params.orderItems - List of OrderItems
   * @param {Object} params.restaurant - Restaurant details
   * @param {Object} [params.cashier] - Cashier user object
   * @returns {Promise<{ buffer: Buffer, filePath: string, fileName: string }>}
   */
  async generateInvoicePdf({ payment, order, orderItems = [], restaurant, cashier = null }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Invoice - ${payment.receiptNumber}`,
            Author: restaurant?.name || 'DawatDesk Restaurant',
            Subject: `Tax Invoice for Order ${String(order._id).slice(-8)}`,
          },
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        const fileName = `${payment.receiptNumber || 'INVOICE_' + order._id}.pdf`;
        const filePath = path.join(INVOICE_DIR, fileName);
        try {
          const fileStream = fs.createWriteStream(filePath);
          fileStream.on('error', (err) => {
            logger.warn(`PDF fileStream error: ${err.message}`);
          });
          doc.pipe(fileStream);
        } catch (streamErr) {
          logger.warn(`Could not pipe PDF to file: ${streamErr.message}`);
        }

        // Palette
        const primaryColor = '#0F172A'; // Slate 900
        const accentColor = '#D97706'; // Amber 600 / Dawat Gold
        const textDark = '#1E293B'; // Slate 800
        const textMuted = '#64748B'; // Slate 500
        const borderLight = '#E2E8F0'; // Slate 200
        const bgLight = '#F8FAFC'; // Slate 50

        // ── 1. HEADER SECTION ────────────────────────────────────────────────
        const restName = restaurant?.name || 'DawatDesk Restaurant';
        const restPhone = restaurant?.phone || '';
        const restEmail = restaurant?.email || '';
        const restGst = restaurant?.gstNumber ? `GSTIN: ${restaurant.gstNumber}` : '';
        const addrObj = restaurant?.address || {};
        const restAddress = [
          addrObj.street,
          addrObj.city,
          addrObj.state ? `${addrObj.state} ${addrObj.zipCode || ''}` : '',
        ]
          .filter(Boolean)
          .join(', ') || restaurant?.location || '';

        // Restaurant Brand Header
        doc
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .fontSize(22)
          .text(restName, 40, 40);

        doc
          .fillColor(textMuted)
          .font('Helvetica')
          .fontSize(9)
          .text(restAddress, 40, 68)
          .text(`Phone: ${restPhone}${restEmail ? ' | Email: ' + restEmail : ''}`, 40, 80);

        if (restGst) {
          doc.text(restGst, 40, 92);
        }

        // Invoice Badge on Top Right
        const badgeY = 40;
        doc
          .roundedRect(420, badgeY, 135, 24, 4)
          .fill(bgLight)
          .stroke(borderLight);

        doc
          .fillColor(accentColor)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('TAX INVOICE', 420, badgeY + 6, { width: 135, align: 'center' });

        doc
          .fillColor(textMuted)
          .font('Helvetica')
          .fontSize(8.5)
          .text(`Receipt: ${payment.receiptNumber}`, 370, badgeY + 34, { width: 185, align: 'right' })
          .text(`Date: ${new Date(payment.paidAt || payment.createdAt || Date.now()).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}`, 370, badgeY + 47, { width: 185, align: 'right' });

        // Divider
        doc
          .moveTo(40, 115)
          .lineTo(555, 115)
          .strokeColor(borderLight)
          .lineWidth(1)
          .stroke();

        // ── 2. METADATA CARDS ────────────────────────────────────────────────
        const cardY = 125;
        const cardH = 68;
        const colW = 250;

        // Billed To Box
        doc
          .roundedRect(40, cardY, colW, cardH, 6)
          .fillAndStroke(bgLight, borderLight);

        doc
          .fillColor(textMuted)
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('BILLED TO (CUSTOMER)', 52, cardY + 10);

        const custName = order.customerName || 'Valued Guest';
        const custPhone = order.customerPhone || 'Not Specified';

        doc
          .fillColor(textDark)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(custName, 52, cardY + 24, { width: colW - 24, ellipsis: true });

        doc
          .fillColor(textMuted)
          .font('Helvetica')
          .fontSize(9)
          .text(`Phone: ${custPhone}`, 52, cardY + 40)
          .text(order.orderType === 'PARCEL' ? 'Type: Takeaway / Parcel' : `Dine-In (Table ${order.tableNumber || 'N/A'})`, 52, cardY + 52);

        // Order & Payment Details Box
        doc
          .roundedRect(305, cardY, colW, cardH, 6)
          .fillAndStroke(bgLight, borderLight);

        doc
          .fillColor(textMuted)
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('ORDER & PAYMENT DETAILS', 317, cardY + 10);

        const orderRef = String(order._id).slice(-8).toUpperCase();
        const pMethod = String(payment.paymentMethod || 'CASH').replace(/_/g, ' ');
        const cashierName = cashier?.name || 'Counter Cashier';

        doc
          .fillColor(textDark)
          .font('Helvetica')
          .fontSize(9)
          .text(`Order ID: #${orderRef}`, 317, cardY + 24)
          .text(`Method: ${pMethod}`, 317, cardY + 38)
          .text(`Billed By: ${cashierName}`, 317, cardY + 52);

        // ── 3. ITEMS TABLE ───────────────────────────────────────────────────
        let tableY = 205;
        const rowH = 22;

        // Table Header
        doc
          .roundedRect(40, tableY, 515, 24, 4)
          .fill(primaryColor);

        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(9);

        doc.text('#', 50, tableY + 7, { width: 25 });
        doc.text('ITEM DESCRIPTION', 80, tableY + 7, { width: 230 });
        doc.text('QTY', 315, tableY + 7, { width: 45, align: 'center' });
        doc.text('RATE (Rs.)', 370, tableY + 7, { width: 80, align: 'right' });
        doc.text('AMOUNT (Rs.)', 460, tableY + 7, { width: 85, align: 'right' });

        tableY += 28;

        // Consolidate Items
        const consolidated = {};
        for (const it of orderItems) {
          if (it.status === 'CANCELLED') continue;
          const key = it.menuItemId?._id || it.menuItemId || it.name;
          const name = it.menuItemId?.name || it.name || 'Menu Item';
          const price = Number(it.price || 0);
          const qty = Number(it.quantity || 1);
          if (!consolidated[key]) {
            consolidated[key] = { name, price, qty };
          } else {
            consolidated[key].qty += qty;
          }
        }

        const itemsList = Object.values(consolidated);
        doc.font('Helvetica').fontSize(9);

        itemsList.forEach((item, index) => {
          const lineTotal = item.price * item.qty;

          // Alternate row shading
          if (index % 2 === 0) {
            doc.rect(40, tableY, 515, rowH).fill('#F8FAFC');
          }

          doc.fillColor(textDark);
          doc.text(String(index + 1), 50, tableY + 6, { width: 25 });
          doc.text(item.name, 80, tableY + 6, { width: 230, ellipsis: true });
          doc.text(String(item.qty), 315, tableY + 6, { width: 45, align: 'center' });
          doc.text(item.price.toFixed(2), 370, tableY + 6, { width: 80, align: 'right' });
          doc.font('Helvetica-Bold').text(lineTotal.toFixed(2), 460, tableY + 6, { width: 85, align: 'right' });
          doc.font('Helvetica');

          tableY += rowH;
        });

        // Bottom border of table
        doc
          .moveTo(40, tableY)
          .lineTo(555, tableY)
          .strokeColor(borderLight)
          .stroke();

        tableY += 12;

        // ── 4. TOTALS SUMMARY BOX ────────────────────────────────────────────
        const summaryW = 230;
        const summaryX = 325;
        let summaryY = tableY;

        const subtotal = Number(payment.subtotal || 0);
        const discount = Number(payment.discount || 0);
        const gstPct = Number(payment.gstPercentage || restaurant?.gstPercentage || 5);
        const gstAmount = Number(payment.gstAmount || 0);
        const cgstAmount = gstAmount / 2;
        const sgstAmount = gstAmount / 2;
        const grandTotal = Number(payment.totalAmount || 0);

        // Subtotal
        doc.fillColor(textMuted).font('Helvetica').fontSize(9);
        doc.text('Subtotal:', summaryX, summaryY);
        doc.fillColor(textDark).font('Helvetica-Bold').text(`Rs. ${subtotal.toFixed(2)}`, summaryX, summaryY, { width: summaryW, align: 'right' });
        summaryY += 16;

        // Discount
        if (discount > 0) {
          doc.fillColor(textMuted).font('Helvetica').text('Discount:', summaryX, summaryY);
          doc.fillColor('#16A34A').font('Helvetica-Bold').text(`- Rs. ${discount.toFixed(2)}`, summaryX, summaryY, { width: summaryW, align: 'right' });
          summaryY += 16;
        }

        // GST
        const halfPct = (gstPct / 2).toFixed(1);
        doc.fillColor(textMuted).font('Helvetica').text(`CGST (${halfPct}%):`, summaryX, summaryY);
        doc.fillColor(textDark).text(`Rs. ${cgstAmount.toFixed(2)}`, summaryX, summaryY, { width: summaryW, align: 'right' });
        summaryY += 16;

        doc.fillColor(textMuted).text(`SGST (${halfPct}%):`, summaryX, summaryY);
        doc.fillColor(textDark).text(`Rs. ${sgstAmount.toFixed(2)}`, summaryX, summaryY, { width: summaryW, align: 'right' });
        summaryY += 20;

        // Grand Total Box
        doc
          .roundedRect(summaryX - 10, summaryY - 4, summaryW + 10, 32, 4)
          .fill(primaryColor);

        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('GRAND TOTAL:', summaryX, summaryY + 5);

        doc
          .fontSize(13)
          .text(`Rs. ${grandTotal.toFixed(2)}`, summaryX, summaryY + 4, { width: summaryW, align: 'right' });

        // Paid Stamp
        doc
          .save()
          .translate(100, summaryY - 20)
          .rotate(-12)
          .rect(0, 0, 110, 36)
          .lineWidth(2)
          .strokeColor('#16A34A')
          .stroke();

        doc
          .fillColor('#16A34A')
          .font('Helvetica-Bold')
          .fontSize(16)
          .text('PAID', 0, 9, { width: 110, align: 'center' });
        doc.restore();

        // ── 5. FOOTER ────────────────────────────────────────────────────────
        const footerY = 740;
        doc
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .strokeColor(borderLight)
          .lineWidth(1)
          .stroke();

        doc
          .fillColor(accentColor)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('Thank you for dining with us! Please visit again.', 40, footerY + 12, { align: 'center' });

        doc
          .fillColor(textMuted)
          .font('Helvetica')
          .fontSize(8)
          .text('Powered by DawatDesk Restaurant Management System', 40, footerY + 28, { align: 'center' })
          .text('For queries or support, contact the restaurant front desk.', 40, footerY + 38, { align: 'center' });

        doc.on('end', () => {
          const buffer = Buffer.concat(buffers);
          resolve({
            buffer,
            filePath,
            fileName,
          });
        });

        doc.on('error', (err) => {
          logger.error(`PDF doc error: ${err.message}`);
          reject(err);
        });

        doc.end();
      } catch (err) {
        logger.error(`PDF generation error: ${err.message}`);
        reject(err);
      }
    });
  }
}

module.exports = new PdfInvoiceService();
