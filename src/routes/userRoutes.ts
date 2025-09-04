import express from "express";
import { getUser, signup, verifyCode } from "../controllers/userController";

const router = express.Router();

router.get("/:phone", getUser);
router.post("/signup", signup);
router.post("/verify", verifyCode);

export default router;
