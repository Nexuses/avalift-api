const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const { S3Client } = require("@aws-sdk/client-s3");
const  { Upload } = require("@aws-sdk/lib-storage");
require("dotenv").config();
const axios = require("axios");
const { toWords } = require('number-to-words');


// ✅ Load AWS Credentials from .env
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log("✅ S3 Bucket:", process.env.S3_BUCKET);

function drawAlignedDetail(page, label, value, startX, y, font, boldFont) {
  const colonX = startX + 100;
  const valueX = colonX + 10;

  page.drawText(label.replace(':', ''), {
    x: startX,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(':', {
    x: colonX,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(value, {
    x: valueX,
    y,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });
}


function drawAlignedDetail(page, label, value, startX, y, font, boldFont) {
  const colonX = startX + 100;
  const valueX = colonX + 10;

  page.drawText(label.replace(':', ''), {
    x: startX,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(':', {
    x: colonX,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(value, {
    x: valueX,
    y,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });
}


const generateInvoicePDF = async (invoiceData) => {
  try {
    const {
      invoice_number,
      organization_id,
      organization_name,
      organization_number,
      organization_address,
      rideAmountMap,
      totalAmount,
      is_paid,
      payment_date,
      start_date,
      end_date,
      account_number,
      iban,
      bank_name,
      branch_name,
      total_vat,
      subtotal,
      address,
      contact_email,
      contact_number
    } = invoiceData;

    console.log("✅ Invoice Data:", invoiceData);

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let yPosition = height - 50;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawAlignedDetailWrapped = (
      page, label, value, startX, y,
      font, boldFont, maxWidth = 220, lineHeight = 13
    ) => {
      const colonX = startX + 100;
      const valueX = colonX + 10;
      const fontSize = 10;
    
      if (!value || value.length === 0) {
        return lineHeight; // empty value fallback
      }
    
      const words = value.split(" ");
      const lines = [];
      let currentLine = "";
    
      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
    
        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
    
      // Draw label + colon on first line
      page.drawText(label.replace(":", ""), {
        x: startX, y, size: fontSize, font: boldFont,
      });
      page.drawText(":", {
        x: colonX, y, size: fontSize, font: boldFont,
      });
    
      // Draw lines
      lines.forEach((line, idx) => {
        page.drawText(line, {
          x: valueX,
          y: y - idx * lineHeight,
          size: fontSize,
          font,
        });
      });
    
      return lines.length * lineHeight;
    };


    const logoImageBytes = fs.readFileSync(path.join(__dirname, "../assets/avalift_logo.png")); // need to be changed
    const logoImage = await pdfDoc.embedPng(logoImageBytes);

    // const taxLogoBytes = fs.readFileSync(path.join(__dirname, "../assets/tax_image.png"));
    // const taxLogo = await pdfDoc.embedPng(taxLogoBytes);

    const logoDims = logoImage.scale(0.15);
    const textStartX = 50 + logoDims.width + 15;
    let textY = yPosition;

    page.drawImage(logoImage, {
      x: 50,
      y: yPosition - logoDims.height + 50,
      width: logoDims.width,
      height: logoDims.height,
    });

    page.drawText("Avalift", {
      x: textStartX,
      y: textY,
      size: 20,
      font: boldFont,
      color: rgb(0.0157, 0.1294, 0.2863),
    });
    textY -= 20;

    const contactLines = [
      address,
      `Contact : ${contact_number}`,
      `E-mail : ${contact_email}`,
    ];

    for (const line of contactLines) {
      page.drawText(line, {
        x: textStartX,
        y: textY,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      textY -= 15;
    }

    // const taxLogoDims = taxLogo.scale(0.4);
    // page.drawImage(taxLogo, {
    //   x: width - 50 - taxLogoDims.width,
    //   y: yPosition - taxLogoDims.height + 30,
    //   width: taxLogoDims.width,
    //   height: taxLogoDims.height,
    // });

    yPosition = textY - 10;
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    yPosition -= 15;

    const leftDetails = [
      ["Invoice Number:", invoice_number],
      ["Organization:", `${organization_name} (ID: ${organization_id})`],
      ["Contact Number:", organization_number],
      ["Billing Address:", organization_address],
      ["Billing Period:", `${new Date(start_date).toLocaleDateString()} - ${new Date(end_date).toLocaleDateString()}`],
      ["Amount to be Paid:", `AED ${totalAmount ? parseFloat(totalAmount).toFixed(2) : "0.00"}`],
      ["Payment Status:", is_paid ? "Paid" : "Unpaid"],
    ];
    if (is_paid) {
      leftDetails.push(["Payment Date:", new Date(payment_date).toLocaleDateString()]);
    }

    const rightDetails = [
      ["Account Number:",  account_number],
      ["IBAN:",  iban],
      ["Bank Name:",  bank_name],
      ["Branch Name:",  branch_name],
      ["Date:", new Date().toLocaleDateString()],
      ["Currency:", "AED"],
    ];

    let detailsY = yPosition;
    let leftY = detailsY;

    leftDetails.forEach(([label, value]) => {
      const shouldWrap = label.toLowerCase().replace(/[^a-z]/gi, "").includes("billingaddress");

      let heightUsed;
      if (shouldWrap) {
        console.log("should wrap");
        heightUsed = drawAlignedDetailWrapped(page, label, value, 50, leftY, font, boldFont, 100);
        console.log("height used", heightUsed);
      } else {
        drawAlignedDetail(page, label, value, 50, leftY, font, boldFont);
        heightUsed = 15;
      }
    
      leftY -= heightUsed;
    });


    let rightY = detailsY;

    rightDetails.forEach(([label, value]) => {
      drawAlignedDetail(page, label, value, 330, rightY, font, boldFont);
      rightY -= 15; // Usually no wrapping needed on the right
    });

    yPosition -= Math.max(detailsY - leftY, detailsY - rightY) + 10;

    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
    yPosition -= 20;
    const orderText = "Order Details";
    const orderTextWidth = boldFont.widthOfTextAtSize(orderText, 12);
    page.drawText(orderText, { x: (width - orderTextWidth) / 2, y: yPosition, size: 12, font: boldFont, color: rgb(0, 0, 0) });
    yPosition -= 15;
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
    yPosition -= 15;

    const headers = ["S.No", "Ride ID", "Pickup", "Drop", "Date", "Vehicle ID", "Amount(AED)"];
    const colWidths = [30, 50, 110, 110, 60, 65, 70];

    let xPosition = 50;
    headers.forEach((header, i) => {
    const colWidth = colWidths[i];
    const fontSize = 10;
    let textX = xPosition;

    if (String(header).toLowerCase().includes("amount")) {
      const textWidth = boldFont.widthOfTextAtSize(String(header), fontSize);

      if (isNaN(textWidth)) {
        throw new Error(`Failed to measure text width for header: ${header}`);
      }

      textX = xPosition + colWidth - textWidth;
    }

    // Final safety check
    if (isNaN(textX)) {
      throw new Error(`textX is NaN for header: ${header}`);
    }

    page.drawText(String(header), {
      x: textX,
      y: yPosition,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    xPosition += colWidth;
    });


    yPosition -= 12;
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: 545, y: yPosition }, thickness: 0.5, color: rgb(0, 0, 0) });
    yPosition -= 12;

    let index = 1;
    for (const rideId of Object.keys(rideAmountMap)) {
      if (yPosition < 150) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = 800;
      }

      const ride = rideAmountMap[rideId];
      const amount = ride.amount ? `${ride.amount.toFixed(2)}` : "0.00";
      const pickup = truncateText(ride.pickup || "N/A", 25);
      const drop = truncateText(ride.drop || "N/A", 25);
      const rideDate = ride.date ? new Date(ride.date).toLocaleDateString() : "N/A";
      const vehicleId = ride.vehicle_id || "N/A";

      xPosition = 50;
      const row = [index, rideId, pickup, drop, rideDate, vehicleId, amount];
      row.forEach((cell, i) => {
        page.drawText(String(cell), { x: xPosition, y: yPosition, size: 9, font, color: rgb(0, 0, 0) });
        xPosition += colWidths[i];
      });

      yPosition -= 15;
      index++;
    }

    if (yPosition < 200) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 800;
    }

// === FINAL: Summary Box with Refined Layout ===

const boxX = 50;
const boxY = 80;
const boxWidth = width - 100;
const boxHeight = 60;
const leftBoxWidth = boxWidth * 0.6;
const rightBoxX = boxX + leftBoxWidth + 10;
const boxRightX = boxX + boxWidth;
const rowHeight = 15;

// Values
const total = subtotal;
const vat = total_vat;
const net = totalAmount;

// Amount in Words
const whole = Math.floor(net);
const fils = Math.round((net % 1) * 100);
const amountWords = `${toWords(whole)} UAE Dirham And ${toWords(fils)} Fils Only`;
const formattedWords = amountWords.replace(/\b\w/g, (c) => c.toUpperCase());

// === Outer Box ===
page.drawRectangle({
  x: boxX,
  y: boxY,
  width: boxWidth,
  height: boxHeight,
  borderColor: rgb(0, 0, 0),
  borderWidth: 0.5,
});

// === Vertical Divider ===
page.drawLine({
  start: { x: boxX + leftBoxWidth, y: boxY },
  end: { x: boxX + leftBoxWidth, y: boxY + boxHeight },
  thickness: 0.5,
  color: rgb(0, 0, 0),
});

// === LEFT SIDE ===
const leftLabelY = boxY + boxHeight - 15;
page.drawText("Amount In Words:", {
  x: boxX + 10,
  y: leftLabelY,
  size: 10,
  font: boldFont,
});

// Line under label
page.drawLine({
  start: { x: boxX, y: leftLabelY - 5 },
  end: { x: boxX + leftBoxWidth, y: leftLabelY - 5 },
  thickness: 0.5,
  color: rgb(0, 0, 0),
});

// Amount In Words - raised a bit to align closer to bottom of box
page.drawText(formattedWords, {
  x: boxX + 10,
  y: boxY + 10, // aligned just above the bottom
  size: 10,
  font,
});

// === RIGHT SIDE (Refined Columns with Aligned Net Total) ===
const rightLabels = [
  ["Total Amount", total.toFixed(2)],
  ["Total VAT Amount", vat.toFixed(2)],
  ["Net Total", net.toFixed(2)],
];

const labelX = rightBoxX;
const aedX = boxRightX - 80;
const amountX = boxRightX - 45;

const netTotalRowY = boxY + 10; // aligned to match left box's amount words

// We'll offset only the first two rows above it
rightLabels.forEach(([label, value], i) => {
  const isNet = label === "Net Total";

  // Dynamically assign Y: align Net Total at bottom, others above
  const y = isNet
    ? netTotalRowY
    : netTotalRowY + (2 - i) * rowHeight; // move Total/VAT upward

  page.drawText(label, {
    x: isNet ? labelX : labelX + 5,
    y: isNet ? y : y + 5,
    size: 10,
    font: isNet ? boldFont : font,
  });

  // page.drawText("AED", {
  //   x: aedX,
  //   y: isNet ? y : y + 5,
  //   size: 10,
  //   font,
  // });

  page.drawText(value, {
    x: amountX,
    y: isNet ? y : y + 5,
    size: 10,
    font: isNet ? boldFont : font,
  });

  // Divider lines under first two rows only
  if (!isNet) {
    page.drawLine({
      start: { x: boxX + leftBoxWidth, y: y  },
      end: { x: boxRightX, y: y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
  }
});



// === Fixed Footer at Bottom of Page ===
const footerY = 40; // bottom padding
const footerX = 50;

// Horizontal line above footer
page.drawLine({
  start: { x: footerX, y: footerY + 20 },
  end: { x: width - footerX, y: footerY + 20 },
  thickness: 0.5,
  color: rgb(0.7, 0.7, 0.7),
});

// Footer messages
page.drawText("Thank you for choosing Avalift.", {
  x: footerX,
  y: footerY + 5,
  size: 8,
  font,
  color: rgb(0.3, 0.3, 0.3),
});

page.drawText("For any queries, contact us at support@avalift.com", {
  x: footerX,
  y: footerY - 10,
  size: 8,
  font,
  color: rgb(0.3, 0.3, 0.3),
});


// === END Summary Box ===




    const pdfBytes = await pdfDoc.save();
    const s3Url = await uploadPdfToS3(pdfBytes, `invoice_${invoice_number}.pdf`);
    return s3Url;
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw error;
  }
};

const truncateText = (text, maxLength) => {
  return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
};

// ✅ Helper Function to Save PDF
const savePDF = async (pdfDoc, invoice_number) => {
  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(
    __dirname,
    "../invoices",
    `invoice_${invoice_number}.pdf`
  );
  fs.writeFileSync(filePath, pdfBytes);
  console.log("✅ Invoice PDF Generated:", filePath);
  return filePath;
};

const addWatermarkToInvoice = async (s3Url) => {
  try {
    console.log("🔹 Downloading file from S3:", s3Url);

    // ✅ 1. Download File from S3
    const response = await axios.get(s3Url, { responseType: "arraybuffer" });
    const pdfBytes = response.data;

    // ✅ 2. Load Existing PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // ✅ 3. Add Watermark to Each Page
    const watermarkText = "PAID";
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 4,
        y: height / 2,
        size: 50,
        color: rgb(1, 0, 0), // Red Color
        rotate: degrees(45), // 45-degree angle
        opacity: 0.3, // Semi-transparent
      });
    });

    // ✅ 4. Save the Modified PDF
    const updatedPdfBytes = await pdfDoc.save();

    // ✅ 5. Upload Back to S3 (Replace Existing File)
    const fileName = path.basename(s3Url);
    const uploadParams = {
      Bucket: process.env.S3_BUCKET, // S3 Bucket Name
      Key: `invoices/${fileName}`, // Path in S3
      Body: updatedPdfBytes,
      ContentType: "application/pdf",
    };

    const upload = new Upload({
      client: s3,
      params: uploadParams,
    });

    const uploadResult = await upload.done();
    console.log("✅ Watermarked PDF Uploaded to S3:", uploadResult.Location);

    return uploadResult.Location; // ✅ Return the Updated S3 URL
  } catch (error) {
    console.error("Error adding watermark:", error);
    throw new Error("Failed to add watermark to the invoice");
  }
};

async function uploadPdfToS3(pdfBuffer, fileName) {
  try {
    const bucketName = process.env.S3_BUCKET;

    if (!bucketName) {
      throw new Error("S3_BUCKET environment variable is missing or empty.");
    }

    console.log("✅ Uploading to S3 Bucket:", bucketName);

    const params = {
      Bucket: bucketName, // ✅ Ensure this is NOT empty
      Key: `invoices/${fileName}`,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    };

    const upload = new Upload({
      client: s3,
      params: params,
    });

    const uploadResult = await upload.done();
    console.log("✅ PDF uploaded successfully:", uploadResult.Location);
    return uploadResult.Location; // ✅ Returns the S3 URL
  } catch (error) {
    console.error("PDF upload failed:", error);
    throw error;
  }
}

module.exports = {
  generateInvoicePDF,
  addWatermarkToInvoice,
};
