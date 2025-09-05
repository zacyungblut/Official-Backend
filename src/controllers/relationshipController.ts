import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/middleware";

const prisma = new PrismaClient();

export async function editRelationship(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const userPhone = req.user?.phone;

    if (!userId || !userPhone) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { relationshipId, ...updateData } = req.body;

    if (!relationshipId) {
      return res.status(400).json({ error: "Relationship ID is required" });
    }

    // Verify the user is part of this relationship
    const existingRelationship = await prisma.relationship.findFirst({
      where: {
        id: relationshipId,
        users: {
          some: {
            id: userId,
          },
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

    if (!existingRelationship) {
      return res.status(404).json({
        error: "Relationship not found or you don't have permission to edit it",
      });
    }

    // Update the relationship with provided data
    const updatedRelationship = await prisma.relationship.update({
      where: {
        id: relationshipId,
      },
      data: updateData,
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

    return res.status(200).json({
      message: "Relationship updated successfully",
      relationship: updatedRelationship,
    });
  } catch (error) {
    console.error("Edit relationship error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserRelationships(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const relationships = await prisma.relationship.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      relationships,
    });
  } catch (error) {
    console.error("Get user relationships error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
