import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUser(req: Request, res: Response) {
  const { phone } = req.params;
  const user = await prisma.user.findUnique({
    where: { phone: phone ?? "" },
  });
  res.json(user);
}
