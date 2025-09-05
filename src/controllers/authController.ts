import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { AuthenticatedRequest } from "../middleware/middleware";

const prisma = new PrismaClient();
const JWT_SECRET = process.env["JWT_SECRET"] || "your-jwt-secret-key";

// Initialize Twilio client
const client = twilio(
  process.env["TWILIO_ACCOUNT_SID"],
  process.env["TWILIO_AUTH_TOKEN"]
);

// Normalize phone number by removing all non-digit characters and ensuring it starts with +
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // If it doesn't start with +, add it
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }

  return normalized;
}

// Check if phone number is from allowed countries
function isPhoneNumberFromAllowedCountry(phoneNumber: string): boolean {
  // Normalize the phone number first
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  // Define allowed country codes
  const allowedCountryCodes = [
    "+1", // US/Canada
    "+61", // Australia
    "+64", // New Zealand
    "+44", // UK
    "+49", // Germany
    "+33", // France
    "+34", // Spain
    "+351", // Portugal
    "+41", // Switzerland
    "+31", // Netherlands
    "+43", // Austria
    "+36", // Hungary
    "+46", // Sweden
    "+47", // Norway
    "+358", // Finland
    // Added popular but relatively cheap-to-SMS countries:
    "+48", // Poland
    "+420", // Czech Republic
    "+421", // Slovakia
    "+40", // Romania
    "+380", // Ukraine
    "+30", // Greece
    "+353", // Ireland
    "+32", // Belgium
    "+386", // Slovenia
    "+385", // Croatia
    "+370", // Lithuania
    "+371", // Latvia
    "+372", // Estonia
    "+357", // Cyprus
    "+90", // Turkey
  ];

  // Check if the phone number starts with any of the allowed country codes
  return allowedCountryCodes.some((code) => normalizedPhone.startsWith(code));
}

// Generate a 4-digit verification code
function generateVerificationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send SMS verification code using Twilio
async function sendSMSVerificationCode(
  phone: string,
  code: string
): Promise<void> {
  try {
    // Check if phone number is from allowed country before sending
    if (!isPhoneNumberFromAllowedCountry(phone)) {
      console.error(`Phone number ${phone} is not from an allowed country`);
      throw new Error("Phone number from unsupported country");
    }

    if (!process.env["TWILIO_PHONE_NUMBER"]) {
      console.error("Twilio phone number is not configured");
      throw new Error("Server configuration error");
    }

    if (
      !process.env["TWILIO_ACCOUNT_SID"] ||
      !process.env["TWILIO_AUTH_TOKEN"]
    ) {
      console.error("Twilio credentials are not configured");
      throw new Error("Server configuration error");
    }

    // Normalize the phone number before sending
    const normalizedPhone = normalizePhoneNumber(phone);

    await client.messages.create({
      body: `Your Official verification code is: ${code}`,
      to: normalizedPhone,
      from: process.env["TWILIO_PHONE_NUMBER"],
    });

    console.log(
      `SMS verification code sent successfully to ${normalizedPhone} with code ${code}`
    );
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw new Error("Failed to send verification code");
  }
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

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phone);

    // Check if phone number is from allowed country
    if (!isPhoneNumberFromAllowedCountry(normalizedPhone)) {
      return res.status(400).json({
        error:
          "Phone number from unsupported country. We currently only support US, Canada, Australia, New Zealand, UK, and select European countries.",
      });
    }

    // Check if user already exists (using normalized phone)
    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    // Generate verification code
    const verificationCode = generateVerificationCode();

    if (existingUser) {
      // If user exists and is already verified, this is a login attempt
      if (existingUser.verified) {
        // Update with new verification code for login
        await prisma.user.update({
          where: { phone: normalizedPhone },
          data: { verificationCode },
        });

        // Send SMS verification code
        try {
          await sendSMSVerificationCode(normalizedPhone, verificationCode);
        } catch (twilioError) {
          console.error("SMS sending failed:", twilioError);
          return res.status(500).json({
            error: "Failed to send verification code. Please try again.",
          });
        }

        return res.status(200).json({
          message: "Login verification code sent successfully",
          phone: normalizedPhone,
          isExistingUser: true,
        });
      } else {
        // User exists but not verified, update verification code
        await prisma.user.update({
          where: { phone: normalizedPhone },
          data: { verificationCode },
        });
      }
    } else {
      // Create new user with verification code (using normalized phone)
      await prisma.user.create({
        data: {
          phone: normalizedPhone,
          verificationCode,
          verified: false,
        },
      });
    }

    // Send SMS verification code
    try {
      await sendSMSVerificationCode(normalizedPhone, verificationCode);
    } catch (twilioError) {
      console.error("SMS sending failed:", twilioError);
      return res.status(500).json({
        error: "Failed to send verification code. Please try again.",
      });
    }

    return res.status(200).json({
      message: "Verification code sent successfully",
      phone: normalizedPhone,
      isExistingUser: !!existingUser,
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

    // Normalize the phone number for lookup
    const normalizedPhone = normalizePhoneNumber(phone);

    // Find user and verify code
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Clear verification code, set verified to true, and generate JWT token
    await prisma.user.update({
      where: { phone: normalizedPhone },
      data: {
        verificationCode: null,
        verified: true,
      },
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
        verified: true,
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
    const userPhone = req.user?.phone;

    if (!userId || !userPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
        relationships: {
          include: {
            users: {
              select: {
                id: true,
                phone: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.verified !== true) {
      return res
        .status(404)
        .json({ error: "User not found or is not verified" });
    }

    // Get invites sent by user only
    const sentInvites = await prisma.invite.findMany({
      where: { senderPhone: userPhone },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      user: {
        ...user,
        sentInvites,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
