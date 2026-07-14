import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'password123';

/** Levanta la app igual que main.ts y deja la DB de test limpia. */
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const prisma = app.get(PrismaService);
  // Todas las tablas referencian tenants -> CASCADE las limpia todas.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE tenants CASCADE');

  return { app, prisma };
}

export interface Session {
  token: string;
  tenantId: string;
  userId: string;
}

/** Registra un tenant nuevo y devuelve la sesion de su owner. */
export async function registerTenant(
  app: INestApplication,
  email: string,
  tenantName = 'Tenant Test',
): Promise<Session> {
  const res = await request(app.getHttpServer())
    .post('/api/identity/register')
    .send({ tenantName, email, password: PASSWORD })
    .expect(201);

  return {
    token: res.body.accessToken,
    tenantId: res.body.user.tenantId,
    userId: res.body.user.id,
  };
}

/** Crea un miembro con rol staff en el tenant del owner y devuelve su token. */
export async function createStaff(
  app: INestApplication,
  ownerToken: string,
  email: string,
): Promise<string> {
  await request(app.getHttpServer())
    .post('/api/identity/members')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email, password: PASSWORD, role: 'staff' })
    .expect(201);

  const login = await request(app.getHttpServer())
    .post('/api/identity/login')
    .send({ email, password: PASSWORD })
    .expect(200);

  return login.body.accessToken;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
