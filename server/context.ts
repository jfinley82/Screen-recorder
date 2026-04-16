import type { Request, Response } from "express";
import { getTokenFromCookies, verifyToken } from "./auth.js";

export interface Context {
  userId: number | null;
  req: Request;
  res: Response;
}

export function createContext({ req, res }: { req: Request; res: Response }): Context {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = getTokenFromCookies(req.cookies as Record<string, string>);
  const token = bearerToken ?? cookieToken;
  const payload = token ? verifyToken(token) : null;
  return {
    userId: payload?.userId ?? null,
    req,
    res,
  };
}
