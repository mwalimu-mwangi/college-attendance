import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Add type definition for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Type for data to be exported
export interface ExportableData {
  headers: string[];
  data: any[][];
  title: string;
  fileName: string;
  schoolName?: string;
  logoUrl?: string;
}

/**
 * Format a date for display
 */
export const formatDate = (date: Date): string => {
  return format(new Date(date), 'yyyy-MM-dd');
};

/**
 * Export data to Excel
 */
export const exportToExcel = async (
  exportData: ExportableData
): Promise<void> => {
  const { headers, data, title, fileName, schoolName, logoUrl } = exportData;
  
  // Create a new workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);
  
  // Add title with school name if available
  const titleRow = worksheet.addRow([schoolName ? `${schoolName} - ${title}` : title]);
  titleRow.font = { bold: true, size: 16 };
  worksheet.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
  titleRow.alignment = { horizontal: 'center' };
  
  // Add logo if available
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoArrayBuffer = await logoResponse.arrayBuffer();
      
      const logoId = workbook.addImage({
        buffer: logoArrayBuffer,
        extension: 'png',
      });
      
      worksheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 100, height: 50 }
      });
    } catch (error) {
      console.error('Error adding logo to Excel:', error);
    }
  }
  
  // Add empty row after title
  worksheet.addRow([]);
  
  // Add date
  const dateRow = worksheet.addRow([`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`]);
  dateRow.font = { italic: true };
  
  // Add empty row before headers
  worksheet.addRow([]);
  
  // Add headers
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  
  // Add data rows
  data.forEach((rowData) => {
    const row = worksheet.addRow(rowData);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  // Auto fit columns
  worksheet.columns.forEach((column) => {
    const lengths = column.values?.filter(v => v).map(v => v.toString().length);
    if (lengths && lengths.length > 0) {
      const maxLength = Math.max(...lengths);
      column.width = maxLength + 5;
    }
  });
  
  // Generate Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  
  // Download file
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export data to PDF
 */
export const exportToPDF = async (
  exportData: ExportableData
): Promise<void> => {
  const { headers, data, title, fileName, schoolName, logoUrl } = exportData;
  
  // Create new PDF document (A4 format)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Calculate positions
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;
  
  // Add logo if available
  if (logoUrl) {
    try {
      const img = new Image();
      img.src = logoUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          // Calculate aspect ratio to maintain proportions
          const imgWidth = 40;
          const imgHeight = (img.height * imgWidth) / img.width;
          
          // Add image to top left
          doc.addImage(img, 'PNG', 10, 10, imgWidth, imgHeight);
          resolve();
        };
        img.onerror = () => {
          console.error('Error loading logo for PDF');
          resolve();
        };
      });
      
      // Adjust title position if logo is present
      yPosition = 35;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }
  
  // Add title with school name if available
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const titleText = schoolName ? `${schoolName} - ${title}` : title;
  doc.text(titleText, pageWidth / 2, yPosition, { align: 'center' });
  
  // Add generation date
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, pageWidth / 2, yPosition, { align: 'center' });
  
  // Add table with data
  yPosition += 10;
  doc.autoTable({
    head: [headers],
    body: data,
    startY: yPosition,
    headStyles: {
      fillColor: [224, 224, 224],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    }
  });
  
  // Add page numbering
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
  }
  
  // Download PDF
  doc.save(`${fileName}.pdf`);
};

/**
 * Print the data in a new window
 */
export const printData = async (
  exportData: ExportableData
): Promise<void> => {
  const { headers, data, title, schoolName, logoUrl } = exportData;
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the data');
    return;
  }
  
  // Create HTML content
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
        }
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 100px;
          max-height: 80px;
          margin-right: 20px;
        }
        .title {
          text-align: center;
          flex-grow: 1;
        }
        h1 {
          margin: 0;
          color: #333;
        }
        .date {
          text-align: center;
          margin-bottom: 20px;
          font-style: italic;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 12px;
          color: #666;
        }
        @media print {
          @page {
            margin: 0.5cm;
          }
          body {
            margin: 1cm;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
  `;
  
  // Add logo if available
  if (logoUrl) {
    htmlContent += `<img src="${logoUrl}" class="logo" alt="School Logo">`;
  }
  
  // Add title
  htmlContent += `
    <div class="title">
      <h1>${schoolName ? `${schoolName}` : ''}</h1>
      <h2>${title}</h2>
    </div>
  </div>
  <div class="date">Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</div>
  `;
  
  // Add table
  htmlContent += `
    <table>
      <thead>
        <tr>
  `;
  
  // Add table headers
  headers.forEach(header => {
    htmlContent += `<th>${header}</th>`;
  });
  
  htmlContent += `
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add table data
  data.forEach(row => {
    htmlContent += '<tr>';
    row.forEach(cell => {
      htmlContent += `<td>${cell}</td>`;
    });
    htmlContent += '</tr>';
  });
  
  // Close table and add footer
  htmlContent += `
      </tbody>
    </table>
    <div class="footer">
      This is an automatically generated report.
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      };
    </script>
    </body>
    </html>
  `;
  
  // Write HTML content to the new window
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};