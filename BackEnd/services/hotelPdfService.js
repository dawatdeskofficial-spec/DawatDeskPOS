const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const INVOICE_DIR = isServerless ? path.join('/tmp', 'hotel-invoices') : path.join(__dirname, '../public/hotel-invoices');

try {
  if (!fs.existsSync(INVOICE_DIR)) {
    fs.mkdirSync(INVOICE_DIR, { recursive: true });
  }
} catch (dirErr) {
  logger.warn(`Could not create hotel INVOICE_DIR: ${dirErr.message}`);
}

class HotelPdfService {
  /**
   * Generates a professional Hotel Tax Invoice PDF.
   */
  async generateHotelInvoicePdf({ invoice, booking, restaurant, cashier = null }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Hotel Invoice - ${invoice.invoiceNumber}`,
            Author: restaurant?.name || 'DawatDesk Hotel',
            Subject: `Hotel Stay Tax Invoice for Room ${invoice.roomNumber}`,
          },
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        const fileName = `${invoice.invoiceNumber}.pdf`;
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

        // Colors
        const primaryColor = '#0F172A'; // Slate 900
        const accentColor = '#2563EB'; // Royal Blue 600
        const textDark = '#1E293B';
        const textMuted = '#64748B';
        const borderLight = '#E2E8F0';
        const bgLight = '#F8FAFC';

        // 1. HEADER
        const propName = restaurant?.name || 'DawatDesk Grand Hotel & Suites';
        const propPhone = restaurant?.phone || '';
        const propEmail = restaurant?.email || '';
        const propGst = restaurant?.gstNumber ? `GSTIN: ${restaurant.gstNumber}` : '';
        const addrObj = restaurant?.address || {};
        const propAddress = [
          addrObj.street,
          addrObj.city,
          addrObj.state ? `${addrObj.state} ${addrObj.zipCode || ''}` : '',
        ].filter(Boolean).join(', ') || restaurant?.location || '';

        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(22).text(propName, 40, 40);
        doc.fillColor(textMuted).font('Helvetica').fontSize(9)
          .text(propAddress, 40, 68)
          .text(`Phone: ${propPhone}${propEmail ? ' | Email: ' + propEmail : ''}`, 40, 80);

        if (propGst) {
          doc.text(propGst, 40, 92);
        }

        // Badge
        doc.roundedRect(400, 40, 155, 26, 4).fillAndStroke(bgLight, accentColor);
        doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11).text('HOTEL TAX INVOICE', 410, 48, { align: 'center', width: 135 });

        // Metadata grid
        let metaY = 115;
        doc.roundedRect(40, metaY, 515, 65, 4).fillAndStroke(bgLight, borderLight);

        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark)
          .text('Invoice No:', 52, metaY + 12)
          .text('Invoice Date:', 52, metaY + 28)
          .text('Booking Ref:', 52, metaY + 44);

        doc.font('Helvetica').fontSize(9).fillColor(textMuted)
          .text(invoice.invoiceNumber, 125, metaY + 12)
          .text(new Date(invoice.issuedAt).toLocaleDateString(), 125, metaY + 28)
          .text(booking?.bookingReference || invoice.bookingId?.toString() || 'N/A', 125, metaY + 44);

        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark)
          .text('Guest Name:', 310, metaY + 12)
          .text('Contact No:', 310, metaY + 28)
          .text('Payment Mode:', 310, metaY + 44);

        doc.font('Helvetica').fontSize(9).fillColor(textMuted)
          .text(invoice.guestName, 395, metaY + 12)
          .text(invoice.guestPhone, 395, metaY + 28)
          .text(`${invoice.paymentMethod} (${invoice.paymentStatus})`, 395, metaY + 44);

        // Stay details summary box
        let stayY = 190;
        doc.roundedRect(40, stayY, 515, 45, 4).fillAndStroke('#EFF6FF', '#BFDBFE');
        doc.font('Helvetica-Bold').fontSize(9).fillColor(accentColor)
          .text(`Room: ${invoice.roomNumber} (${invoice.roomTypeName})`, 52, stayY + 10)
          .text(`Check-In: ${new Date(invoice.checkInDate).toLocaleDateString()}`, 52, stayY + 26)
          .text(`Check-Out: ${new Date(invoice.checkOutDate).toLocaleDateString()}`, 230, stayY + 26)
          .text(`Billable Nights: ${invoice.billableNights}`, 410, stayY + 26);

        // Table Header
        let tableY = 250;
        doc.rect(40, tableY, 515, 22).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
          .text('DESCRIPTION', 50, tableY + 6)
          .text('RATE / NIGHT', 290, tableY + 6, { width: 80, align: 'right' })
          .text('QTY / NIGHTS', 380, tableY + 6, { width: 80, align: 'right' })
          .text('AMOUNT (₹)', 470, tableY + 6, { width: 75, align: 'right' });

        let currentY = tableY + 24;

        // Line 1: Room Charges
        doc.rect(40, currentY, 515, 20).fill('#FFFFFF');
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9)
          .text(`Room Tariff - ${invoice.roomTypeName} (${invoice.roomNumber})`, 50, currentY + 5);
        doc.font('Helvetica').fontSize(9)
          .text(`₹${invoice.roomTariffPerNight.toFixed(2)}`, 290, currentY + 5, { width: 80, align: 'right' })
          .text(`${invoice.billableNights}`, 380, currentY + 5, { width: 80, align: 'right' })
          .text(`₹${invoice.roomChargesTotal.toFixed(2)}`, 470, currentY + 5, { width: 75, align: 'right' });

        currentY += 22;

        // Additional Charges
        if (invoice.additionalCharges && invoice.additionalCharges.length > 0) {
          invoice.additionalCharges.forEach((ch, idx) => {
            const bg = idx % 2 === 0 ? bgLight : '#FFFFFF';
            doc.rect(40, currentY, 515, 20).fill(bg);
            doc.fillColor(textDark).font('Helvetica').fontSize(9)
              .text(`Additional: ${ch.title}`, 50, currentY + 5)
              .text('-', 290, currentY + 5, { width: 80, align: 'right' })
              .text('1', 380, currentY + 5, { width: 80, align: 'right' })
              .text(`₹${Number(ch.amount).toFixed(2)}`, 470, currentY + 5, { width: 75, align: 'right' });
            currentY += 22;
          });
        }

        // Summary separator
        doc.moveTo(40, currentY + 5).lineTo(555, currentY + 5).strokeColor(borderLight).stroke();
        currentY += 15;

        // Financials Box on Bottom Right
        const sumLeft = 320;
        const valLeft = 450;
        const valWidth = 95;

        doc.font('Helvetica').fontSize(9).fillColor(textDark)
          .text('Subtotal:', sumLeft, currentY)
          .text(`₹${invoice.subtotal.toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
        currentY += 16;

        if (invoice.taxAmount > 0) {
          doc.text(`Taxes (GST ${invoice.taxPercentage}%):`, sumLeft, currentY)
            .text(`₹${invoice.taxAmount.toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
          currentY += 16;
        }

        if (invoice.discount > 0) {
          doc.fillColor('#DC2626')
            .text('Discount Applied:', sumLeft, currentY)
            .text(`- ₹${invoice.discount.toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
          currentY += 16;
        }

        doc.moveTo(sumLeft, currentY + 2).lineTo(555, currentY + 2).strokeColor(borderLight).stroke();
        currentY += 8;

        // Total
        doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor)
          .text('Total Amount:', sumLeft, currentY)
          .text(`₹${invoice.totalAmount.toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
        currentY += 20;

        // Advance & Settlement
        doc.font('Helvetica').fontSize(9).fillColor(textMuted)
          .text('Advance Payment:', sumLeft, currentY)
          .text(`₹${(invoice.advancePayment || 0).toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
        currentY += 16;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#059669')
          .text('Total Paid:', sumLeft, currentY)
          .text(`₹${invoice.totalPaid.toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });
        currentY += 16;

        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
          .text('Balance Due:', sumLeft, currentY)
          .text(`₹${(invoice.balanceAmount || 0).toFixed(2)}`, valLeft, currentY, { width: valWidth, align: 'right' });

        // Footer
        doc.font('Helvetica').fontSize(8).fillColor(textMuted)
          .text('Thank you for choosing us! We hope you enjoyed your stay.', 40, 750, { align: 'center', width: 515 })
          .text('Computer generated hotel tax invoice • Powered by DawatDesk', 40, 762, { align: 'center', width: 515 });

        doc.end();

        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve({ buffer: pdfBuffer, filePath, fileName });
        });
      } catch (err) {
        logger.error(`Error generating hotel invoice PDF: ${err.message}`);
        reject(err);
      }
    });
  }
}

module.exports = new HotelPdfService();
