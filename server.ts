import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";

// Setup JSON database
const DB_FILE = "prescriptions.json";

function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
  }
}

function getPrescriptions() {
  const data = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(data);
}

function savePrescription(prescription: any) {
  const prescriptions = getPrescriptions();
  const newPrescription = {
    id: Date.now(),
    data: prescription,
    created_at: new Date().toISOString()
  };
  prescriptions.push(newPrescription);
  fs.writeFileSync(DB_FILE, JSON.stringify(prescriptions, null, 2));
  return newPrescription;
}

async function startServer() {
  initDb();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Setup multer for temporary storage
  const upload = multer({ dest: "uploads/" });

  // Ensure uploads directory exists
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
  }

  // Ensure results directory exists
  if (!fs.existsSync("results")) {
    fs.mkdirSync("results");
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Endpoint to save processed prescription to database
  app.post("/api/prescriptions", (req, res) => {
    try {
      const { data } = req.body;
      const saved = savePrescription(data);
      res.json({ success: true, id: saved.id });
    } catch (error) {
      console.error("JSON DB error:", error);
      res.status(500).json({ error: "Failed to save prescription" });
    }
  });

  // Endpoint to save prescription as individual JSON file
  app.post("/api/save-result", express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { result } = req.body;
      if (!result) {
        return res.status(400).json({ error: "No result data provided" });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const doctorName = result.metadata?.doctor_name?.replace(/\s+/g, "_") || "unknown";
      const filename = `prescription_${doctorName}_${timestamp}.json`;
      const filepath = path.join("results", filename);
      
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      
      res.json({ 
        success: true, 
        filename: filename,
        filepath: filepath,
        message: `Result saved to ${filename}` 
      });
    } catch (error) {
      console.error("Save result error:", error);
      res.status(500).json({ error: "Failed to save result" });
    }
  });

  // Endpoint to list saved results
  app.get("/api/results", (req, res) => {
    try {
      if (!fs.existsSync("results")) {
        return res.json({ results: [] });
      }
      const files = fs.readdirSync("results").filter(f => f.endsWith(".json"));
      res.json({ results: files });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  // Endpoint to download a result file
  app.get("/api/results/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filepath = path.join("results", filename);
      
      // Prevent directory traversal
      if (!filepath.startsWith(path.resolve("results"))) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (fs.existsSync(filepath)) {
        res.download(filepath);
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Endpoint to get history
  app.get("/api/prescriptions", (req, res) => {
    try {
      const prescriptions = getPrescriptions();
      res.json(prescriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // Endpoint to process prescription (Mocking the Python engine flow)
  app.post("/api/process-prescription", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ status: "error", errors: ["No image uploaded"] });
    }
    
    res.json({ 
      status: "success", 
      message: "Image uploaded successfully. Please process using Gemini on the client side.",
      temp_path: req.file.path 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
