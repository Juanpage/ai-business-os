import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, createTestApp, PASSWORD, registerTenant, type Session } from './helpers';

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;
let tenant: Session;

const server = () => app.getHttpServer();

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await prisma.$executeRawUnsafe('TRUNCATE TABLE plans CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE platform_admins CASCADE');

  // Admin de plataforma (no pertenece a ningun tenant).
  await prisma.platformAdmin.create({
    data: { email: 'admin@platform.com', passwordHash: await bcrypt.hash(PASSWORD, 10) },
  });

  // Un tenant con owner (para probar aislamiento y aparecer en la lista).
  tenant = await registerTenant(app, 'admin-tenant@test.com', 'Bar de Prueba');
});

afterAll(async () => {
  await app.close();
});

async function loginAdmin(): Promise<string> {
  const res = await request(server())
    .post('/api/admin/auth/login')
    .send({ email: 'admin@platform.com', password: PASSWORD })
    .expect(200);
  return res.body.accessToken;
}

describe('Admin auth', () => {
  it('login correcto -> token; password incorrecta -> 401', async () => {
    adminToken = await loginAdmin();
    expect(adminToken).toBeDefined();

    await request(server())
      .post('/api/admin/auth/login')
      .send({ email: 'admin@platform.com', password: 'wrongpass' })
      .expect(401);
  });
});

describe('Aislamiento plataforma <-> tenant', () => {
  it('un token de TENANT no sirve para /api/admin (401)', async () => {
    await request(server()).get('/api/admin/tenants').set(auth(tenant.token)).expect(401);
  });

  it('un token de PLATAFORMA no sirve para rutas de tenant (401)', async () => {
    await request(server()).get('/api/venues').set(auth(adminToken)).expect(401);
  });

  it('sin token -> 401', async () => {
    await request(server()).get('/api/admin/tenants').expect(401);
  });
});

describe('Admin tenants', () => {
  it('lista todos los tenants (cross-tenant) con conteos', async () => {
    const res = await request(server()).get('/api/admin/tenants').set(auth(adminToken)).expect(200);

    const found = res.body.find((t: { name: string }) => t.name === 'Bar de Prueba');
    expect(found).toBeDefined();
    expect(found.users).toBeGreaterThanOrEqual(1);
    expect(typeof found.venues).toBe('number');
  });

  it('suspende y reactiva un tenant', async () => {
    const suspended = await request(server())
      .patch(`/api/admin/tenants/${tenant.tenantId}`)
      .set(auth(adminToken))
      .send({ status: 'suspended' })
      .expect(200);
    expect(suspended.body.status).toBe('suspended');

    await request(server())
      .patch(`/api/admin/tenants/${tenant.tenantId}`)
      .set(auth(adminToken))
      .send({ status: 'active' })
      .expect(200);
  });
});

describe('Admin plans (CRUD)', () => {
  let planId: string;

  it('crea un plan; codigo duplicado -> 409', async () => {
    const created = await request(server())
      .post('/api/admin/plans')
      .set(auth(adminToken))
      .send({ name: 'Starter', code: 'starter', price: 19, maxVenues: 2, trialDays: 7 })
      .expect(201);
    planId = created.body.id;
    expect(Number(created.body.price)).toBe(19);

    await request(server())
      .post('/api/admin/plans')
      .set(auth(adminToken))
      .send({ name: 'Otro', code: 'starter', price: 5 })
      .expect(409);
  });

  it('valida code (solo minusculas/numeros/guiones) y precio (400)', async () => {
    await request(server())
      .post('/api/admin/plans')
      .set(auth(adminToken))
      .send({ name: 'Malo', code: 'Con Espacios', price: 10 })
      .expect(400);

    await request(server())
      .post('/api/admin/plans')
      .set(auth(adminToken))
      .send({ name: 'Malo', code: 'neg', price: -5 })
      .expect(400);
  });

  it('actualiza el plan y luego lo elimina', async () => {
    const updated = await request(server())
      .patch(`/api/admin/plans/${planId}`)
      .set(auth(adminToken))
      .send({ price: 29, maxVenues: 3 })
      .expect(200);
    expect(Number(updated.body.price)).toBe(29);
    expect(updated.body.maxVenues).toBe(3);

    await request(server()).delete(`/api/admin/plans/${planId}`).set(auth(adminToken)).expect(204);
  });

  it('no permite borrar un plan con suscripciones vigentes (409)', async () => {
    const plan = await request(server())
      .post('/api/admin/plans')
      .set(auth(adminToken))
      .send({ name: 'Con Subs', code: 'con-subs', price: 9, maxVenues: 1 })
      .expect(201);

    // El tenant se suscribe a ese plan.
    await request(server())
      .post('/api/subscriptions')
      .set(auth(tenant.token))
      .send({ planId: plan.body.id })
      .expect(201);

    await request(server())
      .delete(`/api/admin/plans/${plan.body.id}`)
      .set(auth(adminToken))
      .expect(409);
  });
});

describe('Admin metrics', () => {
  it('devuelve tenants, suscripciones por estado y MRR', async () => {
    const res = await request(server()).get('/api/admin/metrics').set(auth(adminToken)).expect(200);

    expect(res.body.tenants.total).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.mrr).toBe('number');
    expect(res.body.subscriptionsByStatus).toBeDefined();
  });
});
