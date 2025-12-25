/* ---------------- ROUTES ---------------- */

// Optional GET route
app.get("/upload", (req, res) => {
  res.send("Use the homepage upload form.");
});

// POST route (ALL logic INSIDE)
app.post("/upload", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    filePath = req.file.path;

    // PDF → TEXT
    const buffer = fs.readFileSync(filePath);
    const pdf = await pdfParse(buffer);

    if (!pdf.text.trim()) {
      throw new Error("Empty PDF");
    }

    // PROMPT
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

    // GEMINI
    const result = await model.generateContent(prompt);
    const output = result.response.text();

    // SAVE OUTPUT
    fs.writeFileSync(
      path.join(__dirname, "public", "output.txt"),
      output,
      "utf-8"
    );

    // CLEANUP
    fs.unlinkSync(filePath);

    // REDIRECT
    res.redirect("/result.html");

  } catch (err) {
    console.error("❌ Error:", err);

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).send("Resume processing failed: " + err.message);
  }
});
