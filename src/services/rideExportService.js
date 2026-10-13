const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const PDFDocument = require('pdfkit');
const axios = require('axios');
const s3Uploader = require('../utils/s3Uploader');

const exportRidesToExcel = async (rides, res) => {
    try {
      // ✅ Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Rides");
  
      // ✅ Define Columns
      worksheet.columns = [
        { header: "Ride ID", key: "ride_id", width: 15 },
        { header: "Chauffeur", key: "chauffeur_name", width: 20 },
        { header: "Customer", key: "customer_name", width: 20 },
        { header: "Pickup Point", key: "requested_pickup_point", width: 25 },
        { header: "Drop Point", key: "requested_drop_point", width: 25 },
        { header: "Status", key: "status", width: 15 },
        { header: "Payment Method", key: "payment_method", width: 20 },
        { header: "Tip Amount", key: "tip_amount", width: 15 },
        { header: "Final Amount", key: "final_total_amount", width: 15 },
        { header: "Previous Balance", key: "previous_balance", width: 15 },
        { header: "Coupon Codes", key: "coupon_codes", width: 15 },
        { header: "Discount Amount", key: "discount_amount", width: 15 },
        { header: "Order Date", key: "order_date", width: 20 },
        { header: "End Time", key: "end_time", width: 20 },
      ];

      rides.sort((a, b) => a.ride_id - b.ride_id);

      // ✅ Add ride data to worksheet
      rides.forEach((ride) => {
        const coupons = ride.final_price_calculation?.appliedCoupons || [];
        const couponCodes = coupons.map(c => c.coupon_code).join(", ");

        worksheet.addRow({
          ride_id: ride.ride_id,
          chauffeur_name: ride.chauffeur_name,
          customer_name: ride.customer_name,
          requested_pickup_point: ride.requested_pickup_point,
          requested_drop_point: ride.requested_drop_point,
          status: ride.status,
          payment_method: ride.paymentDetails?.payment_method || "N/A",
          tip_amount: ride.final_price_calculation?.tip_amount || 0,
          final_total_amount: ride.final_price_calculation?.final_total_amount || 0,
          previous_balance: ride.final_price_calculation?.previous_balance || 0,
          coupon_codes: couponCodes || "N/A",
          discount_amount: ride.final_price_calculation?.coupon_discount || 0,
          order_date: ride.order_date
          ? new Date(ride.order_date).toLocaleString("en-IN", { timeZone: "Asia/Dubai" })
          : "",
          end_time: ride.end_time
          ? new Date(ride.end_time).toLocaleString("en-IN", { timeZone: "Asia/Dubai" })
          : ""
        });
      });
  
      // ✅ Stream File to Client
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=rides_export.xlsx"
      );
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("🚨 Error exporting rides to Excel:", error);
      res.status(500).json({ message: "Failed to export rides to Excel", error: error.message });
    }
  };

  const exportChauffeurWalletLogsToExcel = async (data, res) => {
    try {
      // ✅ Check if data is empty
      if (!data || data.length === 0) {
        const error = new Error("No chauffeur wallet logs found.");
        error.statusCode = 404;
        throw error;
      }
  
      // ✅ Create workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Chauffeur Wallet Logs");
  
      // ✅ Define columns dynamically from object keys
      worksheet.columns = Object.keys(data[0]).map((key) => ({
        header: key.toUpperCase(), // Convert headers to uppercase
        key: key,
        width: 20 // Set default column width
      }));
  
      // ✅ Add rows to the worksheet
      data.forEach((item) => {
        worksheet.addRow(item);
      });
  
      // ✅ Set response headers **before** writing data
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=chauffeur_wallet_logs.xlsx");
  
      // ✅ Stream workbook to response (fixes ERR_HTTP_HEADERS_SENT)
      await workbook.xlsx.write(res);
  
      // ✅ Ensure response is properly ended
      // res.end();
  
    } catch (error) {
      console.error("❌ Error exporting data:", error);
      throw error;
    }
  };

  const exportPDWalletLogsToExcel = async (data, res) => {
    try {
      // ✅ Check if data is empty
      if (!data || data.length === 0) {
        const error = new Error("No pd wallet logs found.");
        error.statusCode = 404;
        throw error;
      }
  
      // ✅ Create workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("PD Wallet Logs");
  
      // ✅ Define columns dynamically from object keys
      worksheet.columns = Object.keys(data[0]).map((key) => ({
        header: key.toUpperCase(), // Convert headers to uppercase
        key: key,
        width: 20 // Set default column width
      }));
  
      // ✅ Add rows to the worksheet
      data.forEach((item) => {
        worksheet.addRow(item);
      });
  
      // ✅ Set response headers **before** writing data
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=pd_wallet_logs.xlsx");
  
      // ✅ Stream workbook to response (fixes ERR_HTTP_HEADERS_SENT)
      await workbook.xlsx.write(res);
  
      // ✅ Ensure response is properly ended
      // res.end();
  
    } catch (error) {
      console.error("❌ Error exporting data:", error);
      throw error;
    }
  };

  const exportAdminWalletLogsToExcel = async (data, res) => {
    try {
      // ✅ Check if data is empty
      if (!data || data.length === 0) {
        const error = new Error("No admin wallet logs found.");
        error.statusCode = 404;
        throw error;
      }
  
      // ✅ Create workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Admin Wallet Logs");
  
      // ✅ Define columns dynamically from object keys
      worksheet.columns = Object.keys(data[0]).map((key) => ({
        header: key.toUpperCase(), // Convert headers to uppercase
        key: key,
        width: 20 // Set default column width
      }));
  
      // ✅ Add rows to the worksheet
      data.forEach((item) => {
        worksheet.addRow(item);
      });
  
      // ✅ Set response headers **before** writing data
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=admin_wallet_logs.xlsx");
  
      // ✅ Stream workbook to response (fixes ERR_HTTP_HEADERS_SENT)
      await workbook.xlsx.write(res);
  
      // ✅ Ensure response is properly ended
      // res.end();
  
    } catch (error) {
      console.error("❌ Error exporting data:", error);
      throw error;
    }
  }

  async function getImageBuffer(url) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { Accept: 'image/*' },
      });
      return Buffer.from(response.data, 'binary');
    } catch (err) {
      console.error(`Failed to fetch image from ${url}:`, err.message);
      return null;
    }
  }
  
  async function exportVehicleAuditToPdf(dataArray) {
    try {
      const uploadedUrls = [];

    for (const item of dataArray) {
      const pdfBuffer = await new Promise(async (resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4', info: { Title: 'Vehicle Audit Report' } });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject); // catch stream errors

        const contentWidth = doc.page.width - 2 * doc.page.margins.left;
        

        // Function to add page border
        const addPageBorder = () => {
            const borderMargin = 20;
            doc.rect(borderMargin, 
                    borderMargin, 
                    doc.page.width - (2 * borderMargin), 
                    doc.page.height - (2 * borderMargin))
               .strokeColor('#BDC3C7')
               .lineWidth(1)
               .stroke();
        };

        // Header
        doc.fillColor('#2C3E50')
           .fontSize(28)
           .font('Helvetica-Bold')
           .text('Vehicle Audit Report', 
                doc.page.margins.left, 
                60, 
                { align: 'center', width: contentWidth })
           .moveDown(1.5);

        for (let i = 0; i < dataArray.length; i++) {
            const item = dataArray[i];
            
            // Section Title
            doc.fillColor('#2980B9')
               .fontSize(20)
               .font('Helvetica-Bold')
               .text(`Audit Details`, 
                    doc.page.margins.left, 
                    doc.y, 
                    { align: 'left', width: contentWidth })
               .moveDown(0.5);

            // Content Box
            const boxStartY = doc.y;
            const boxMargin = 15;
            
            doc.roundedRect(doc.page.margins.left - boxMargin, 
                boxStartY - boxMargin, 
                contentWidth + 2 * boxMargin, 
                0, 
                10)
               .fillAndStroke('#F8F9FA', '#E0E0E0')
               .lineWidth(1);

            // Key-Value Pairs
            const contentStartX = doc.page.margins.left;
            let currentY = boxStartY + 10;
            
            doc.font('Helvetica')
               .fontSize(12)
               .fillColor('#333333');
            Object.entries(item).forEach(([key, value]) => {
                if (!key.includes('ImageUrl')) {
                    doc.text(`${key.replace(/_/g, ' ')}: `, 
                        contentStartX, 
                        currentY, 
                        { continued: true })
                       .font('Helvetica')
                       .text(`${value}`, { continued: false });
                    currentY += 18;
                }
            });

            // Images Section
            currentY += 15;
            const imageSectionY = currentY;
            const vehicleImageWidth = 300;  // Increased size
            const signatureImageWidth = 100;  // Decreased size
            const imageSpacing = 25;
            const vehicleImageX = contentStartX;
            // Position signature at right side
            const signatureImageX = doc.page.width - doc.page.margins.right - signatureImageWidth;

            // Image Headers
            doc.fontSize(11)
               .fillColor('#333333')
               .font('Helvetica-Bold')
               .text('Vehicle Marking', vehicleImageX, imageSectionY)
               .text('Signature', signatureImageX, imageSectionY);

            // Images
            const imageTop = imageSectionY + 20;
            const vehicleImageBuffer = await getImageBuffer(item.vehicleMarkingImageUrl);
            if (vehicleImageBuffer) {
                doc.image(vehicleImageBuffer, 
                    vehicleImageX, 
                    imageTop, 
                    {
                        width: vehicleImageWidth,
                        height: 225,  // Increased proportionally (maintaining 4:3 aspect ratio)
                        align: 'left'
                    });
            } else {
                doc.fillColor('#E74C3C')
                   .fontSize(10)
                   .font('Helvetica')
                   .text('Image not available', 
                        vehicleImageX, 
                        imageTop + 100, 
                        { align: 'center', width: vehicleImageWidth });
            }

            const signatureImageBuffer = await getImageBuffer(item.signatureImageUrl);
            if (signatureImageBuffer) {
                doc.image(signatureImageBuffer, 
                    signatureImageX, 
                    imageTop, 
                    {
                        width: signatureImageWidth,
                        height: 75,  // Decreased proportionally (maintaining 4:3 aspect ratio)
                        align: 'left'
                    });
            } else {
                doc.fillColor('#E74C3C')
                   .fontSize(10)
                   .font('Helvetica')
                   .text('Image not available', 
                        signatureImageX, 
                        imageTop + 30, 
                        { align: 'center', width: signatureImageWidth });
            }

            // Set box height based on larger vehicle image
            const contentHeight = imageTop + 225 + 20 - boxStartY;

            // Footer Separator
            const separatorY = boxStartY + contentHeight + 20;
            if (separatorY + 40 < doc.page.height - doc.page.margins.bottom) {
                doc.y = separatorY;
                doc.moveTo(doc.page.margins.left, doc.y)
                   .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                   .dash(5, { space: 5 })
                   .strokeColor('#BDC3C7')
                   .lineWidth(1)
                   .stroke()
                   .undash();
            }

            if (i < dataArray.length - 1) {
                doc.addPage();
            }
        }
        
        // Add borders and page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            addPageBorder();
            doc.fillColor('#666666')
               .fontSize(10)
               .font('Helvetica')
               .text(`Page ${i + 1} of ${pageCount}`, 
                    doc.page.margins.left, 
                    doc.page.height - 30, 
                    { align: 'center', width: contentWidth });
        }

        doc.end();
      });
      const fileName = `vehicle_audit/vehicle_audit_${item.ride_id}.pdf`;
      const mimeType = 'application/pdf';
      const url = await s3Uploader.uploadToS3(pdfBuffer, fileName, mimeType);
      uploadedUrls.push({ ride_id: item.ride_id, url });
    }
    return uploadedUrls;
    } catch(error) {
        console.log('Error in exportVehicleAuditToPdf:', error.message);
        throw error;
    }
}
  
module.exports = {
  exportRidesToExcel,
  exportChauffeurWalletLogsToExcel,
  exportPDWalletLogsToExcel,
  exportAdminWalletLogsToExcel,
  exportVehicleAuditToPdf
};
