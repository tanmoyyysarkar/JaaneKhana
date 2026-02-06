import "dotenv/config";
import express from "express";
import multer from "multer";
import bot from "./bot/index.js";
import getPrescriptionFromAPI from "./routes/gemini.routes.js"
import ttsRoutes from "./routes/tts.routes.js";
import profileRoutes from "./routes/profile.routes.js";

const app = express();

// Enable CORS for frontend
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

	// Handle preflight requests
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});

// parse JSON and urlencoded bodies for routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// make upload available globally for routes
app.locals.upload = upload;

// serve generated audio/files
app.use('/uploads', express.static('uploads'));

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
app.use("/", ttsRoutes);
app.use("/", profileRoutes);

export default app;
