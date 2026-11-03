import { z } from "zod";

export const loginUser = z.object({
  email: z.email().lowercase(),
  password: z
    .string()
    .min(8)
    .max(12)
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/, "Password must contain a special character")
    .refine((password) => !/\s/.test(password), "Password must not contain spaces"),
});
export const signupUser = z.object({
  firstName: z.string().min(2).max(20),
  lastName: z.string().min(2).max(20),
  email: z.email().lowercase(),
  password: z
    .string()
    .min(8)
    .max(12)
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/, "Password must contain a special character")
    .refine((password) => !/\s/.test(password), "Password must not contain spaces"),
});

export const noteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Note cannot be empty")
    .max(5000, "Note is too long"),
  label: z.string().trim().max(24, "Label must be 24 characters or less").optional(),
  color: z.enum([
    "paper-1",
    "paper-2",
    "paper-3",
    "paper-4",
    "paper-5",
    "paper-6",
    "paper-7",
    "paper-8",
    "paper-9",
    "paper-10",
  ]).optional(),
  password: z.string().min(8).max(12).optional(),
});
