import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes";
import inviteRoutes from "./routes/inviteRoutes";
import searchRoutes from "./routes/searchRoutes";
import relationshipRoutes from "./routes/relationshipRoutes";

const app = express();

// Enable trust proxy for accurate IP detection behind proxies (like Railway, Heroku, etc.)
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

// Global rate limiting - general API usage
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === "/";
  },
});

// Extra strict rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 10 auth requests per 15 minutes
  message: {
    error: "Too many authentication attempts, please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
});

// Very strict rate limiting for signup/verification attempts
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signup attempts per hour
  message: {
    error: "Too many signup attempts, please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate rate limiting for search functionality
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 search requests per 15 minutes
  message: {
    error: "Too many search requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for invite operations
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 invite-related requests per 15 minutes
  message: {
    error: "Too many invite requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for relationship operations
const relationshipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 relationship requests per 15 minutes
  message: {
    error: "Too many relationship requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiting to all requests
app.use(globalLimiter);

// Apply specific rate limiting to different routes
app.use("/auth", authLimiter);
app.use("/auth/signup", signupLimiter);
app.use("/auth/verify", signupLimiter);
app.use("/search", searchLimiter);
app.use("/invites", inviteLimiter);
app.use("/relationships", relationshipLimiter);

// Routes
app.use("/auth", authRoutes);
app.use("/invites", inviteRoutes);
app.use("/search", searchRoutes);
app.use("/relationships", relationshipRoutes);

app.get("/", (_req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env["PORT"] || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
