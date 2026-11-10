import { z } from 'zod'

export function textField(max: number) {
  return z
    .string()
    .trim()
    .min(1, 'Preencha este campo.')
    .max(max, `Use até ${max} caracteres.`)
    .refine((value) => !value.includes(String.fromCharCode(0)), 'Remova caracteres inválidos.')
}

export const credentialsSchema = z.object({
  email: z.email('Informe um e-mail válido.').max(254),
  password: z.string().min(1, 'Informe sua senha.').max(72),
})

export const registrationSchema = credentialsSchema.extend({
  name: textField(100),
  email: credentialsSchema.shape.email.regex(/^[!-~]+$/, 'Use um e-mail com caracteres ASCII.'),
  password: z
    .string()
    .min(12, 'Use pelo menos 12 caracteres.')
    .max(72)
    .refine((value) => new TextEncoder().encode(value).length <= 72, 'Use até 72 bytes na senha.'),
})
