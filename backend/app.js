import "dotenv/config";
import express from "express";
import multer from "multer";
import bot from "./bot/index.js";
import getPrescriptionFromAPI from "./routes/gemini.routes.js"

const app = express();
// parse JSON and urlencoded bodies for routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// make upload available globally for routes
app.locals.upload = upload;

// debug logger for gemini API requests
app.use((req, res, next) => {
	if (req.path && req.path.startsWith('/api/gemini')) {
		console.log('Incoming request', { method: req.method, path: req.path, contentType: req.headers['content-type'], body: req.body });
	}
	next();
});

// register telegram webhook middleware (mounted at bot.webhookPath)
app.use(bot.webhookCallback(bot.webhookPath));

// application routes
app.use("/", getPrescriptionFromAPI)

export default app;
