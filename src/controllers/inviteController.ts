import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/middleware";
import twilio from "twilio";

const prisma = new PrismaClient();

// Initialize Twilio client (same as in authController)
const client = twilio(
  process.env["TWILIO_ACCOUNT_SID"],
  process.env["TWILIO_AUTH_TOKEN"]
);

// Normalize phone number function (copied from authController)
function normalizePhoneNumber(phoneNumber: string): string {
  let normalized = phoneNumber.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

// Check if phone number is from allowed countries (copied from authController)
function isPhoneNumberFromAllowedCountry(phoneNumber: string): boolean {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const allowedCountryCodes = [
    "+1",
    "+61",
    "+64",
    "+44",
    "+49",
    "+33",
    "+34",
    "+351",
    "+41",
    "+31",
    "+43",
    "+36",
    "+46",
    "+47",
    "+358",
    "+48",
    "+420",
    "+421",
    "+40",
    "+380",
    "+30",
    "+353",
    "+32",
    "+386",
    "+385",
    "+370",
    "+371",
    "+372",
    "+357",
    "+90",
  ];
  return allowedCountryCodes.some((code) => normalizedPhone.startsWith(code));
}

// Generate verification code
function generateVerificationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Send SMS verification code
async function sendSMSVerificationCode(
  phone: string,
  code: string
): Promise<void> {
  try {
    if (!isPhoneNumberFromAllowedCountry(phone)) {
      throw new Error("Phone number from unsupported country");
    }

    if (
      !process.env["TWILIO_PHONE_NUMBER"] ||
      !process.env["TWILIO_ACCOUNT_SID"] ||
      !process.env["TWILIO_AUTH_TOKEN"]
    ) {
      throw new Error("Server configuration error");
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    await client.messages.create({
      body: `Your Official verification code is: ${code}`,
      to: normalizedPhone,
      from: process.env["TWILIO_PHONE_NUMBER"],
    });

    console.log(
      `SMS verification code sent successfully to ${normalizedPhone}`
    );
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw new Error("Failed to send verification code");
  }
}

export async function sendInvite(req: AuthenticatedRequest, res: Response) {
  try {
    const { relationshipType } = req.body;
    const senderPhone = req.user?.phone;

    if (!senderPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!relationshipType) {
      return res.status(400).json({
        error: "Relationship type is required",
      });
    }

    // Validate relationship type
    const validRelationshipTypes = ["DATING", "MARRIED", "SITUATIONSHIP"];
    const mappedRelationshipType = relationshipType.toUpperCase();

    if (!validRelationshipTypes.includes(mappedRelationshipType)) {
      return res.status(400).json({ error: "Invalid relationship type" });
    }

    // Create the invite
    const invite = await prisma.invite.create({
      data: {
        senderPhone,
        relationshipType: mappedRelationshipType as any,
        status: "PENDING",
      },
    });

    return res.status(200).json({
      message: "Invite created successfully",
      invite: {
        id: invite.id,
        relationshipType: invite.relationshipType,
        status: invite.status,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error("Send invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getInvites(req: AuthenticatedRequest, res: Response) {
  try {
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get invites sent by user only
    const sentInvites = await prisma.invite.findMany({
      where: { senderPhone: userPhone },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      sentInvites,
    });
  } catch (error) {
    console.error("Get invites error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function respondToInvite(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { inviteId, response } = req.body; // response: 'ACCEPTED' | 'DECLINED'
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!inviteId || !response) {
      return res.status(400).json({
        error: "Invite ID and response are required",
      });
    }

    if (!["ACCEPTED", "DECLINED"].includes(response)) {
      return res
        .status(400)
        .json({ error: "Invalid response. Must be ACCEPTED or DECLINED" });
    }

    // Find the invite with sender information
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: true,
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if the user is the recipient
    if (invite.senderPhone !== userPhone) {
      return res
        .status(403)
        .json({ error: "Not authorized to respond to this invite" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: "Invite is no longer pending" });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update invite status
      const updatedInvite = await tx.invite.update({
        where: { id: inviteId },
        data: { status: response as any },
      });

      let relationship = null;

      // If accepted, create relationship between sender and recipient
      if (response === "ACCEPTED") {
        // Check if a relationship already exists between these users
        const existingRelationship = await tx.relationship.findFirst({
          where: {
            AND: [
              {
                users: {
                  some: { phone: invite.senderPhone },
                },
              },
              {
                users: {
                  some: { phone: invite.senderPhone },
                },
              },
              {
                endDate: null, // Only active relationships
              },
            ],
          },
          include: {
            users: {
              select: {
                id: true,
                phone: true,
                name: true,
              },
            },
          },
        });

        if (!existingRelationship) {
          // Create new relationship and connect both users
          relationship = await tx.relationship.create({
            data: {
              status: "DATING", // Default to DATING, can be customized later
              startDate: new Date(),
              users: {
                connect: [
                  { phone: invite.senderPhone },
                  { phone: invite.senderPhone },
                ],
              },
            },
            include: {
              users: {
                select: {
                  id: true,
                  phone: true,
                  name: true,
                },
              },
            },
          });

          console.log(
            `Created new relationship between ${invite.senderPhone} and ${invite.senderPhone}`
          );
        } else {
          console.log(
            `Relationship already exists between ${invite.senderPhone} and ${invite.senderPhone}`
          );
          relationship = existingRelationship;
        }
      }

      return {
        updatedInvite,
        relationship,
      };
    });

    const responseMessage =
      response === "ACCEPTED"
        ? "Relationship confirmed successfully! You are now officially connected."
        : "Invite declined successfully.";

    return res.status(200).json({
      message: responseMessage,
      invite: result.updatedInvite,
      ...(result.relationship && {
        relationship: {
          id: result.relationship.id,
          status: result.relationship.status,
          startDate: result.relationship.startDate,
          users: result.relationship.users,
        },
      }),
    });
  } catch (error) {
    console.error("Respond to invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function cancelInvite(req: AuthenticatedRequest, res: Response) {
  try {
    const { inviteId } = req.params;
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!inviteId) {
      return res.status(400).json({ error: "Invite ID is required" });
    }

    // Find the invite
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if the user is the sender
    if (invite.senderPhone !== userPhone) {
      return res
        .status(403)
        .json({ error: "Not authorized to cancel this invite" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: "Only pending invites can be cancelled" });
    }

    // Update invite status to cancelled
    const updatedInvite = await prisma.invite.update({
      where: { id: inviteId },
      data: { status: "CANCELLED" },
    });

    return res.status(200).json({
      message: "Invite cancelled successfully",
      invite: updatedInvite,
    });
  } catch (error) {
    console.error("Cancel invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getInviteById(req: AuthenticatedRequest, res: Response) {
  try {
    const { inviteId } = req.params;

    if (!inviteId) {
      return res.status(400).json({ error: "Invite ID is required" });
    }

    // Find the invite with sender information
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: {
          select: {
            phone: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({
        error: "This invite is no longer active",
        status: invite.status,
      });
    }

    return res.status(200).json({
      invite: {
        id: invite.id,
        senderPhone: invite.senderPhone,
        senderName: invite.sender.name,
        status: invite.status,
        message: invite.message,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error("Get invite by ID error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Public endpoint for website - doesn't require authentication
export async function getPublicInviteById(req: any, res: Response) {
  try {
    const { inviteId } = req.params;

    if (!inviteId) {
      return res.status(400).json({ error: "Invite ID is required" });
    }

    // Find the invite with sender information
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: {
          select: {
            phone: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({
        error: "This invite is no longer active",
        status: invite.status,
      });
    }

    return res.status(200).json({
      invite: {
        id: invite.id,
        senderPhone: invite.senderPhone,
        senderName: invite.sender.name,
        status: invite.status,
        message: invite.message,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error("Get public invite by ID error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Public endpoint for responding to invites from website
export async function respondToPublicInvite(req: any, res: Response) {
  try {
    const { inviteId } = req.params;
    const { response } = req.body; // response: 'ACCEPTED' | 'DECLINED'

    if (!inviteId || !response) {
      return res.status(400).json({
        error: "Invite ID and response are required",
      });
    }

    if (!["ACCEPTED", "DECLINED"].includes(response)) {
      return res
        .status(400)
        .json({ error: "Invalid response. Must be ACCEPTED or DECLINED" });
    }

    // Find the invite with sender information
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: true,
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({
        error: "This invite is no longer active",
        status: invite.status,
      });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update invite status
      const updatedInvite = await tx.invite.update({
        where: { id: inviteId },
        data: { status: response as any },
      });

      // Create or find the recipient user (the person responding to the invite)
      let recipientUser = await tx.user.findUnique({
        where: { phone: invite.senderPhone },
      });

      if (!recipientUser) {
        // Create new user for the recipient with verified: false
        recipientUser = await tx.user.create({
          data: {
            phone: invite.senderPhone,
            verified: false,
          },
        });
        console.log(`Created new user for recipient: ${invite.senderPhone}`);
      }

      let relationship = null;

      // If accepted, create relationship between sender and recipient
      if (response === "ACCEPTED") {
        // Check if a relationship already exists between these users
        const existingRelationship = await tx.relationship.findFirst({
          where: {
            AND: [
              {
                users: {
                  some: { phone: invite.senderPhone },
                },
              },
              {
                users: {
                  some: { phone: invite.senderPhone },
                },
              },
              {
                endDate: null, // Only active relationships
              },
            ],
          },
          include: {
            users: {
              select: {
                id: true,
                phone: true,
                name: true,
              },
            },
          },
        });

        if (!existingRelationship) {
          // Create new relationship and connect both users
          relationship = await tx.relationship.create({
            data: {
              status: "DATING", // Default to DATING, can be customized later
              startDate: new Date(),
              users: {
                connect: [
                  { phone: invite.senderPhone },
                  { phone: invite.senderPhone },
                ],
              },
            },
            include: {
              users: {
                select: {
                  id: true,
                  phone: true,
                  name: true,
                },
              },
            },
          });

          console.log(
            `Created new relationship between ${invite.senderPhone} and ${invite.senderPhone}`
          );
        } else {
          console.log(
            `Relationship already exists between ${invite.senderPhone} and ${invite.senderPhone}`
          );
          relationship = existingRelationship;
        }
      }

      return {
        updatedInvite,
        recipientUser,
        relationship,
      };
    });

    const responseMessage =
      response === "ACCEPTED"
        ? "Relationship confirmed successfully! You are now officially connected."
        : "Invite declined successfully.";

    return res.status(200).json({
      message: responseMessage,
      invite: {
        id: result.updatedInvite.id,
        status: result.updatedInvite.status,
      },
      user: {
        id: result.recipientUser.id,
        phone: result.recipientUser.phone,
        verified: result.recipientUser.verified,
      },
      ...(result.relationship && {
        relationship: {
          id: result.relationship.id,
          status: result.relationship.status,
          startDate: result.relationship.startDate,
          users: result.relationship.users,
        },
      }),
    });
  } catch (error) {
    console.error("Respond to public invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// New endpoint: Send verification code for invite confirmation
export async function sendInviteVerificationCode(req: any, res: Response) {
  try {
    const { inviteId, phone } = req.body;

    if (!inviteId || !phone) {
      return res.status(400).json({
        error: "Invite ID and phone number are required",
      });
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

    // Find the invite
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({
        error: "This invite is no longer active",
        status: invite.status,
      });
    }

    // Verify that the phone number matches the invite recipient
    if (invite.senderPhone === normalizedPhone) {
      return res.status(400).json({
        error: "You cannot accept your own invite",
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create or update user with verification code
    await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: {
        verificationCode,
        verified: false, // Keep as unverified until they confirm the code
      },
      create: {
        phone: normalizedPhone,
        verificationCode,
        verified: false,
      },
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
      message: "Verification code sent successfully",
      phone: normalizedPhone,
    });
  } catch (error) {
    console.error("Send invite verification code error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// New endpoint: Verify code and accept invite
export async function verifyCodeAndAcceptInvite(req: any, res: Response) {
  try {
    const { inviteId, phone, code } = req.body;

    if (!inviteId || !phone || !code) {
      return res.status(400).json({
        error: "Invite ID, phone number, and verification code are required",
      });
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phone);

    // Find the invite
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: true,
      },
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      return res.status(400).json({
        error: "This invite is no longer active",
        status: invite.status,
      });
    }

    // Verify that the phone number matches the invite recipient
    if (invite.senderPhone !== normalizedPhone) {
      return res.status(400).json({
        error: "Phone number does not match the invite recipient",
      });
    }

    // Find user and verify code
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found. Please request a new verification code.",
      });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Start a transaction to verify user, accept invite, and create relationship
    const result = await prisma.$transaction(async (tx) => {
      // Verify the user and clear verification code
      const verifiedUser = await tx.user.update({
        where: { phone: normalizedPhone },
        data: {
          verificationCode: null,
          verified: true,
        },
      });

      // Update invite status to ACCEPTED
      const updatedInvite = await tx.invite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      });

      // Check if a relationship already exists between these users
      const existingRelationship = await tx.relationship.findFirst({
        where: {
          AND: [
            {
              users: {
                some: { phone: invite.senderPhone },
              },
            },
            {
              users: {
                some: { phone: invite.senderPhone },
              },
            },
            {
              endDate: null, // Only active relationships
            },
          ],
        },
        include: {
          users: {
            select: {
              id: true,
              phone: true,
              name: true,
            },
          },
        },
      });

      let relationship = null;

      if (!existingRelationship) {
        // Create new relationship and connect both users
        relationship = await tx.relationship.create({
          data: {
            status: "DATING", // Default to DATING, can be customized later
            startDate: new Date(),
            users: {
              connect: [
                { phone: invite.senderPhone },
                { phone: invite.senderPhone },
              ],
            },
          },
          include: {
            users: {
              select: {
                id: true,
                phone: true,
                name: true,
              },
            },
          },
        });

        console.log(
          `Created new relationship between ${invite.senderPhone} and ${invite.senderPhone}`
        );
      } else {
        console.log(
          `Relationship already exists between ${invite.senderPhone} and ${invite.senderPhone}`
        );
        relationship = existingRelationship;
      }

      return {
        verifiedUser,
        updatedInvite,
        relationship,
      };
    });

    return res.status(200).json({
      message: "Verification successful! Relationship confirmed.",
      user: {
        id: result.verifiedUser.id,
        phone: result.verifiedUser.phone,
        verified: result.verifiedUser.verified,
      },
      invite: {
        id: result.updatedInvite.id,
        status: result.updatedInvite.status,
      },
      relationship: {
        id: result.relationship.id,
        status: result.relationship.status,
        startDate: result.relationship.startDate,
        users: result.relationship.users,
      },
    });
  } catch (error) {
    console.error("Verify code and accept invite error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
