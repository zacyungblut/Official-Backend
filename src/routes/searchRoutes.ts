import express from "express";
import { searchUserByPhone } from "../controllers/searchController";
import { authenticateToken } from "../middleware/middleware";

const router = express.Router();

// Search for a user by phone number
router.post("/user", authenticateToken, searchUserByPhone);

export default router;
