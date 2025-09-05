import express from "express";
import {
  sendInvite,
  getInvites,
  respondToInvite,
  cancelInvite,
  getInviteById,
  getPublicInviteById,
  respondToPublicInvite,
  sendInviteVerificationCode,
  verifyCodeAndAcceptInvite,
} from "../controllers/inviteController";
import { authenticateToken } from "../middleware/middleware";

const router = express.Router();

// Public routes for website invite confirmation (no auth required)
router.get("/public/:inviteId", getPublicInviteById);
router.post("/public/:inviteId/respond", respondToPublicInvite);

// New public routes for verification flow
router.post("/public/send-verification", sendInviteVerificationCode);
router.post("/public/verify-and-accept", verifyCodeAndAcceptInvite);

// All other invite routes require authentication
router.post("/send", authenticateToken, sendInvite);
router.get("/", authenticateToken, getInvites);
router.get("/:inviteId", authenticateToken, getInviteById);
router.post("/respond", authenticateToken, respondToInvite);
router.delete("/:inviteId", authenticateToken, cancelInvite);

export default router;
