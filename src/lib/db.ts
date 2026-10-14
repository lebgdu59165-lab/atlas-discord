import { PrismaClient } from '@prisma/client';
import {databaseOptions} from './database-options';
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient(databaseOptions(process.env.DATABASE_URL));
if (process.env.NODE_ENV !== 'production') g.prisma = db;
