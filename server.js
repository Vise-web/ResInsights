import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

/* ---------------- BASIC SETUP ---------------- */
const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

/* ---------------- UPLOADS ---------------- */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads/" });

/* ---------------- GEMINI SETUP ---------------- */
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY missing in .env");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/* ---------------- ROUTE ---------------- */
app.post("/upload", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    filePath = req.file.path;

    /* PDF → TEXT */
    const buffer = fs.readFileSync(filePath);
    const pdf = await pdfParse(buffer);

    if (!pdf.text.trim()) {
      throw new Error("Empty PDF");
    }

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
${pdf.text}
"""
`;

    /* GEMINI CALL */
    const result = await model.generateContent(prompt);
    const output = result.response.text();

    /* SAVE OUTPUT */
    fs.writeFileSync(
      path.join(__dirname, "public", "output.txt"),
      output,
      "utf-8"
    );

    /* CLEANUP */
    fs.unlinkSync(filePath);

    /* REDIRECT TO RESULT PAGE */
    res.redirect("/result.html");
  } catch (err) {
    console.error("❌ Error:", err);

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).send("Resume processing failed");
  }
});

/* ---------------- SERVER ---------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
