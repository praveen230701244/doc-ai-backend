const express = require("express");
const multer = require("multer");
const cors = require("cors");
require("dotenv").config();

const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const app = express();
app.use(cors());

const upload = multer();

const client = new DocumentAnalysisClient(
  process.env.AZURE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_KEY)
);

// 🔥 Extract only important insights
function extractKeyPoints(text) {
  const points = [];

  const invoice = text.match(/INV-\d+/)?.[0];
  const date = text.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  const total = text.match(/TOTAL DUE\s*\$?([\d.]+)/i)?.[1];
  const customerMatch = text.match(/CUSTOMER NAME:\s*(.*)/i);

  if (invoice) points.push(`Invoice Number: ${invoice}`);
  if (date) points.push(`Invoice Date: ${date}`);
  if (customerMatch) points.push(`Customer: ${customerMatch[1]}`);
  if (total) points.push(`Total Amount: $${total}`);

  // fallback important lines (clean)
  const lines = text
    .split("\n")
    .filter((l) => l.trim().length > 15)
    .slice(0, 2);

  points.push(...lines);

  return points;
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;

    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      fileBuffer
    );

    const result = await poller.pollUntilDone();

    let text = "";

    result.pages.forEach((page) => {
      page.lines.forEach((line) => {
        text += line.content + "\n";
      });
    });

    const keyPoints = extractKeyPoints(text);

    // ✅ ONLY bullet points returned
    return res.json({
      points: keyPoints,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Processing failed" });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});