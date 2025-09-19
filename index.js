import express from "express";
import multer from "multer";
import path from "path";

const app = express();
const sessions = [];   // 🔥 store all SSE connections in array
const submissions = new Map();

// ---- Multer storage ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- SSE Registration ----
app.get("/events/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Save connection to array
  sessions.push(res);
  console.log(`✅ Session registered: ${sessionId} (Total: ${sessions.length})`);

  // Send welcome event
  res.write(`data: ${JSON.stringify({ message: "SSE connection established" })}\n\n`);

  // Cleanup on disconnect
  req.on("close", () => {
    const idx = sessions.indexOf(res);
    if (idx !== -1) sessions.splice(idx, 1);
    console.log(`❌ Session closed: ${sessionId} (Total: ${sessions.length})`);
  });
});

// ---- New Submission (broadcast to all clients) ----
app.post("/new-valid-submission", (req, res) => {
  const { id, type, confidence, prediction } = req.body;

  const existingSubmission = submissions.get(id) || {};
  const data = {
    ...existingSubmission,
    type,
    confidence,
    content: prediction,
    source: "Citizen Report"
  };

  // Save back into submissions map
  submissions.set(id, data);

  // Broadcast to all sessions
  sessions.forEach(client => {
    client.write(`data: ${JSON.stringify({ data })}\n\n`);
  });

  res.json({ status: `Message broadcasted to ${sessions.length} sessions` });
});

// ---- Example: Broadcast manually ----
app.post("/broadcast", (req, res) => {
  const { message } = req.body;

  sessions.forEach(client => {
    client.write(`data: ${JSON.stringify({ message })}\n\n`);
  });

  res.json({ status: `Broadcasted to ${sessions.length} sessions` });
});

// ---- Form + Image Upload ----
app.post("/fuck-shiven", upload.single("image"), (req, res) => {
  try {
    const { content, type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    // later: call AI model here with `file.path`

    res.json({
      message: "Form data + image received successfully ✅",
      data: {
        content,
        type,
        imageUrl: `/uploads/${file.filename}`
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// ---- Serve uploaded files ----
app.use("/uploads", express.static("uploads"));

app.listen(8000, () => {
  console.log("🚀 Server running on http://localhost:8000");
});
