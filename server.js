const express = require("express");
const multer = require("multer");
const cors = require("cors");
require("dotenv").config();

const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const app = express();

// ✅ VERY IMPORTANT FOR AZURE
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ✅ multer setup
const upload = multer();

// ✅ Azure client
const client = new DocumentAnalysisClient(
  process.env.AZURE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_KEY)
);

// 🔥 Health check route (IMPORTANT)
app.get("/", (req, res) => {
  res.send("🚀 API is running successfully!");
});

// 🔥 Extract key points
function extractKeyPoints(text) {
  const points = [];

  const invoice = text.match(/INV-\d+/)?.[0];
  const date = text.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  const total = text.match(/TOTAL DUE\s*\$?([\d.]+)/i)?.[1];
  const customerMatch = text.match(/CUSTOMER NAME:\s*(.*)/i);

  if (invoice) points.push(`📄 Invoice Number: ${invoice}`);
  if (date) points.push(`📅 Date: ${date}`);
  if (customerMatch) points.push(`👤 Customer: ${customerMatch[1]}`);
  if (total) points.push(`💰 Total: $${total}`);

  return points;
}

// 🔥 MAIN API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

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

    return res.json({
      success: true,
      points: keyPoints,
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({ error: "Processing failed" });
  }
});

// ✅ START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});