import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/middleware";

const prisma = new PrismaClient();

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

// Helper function to determine user's relationship status
async function getUserRelationshipStatus(userPhone: string): Promise<string> {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { phone: userPhone },
      include: {
        relationships: {
          where: {
            endDate: null, // Only active relationships (no end date)
          },
          include: {
            users: {
              select: {
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.verified) {
      return "Unknown";
    }

    // If user has no active relationships, they're single
    if (!user.relationships || user.relationships.length === 0) {
      return "Single";
    }

    // Get the most recent active relationship
    const activeRelationship = user.relationships[0];
    if (!activeRelationship) {
      return "Single";
    }

    // Convert the status to a more user-friendly format
    switch (activeRelationship.status) {
      case "DATING":
        return "Dating";
      case "ENGAGED":
        return "Engaged";
      case "MARRIED":
        return "Married";
      case "SEPARATED":
        return "Separated";
      case "WIDOWED":
        return "Widowed";
      case "SITUATIONSHIP":
        return "Situationship";
      case "FRIENDS_WITH_BENEFITS":
        return "Friends with Benefits";
      case "ON_A_BREAK":
        return "On a Break";
      case "OPEN_RELATIONSHIP":
        return "Open Relationship";
      case "POLYAMOROUS":
        return "Polyamorous";
      default:
        return "Dating";
    }
  } catch (error) {
    console.error("Error getting user relationship status:", error);
    return "Unknown";
  }
}

export async function searchUserByPhone(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(phone);

    // Validate phone number format (basic validation)
    if (normalizedPhone.length < 8) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Get the relationship status for this phone number
    const relationshipStatus = await getUserRelationshipStatus(normalizedPhone);

    // Check if this is a verified user
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        phone: true,
        name: true,
        verified: true,
      },
    });

    // Always return a result, even if user doesn't exist
    const searchResult = {
      phone: normalizedPhone,
      exists: !!user && user.verified,
      relationshipStatus,
      name: user?.name || null,
    };

    return res.status(200).json({
      success: true,
      result: searchResult,
    });
  } catch (error) {
    console.error("Search user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
