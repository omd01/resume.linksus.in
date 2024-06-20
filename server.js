const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 5000;
const ejs = require("ejs");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const cors = require('cors');

app.use(cors());
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
const templatePath = path.join(__dirname, "views/resume.ejs");
app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.post("/api/form", async (req, res) => {
  try {
    await createPDF(req.body, res);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

async function createPDF(userData, res) {
  fs.readFile(templatePath, "utf-8", async (err, template) => {
    if (err) {
      console.error("Error reading the template file:", err);
      return;
    }

    // Render the EJS template with data
    const htmlContent = ejs.render(template, userData);

    let browser;
    try {
      browser = await puppeteer.launch({
      // executablePath: '/usr/bin/chromium-browser',
        headless: true,
        timeout: 60000, // 60 seconds
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      await page.setDefaultNavigationTimeout(60000); // 60 seconds

      // Set the content of the page
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
        timeout: 60000,
      });
      const outputDir = path.join(__dirname, "pdf");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir); // Create the directory if it doesn't exist
      }
      const pdfPath = path.join(outputDir, `${userData.personal.name}.pdf`);
      await page.pdf({ path: pdfPath, format: "A4" });

      await browser.close();

      await sendPDF(userData, res);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  });
}

async function sendPDF(userData, res) {
  const filePath = path.join(__dirname, "/pdf", userData.personal.name + ".pdf");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + userData.personal.name + ".pdf"
    );
    res.send(data);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting PDF:", err);
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
