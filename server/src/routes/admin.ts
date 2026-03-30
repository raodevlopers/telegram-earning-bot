import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../middlewares/async-handler.js";
import { createRequireAdmin } from "../middlewares/require-admin.js";
import type { AppServices } from "../types/app-services.js";
import { AppError } from "../utils/errors.js";

const loginSchema = z.object({
  password: z.string().min(1)
});

const taskImageSchema = z.object({
  url: z.string().url(),
  displayUrl: z.string().url(),
  deleteUrl: z.string().url().nullable(),
  filename: z.string().nullable()
});

const baseTaskSchema = z.object({
  taskType: z.enum(["maps_review", "site_wait", "search_visit"]),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1000),
  link: z.string().url(),
  caption: z.string().max(2000).optional().nullable(),
  galleryImages: z.array(taskImageSchema).max(6).optional(),
  timerSeconds: z.number().int().positive().max(600).optional(),
  proofRequired: z.boolean().optional(),
  rewardPaise: z.number().int().positive().optional(),
  status: z.enum(["active", "paused"]).optional()
});

const taskSchema = baseTaskSchema
  .superRefine((value, ctx) => {
    if (value.taskType === "maps_review") {
      if (!value.caption?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Maps review tasks require a caption or review text.",
          path: ["caption"]
        });
      }

      if (!value.galleryImages?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Maps review tasks require at least one reference image.",
          path: ["galleryImages"]
        });
      }
    }
  });

const updateTaskSchema = baseTaskSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one task field must be provided."
});

const withdrawalReviewSchema = z.object({
  adminNote: z.string().max(300).optional().nullable()
});

const imageUploadSchema = z.object({
  imageData: z.string().min(20),
  fileName: z.string().max(120).optional()
});

const balanceAdjustSchema = z.object({
  amountPaise: z.number().int().refine((value) => value !== 0, {
    message: "Adjustment amount cannot be zero."
  }),
  note: z.string().trim().min(3).max(160)
});

export function createAdminRouter(services: AppServices) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.post(
    "/login",
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { password } = loginSchema.parse(req.body);
      const valid = await bcrypt.compare(password, services.config.admin.passwordHash);

      if (!valid) {
        throw new AppError(401, "invalid_credentials", "Incorrect admin password.");
      }

      req.session = {
        authenticated: true
      };

      res.json({ authenticated: true });
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (req, res) => {
      req.session = null;
      res.json({ authenticated: false });
    })
  );

  router.get(
    "/session",
    asyncHandler(async (req, res) => {
      res.json({
        authenticated: Boolean(req.session?.authenticated)
      });
    })
  );

  router.use(createRequireAdmin(services.config));

  router.get(
    "/overview",
    asyncHandler(async (_req, res) => {
      res.json(await services.adminService.getOverview());
    })
  );

  router.get(
    "/users",
    asyncHandler(async (_req, res) => {
      res.json({ users: await services.adminService.listUsers() });
    })
  );

  router.get(
    "/users/:id",
    asyncHandler(async (req, res) => {
      const userId = String(req.params.id);
      res.json(await services.adminService.getUserDetail(userId));
    })
  );

  router.post(
    "/users/:id/balance",
    asyncHandler(async (req, res) => {
      const userId = String(req.params.id);
      const input = balanceAdjustSchema.parse(req.body);
      const user = await services.adminService.adjustUserBalance({
        userId,
        amountPaise: input.amountPaise,
        note: input.note,
        adminEmail: req.adminUser?.email ?? "admin"
      });
      services.adminService.logAdminAction("user.balance.adjust", { userId, amountPaise: input.amountPaise });
      res.json({ user });
    })
  );

  router.get(
    "/tasks",
    asyncHandler(async (_req, res) => {
      res.json({ tasks: await services.adminService.listTasks() });
    })
  );

  router.get(
    "/completions",
    asyncHandler(async (_req, res) => {
      res.json({ completions: await services.adminService.listCompletedTasks() });
    })
  );

  router.post(
    "/uploads/image",
    asyncHandler(async (req, res) => {
      const input = imageUploadSchema.parse(req.body);
      const image = await services.imageHostingService.uploadBase64Image(input.imageData, input.fileName);
      res.status(201).json({ image });
    })
  );

  router.post(
    "/tasks",
    asyncHandler(async (req, res) => {
      const input = taskSchema.parse(req.body);
      const task = await services.taskService.createTask(input);
      services.adminService.logAdminAction("task.create", { taskId: task.id });
      res.status(201).json({ task });
    })
  );

  router.patch(
    "/tasks/:id",
    asyncHandler(async (req, res) => {
      const input = updateTaskSchema.parse(req.body);
      const taskId = String(req.params.id);
      const task = await services.taskService.updateTask(taskId, input);
      services.adminService.logAdminAction("task.update", { taskId: task.id });
      res.json({ task });
    })
  );

  router.delete(
    "/tasks/:id",
    asyncHandler(async (req, res) => {
      const taskId = String(req.params.id);
      await services.taskService.deleteTask(taskId);
      services.adminService.logAdminAction("task.delete", { taskId });
      res.json({ ok: true });
    })
  );

  router.get(
    "/withdrawals",
    asyncHandler(async (_req, res) => {
      res.json({ withdrawals: await services.adminService.listWithdrawals() });
    })
  );

  router.post(
    "/withdrawals/:id/approve",
    asyncHandler(async (req, res) => {
      const input = withdrawalReviewSchema.parse(req.body);
      const withdrawalId = String(req.params.id);
      const withdrawal = await services.withdrawalService.approveWithdrawal(
        withdrawalId,
        req.adminUser?.email ?? "admin",
        input.adminNote ?? null
      );
      services.adminService.logAdminAction("withdrawal.approve", { withdrawalId: withdrawal.id });
      res.json({ withdrawal });
    })
  );

  router.post(
    "/withdrawals/:id/reject",
    asyncHandler(async (req, res) => {
      const input = withdrawalReviewSchema.parse(req.body);
      const withdrawalId = String(req.params.id);
      const withdrawal = await services.withdrawalService.rejectWithdrawal(
        withdrawalId,
        req.adminUser?.email ?? "admin",
        input.adminNote ?? null
      );
      services.adminService.logAdminAction("withdrawal.reject", { withdrawalId: withdrawal.id });
      res.json({ withdrawal });
    })
  );

  router.get(
    "/referrals",
    asyncHandler(async (_req, res) => {
      res.json({ referrals: await services.adminService.listReferralInsights() });
    })
  );

  return router;
}
