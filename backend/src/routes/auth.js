import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signUserToken, requireAuth } from "../lib/auth.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Pleasant, distinct avatar colors we assign round-robin on signup.
const AVATAR_COLORS = ["#FF6B4A", "#3DDC97", "#7C9CFF", "#F4C95D", "#E56B9F"];

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const user = await prisma.user.create({
    data: { name, email, passwordHash, avatarColor },
  });

  const token = signUserToken(user);
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor },
  });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signUserToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor },
  });
});

// Returns the currently logged-in user's profile - handy for the frontend to
// verify a stored token is still valid on app load.
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor });
});

export default router;