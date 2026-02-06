import express from "express";
const router = express.Router();

// Centralized profile options - single source of truth
export const PROFILE_OPTIONS = {
    conditions: [
        { label: "Diabetes", value: "diabetes" },
        { label: "High BP", value: "bp" },
        { label: "Thyroid", value: "thyroid" },
        { label: "Cholesterol", value: "cholesterol" },
    ],
    allergies: [
        { label: "Milk/Lactose", value: "milk" },
        { label: "Nuts", value: "nuts" },
        { label: "Gluten", value: "gluten" },
        { label: "Soy", value: "soy" },
    ],
    diets: [
        { label: "Vegetarian", value: "vegetarian" },
        { label: "Vegan", value: "vegan" },
        { label: "Non-Vegetarian", value: "nonveg" },
    ],
    goals: [
        { label: "Healthy eating", value: "health" },
        { label: "Weight loss", value: "weightloss" },
        { label: "Muscle gain", value: "musclegain" },
    ],
};

// GET /api/profile/options - returns all profile options
router.get("/api/profile/options", (req, res) => {
    res.json(PROFILE_OPTIONS);
});

export default router;
