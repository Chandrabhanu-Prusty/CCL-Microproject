import { z } from 'zod';

export const assignStaffSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
});

export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
