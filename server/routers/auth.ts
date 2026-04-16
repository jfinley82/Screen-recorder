import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import type { Context } from "../context.js";
import { db } from "../db.js";
import { users } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from "../auth.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const authRouter = router({
  /** Register a new user */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if email already taken
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const [result] = await db.insert(users).values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
      });

      const userId = result.insertId;
      const token = signToken({ userId, email: input.email.toLowerCase() });
      setAuthCookie(ctx.res, token);

      return { id: userId, name: input.name, email: input.email.toLowerCase() };
    }),

  /** Login */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const valid = await comparePassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const token = signToken({ userId: user.id, email: user.email });
      setAuthCookie(ctx.res, token);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        token,
      };
    }),

  /** Logout */
  logout: publicProcedure.mutation(({ ctx }) => {
    clearAuthCookie(ctx.res);
    return { ok: true };
  }),

  /** Get current user */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        businessName: users.businessName,
        website: users.website,
        twitterUrl: users.twitterUrl,
        linkedinUrl: users.linkedinUrl,
        youtubeUrl: users.youtubeUrl,
        instagramUrl: users.instagramUrl,
        brandColor: users.brandColor,
      })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    return user ?? null;
  }),

  /** Update profile */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      avatarUrl: z.string().url().optional().nullable(),
      businessName: z.string().max(255).optional().nullable(),
      website: z.string().max(512).optional().nullable(),
      twitterUrl: z.string().max(512).optional().nullable(),
      linkedinUrl: z.string().max(512).optional().nullable(),
      youtubeUrl: z.string().max(512).optional().nullable(),
      instagramUrl: z.string().max(512).optional().nullable(),
      brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
      if (input.businessName !== undefined) updates.businessName = input.businessName;
      if (input.website !== undefined) updates.website = input.website;
      if (input.twitterUrl !== undefined) updates.twitterUrl = input.twitterUrl;
      if (input.linkedinUrl !== undefined) updates.linkedinUrl = input.linkedinUrl;
      if (input.youtubeUrl !== undefined) updates.youtubeUrl = input.youtubeUrl;
      if (input.instagramUrl !== undefined) updates.instagramUrl = input.instagramUrl;
      if (input.brandColor !== undefined) updates.brandColor = input.brandColor;
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, ctx.userId));
      }
      return { ok: true };
    }),

  /** Change password */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await comparePassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.userId));
      return { ok: true };
    }),
});
