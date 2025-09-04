import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middleware/middleware";

const prisma = new PrismaClient();
const JWT_SECRET = process.env["JWT_SECRET"] || "your-jwt-secret-key";

// Generate a 4-digit verification code
function generateVerificationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// TODO: Replace with actual Twilio implementation
async function sendSMSVerificationCode(
  phone: string,
  code: string
): Promise<void> {
  console.log(`Sending SMS to ${phone}: Your verification code is ${code}`);
  // For now, just log the code. In production, implement Twilio here:
  // const twilio = require('twilio')(accountSid, authToken);
  // await twilio.messages.create({
  //   body: `Your verification code is ${code}`,
  //   from: '+1234567890', // Your Twilio number
  //   to: phone
  // });
}

export async function getUser(req: Request, res: Response) {
  const { phone } = req.params;
  const user = await prisma.user.findUnique({
    where: { phone: phone ?? "" },
  });
  res.json(user);
}

export async function signup(req: Request, res: Response) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    // Generate verification code
    const verificationCode = generateVerificationCode();

    if (existingUser) {
      // Update existing user with new verification code
      await prisma.user.update({
        where: { phone },
        data: { verificationCode },
      });
    } else {
      // Create new user with verification code
      await prisma.user.create({
        data: {
          phone,
          verificationCode,
        },
      });
    }

    // Send SMS verification code
    await sendSMSVerificationCode(phone, verificationCode);

    return res.status(200).json({
      message: "Verification code sent successfully",
      phone,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function verifyCode(req: Request, res: Response) {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ error: "Phone number and verification code are required" });
    }

    // Find user and verify code
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Clear verification code and generate JWT token
    await prisma.user.update({
      where: { phone },
      data: { verificationCode: null },
    });

    const token = jwt.sign({ userId: user.id, phone: user.phone }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({
      message: "Verification successful",
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        relationshipStatus: user.relationshipStatus,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  console.log("Getting current user");
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        relationshipStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
