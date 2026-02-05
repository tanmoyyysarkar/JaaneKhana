import express from "express";
import { extractPrescription, getDetailsFromData } from "../services/gemini.service.js";
const router = express.Router();

// route with multer middleware to handle file upload
router.post("/api/gemini/upload", (req, res, next) => {
    req.app.locals.upload.single('imagePath')(req, res, next);
}, async (req, res) => {
    try {
        // check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'Missing file upload. Send form-data with key "imagePath" and a PNG file.' });
        }

        // pass file buffer to extractPrescription
        const data = await extractPrescription(req.file);
        console.log(data);

        const result = await getDetailsFromData(data);
        return res.json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Failed to extract prescription' });
    }
});

export default router;
