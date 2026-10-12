import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function publicError(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) return { status: error.status, message: error.message };
  if (error instanceof ZodError) return { status: 400, message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' · ') };
  console.error('Request failure', error instanceof Error ? error.name : 'UnknownError');
  return { status: 503, message: 'Service indisponible. Vérifiez les services et les journaux techniques.' };
}
