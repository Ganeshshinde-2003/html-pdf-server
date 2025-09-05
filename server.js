const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 3000;

app.use(
  cors({
    origin: ["https://html-to-pdf-nine.vercel.app", "http://127.0.0.1:5500"], // add your frontend domain
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json({ limit: "50mb" }));

app.post("/generate-pdf", async (req, res) => {
  try {
    let { htmlDiv } = req.body;
    if (!htmlDiv) {
      return res.status(400).send("Missing htmlDiv in request body");
    }

    const baseUrl = `http://localhost:${port}/`;
    const cssUrl = `${baseUrl}style.css`;

    // Fix relative asset paths
    htmlDiv = htmlDiv.replace(/src="([^"]+)"/g, (m, p1) => {
      if (p1.startsWith("http") || p1.startsWith("//")) return m;
      return `src="${baseUrl}${p1.replace(/^\/+/, "")}"`;
    });

    htmlDiv = htmlDiv.replace(/href="([^"]+)"/g, (m, p1) => {
      if (p1.startsWith("http") || p1.startsWith("//")) return m;
      return `href="${baseUrl}${p1.replace(/^\/+/, "")}"`;
    });

    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <link rel="stylesheet" href="${cssUrl}" />
          <style>
            body, html { margin: 0; padding: 0; }
            * { page-break-inside: avoid; }
            h1, h2, h3, h4, h5, h6, p, div {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>${htmlDiv}</body>
      </html>`;

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 0,
    });

    // Generate proper multi-page A4 PDF
    const pdfBuffer = await page.pdf({
      width: "210mm", // A4 width
      height: "594mm", // double A4 height (297 * 2)
      printBackground: true,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="output.pdf"',
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
