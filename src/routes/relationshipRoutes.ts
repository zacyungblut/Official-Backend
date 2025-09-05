import express from "express";
import {
  editRelationship,
  getUserRelationships,
} from "../controllers/relationshipController";
import { authenticateToken } from "../middleware/middleware";

const router = express.Router();

// All relationship routes require authentication
router.put("/edit", authenticateToken, editRelationship);
router.get("/", authenticateToken, getUserRelationships);

export default router;
