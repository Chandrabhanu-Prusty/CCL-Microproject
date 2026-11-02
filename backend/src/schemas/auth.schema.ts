import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must not exceed 254 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .refine(
      (val) => /[0-9\W_]/.test(val),
      'Password must contain at least one number or special character'
    )
    .refine(
      (val) => Buffer.byteLength(val, 'utf8') <= 72,
      'Password must not exceed 72 bytes (bcrypt input limit)'
    ),
  // Role is explicitly stripped or ignored if passed
  role: z.unknown().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .refine(
      (val) => Buffer.byteLength(val, 'utf8') <= 72,
      'Password must not exceed 72 bytes (bcrypt input limit)'
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const bootstrapSchema = z.object({
  email: z
    .string({ required_error: 'Target email is required' })
    .trim()
    .email('Invalid email address'),
  secret: z
    .string({ required_error: 'Bootstrap secret is required' })
    .min(1, 'Bootstrap secret is required'),
});

export type BootstrapInput = z.infer<typeof bootstrapSchema>;
