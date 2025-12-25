import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

/* ---------------- BASIC SETUP ---------------- */
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

console.log("🔥 NEW DEPLOYMENT — CLEAN VERSION RUNNING");

/* ---------------- MULTER (MEMORY STORAGE) ---------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* ---------------- GEMINI SETUP ---------------- */
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/* ---------------- SAFETY: GET /upload ---------------- */
app.get("/upload", (req, res) => {
  res.redirect("/");
});

/* ---------------- MAIN ROUTE ---------------- */
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    console.log("📥 Resume upload received");

    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).send("Only PDF files are allowed");
    }

    /* PDF → TEXT */
    const pdfData = await pdfParse(req.file.buffer);
    let resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).send("PDF has no readable text");
    }

    resumeText = resumeText.slice(0, 8000); // prevent timeout

    /* PROMPT */
    const prompt = `
You are a professional resume reviewer and ATS expert.

Analyze the resume and provide:
1. Overall Score (out of 10)
2. Strengths
3. Weaknesses
4. Specific Improvements
5. Missing Sections
6. ATS Compatibility Score (out of 10)

Resume:
"""
${resumeText}
"""
`;

    /* GEMINI CALL */
    const result = await model.generateContent(prompt);
    const output = result.response.text();

    /* SEND RESULT (NO FILE STORAGE) */
    res.send(`
      <html>
        <head>
          <title>Resume Review</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            pre { white-space: pre-wrap; }
            a { display: inline-block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Resume Analysis</h1>
          <pre>${output}</pre>
          <a href="/">Upload another resume</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ FULL ERROR:", error);
    res.status(500).send("Resume processing failed");
  }
});

/* ---------------- SERVER ---------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

