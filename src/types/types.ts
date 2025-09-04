import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    _id: string; // Add this line
  };
}
