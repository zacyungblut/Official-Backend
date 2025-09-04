import express from "express";
import {
  getUser,
  signup,
  verifyCode,
  getCurrentUser,
} from "../controllers/userController";
import { authenticateToken } from "../middleware/middleware";

const router = express.Router();

router.get("/me", authenticateToken, getCurrentUser);
router.post("/signup", signup);
router.post("/verify", verifyCode);
router.get("/:phone", getUser);

// Add this new route for getting current authenticated user

export default router;
