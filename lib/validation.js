import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
})

export const symbolSchema = z.string().min(1).max(20).regex(/^[A-Z0-9/]+$/i, 'Invalid symbol format')

export const assetTypeSchema = z.enum(['crypto', 'stock', 'forex', 'index'])

export const positionSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  quantity: z.number().positive('Quantity must be positive'),
  entryPrice: z.number().positive('Entry price must be positive'),
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
})

export function validateInput(schema, data) {
  try {
    return { success: true, data: schema.parse(data) }
  } catch (error) {
    return { 
      success: false, 
      error: error.errors?.[0]?.message || 'Validation failed' 
    }
  }
}
