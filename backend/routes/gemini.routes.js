import express from "express";
import { analyzeFoodLabel } from "../services/gemini.service.js";
const router = express.Router();

// route with multer middleware to handle file upload
router.post("/api/gemini/upload", (req, res, next) => {
    req.app.locals.upload.single('imagePath')(req, res, next);
}, async (req, res) => {
    console.log("api called");
    try {
        // check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'Missing file upload. Send form-data with key "imagePath" and a PNG file.' });
        }

        // Parse profile data if provided
        let profileData = null;
        if (req.body.profile) {
            try {
                profileData = JSON.parse(req.body.profile);
                console.log("Profile data received:", profileData);
            } catch (e) {
                console.warn("Failed to parse profile data:", e);
            }
        }

        // Single API call - analyze food label directly
        const result = await analyzeFoodLabel(req.file, profileData);
        console.log(result);

        return res.json({ analysis: result });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Failed to analyze food label' });
    }
});

export default router;
