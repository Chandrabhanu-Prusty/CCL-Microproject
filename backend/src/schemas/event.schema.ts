import { z } from 'zod';

export const eventCategories = ['Technology', 'Workshop', 'Cultural', 'Academic', 'Sports'] as const;

const isoDateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Must be a valid ISO 8601 date string',
});

export const createEventSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(120, 'Title must not exceed 120 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(1, 'Description is required'),
  category: z.enum(eventCategories, {
    errorMap: () => ({ message: 'Category must be one of Technology, Workshop, Cultural, Academic, Sports' }),
  }),
  startAt: isoDateString,
  endAt: isoDateString.optional(),
  venue: z
    .string({ required_error: 'Venue is required' })
    .trim()
    .min(1, 'Venue is required'),
  capacity: z
    .number({ required_error: 'Capacity is required' })
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1'),
  bannerUrl: z
    .string()
    .url('bannerUrl must be a valid URL')
    .optional(),
});

export const updateEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(120, 'Title must not exceed 120 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty')
    .optional(),
  category: z.enum(eventCategories).optional(),
  startAt: isoDateString.optional(),
  endAt: isoDateString.optional(),
  venue: z
    .string()
    .trim()
    .min(1, 'Venue cannot be empty')
    .optional(),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1')
    .optional(),
  bannerUrl: z
    .string()
    .url('bannerUrl must be a valid URL')
    .optional(),
});
