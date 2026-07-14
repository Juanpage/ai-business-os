import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { auth, createStaff, createTestApp, registerTenant, type Session } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;
let owner: Session;
let staffToken: string;

// Planes de plataforma (globales, no de un tenant).
let freePlanId: string; // 1 local, sin trial
let proPlanId: string; // 5 locales, 14 dias de trial

const server = () => app.getHttpServer();

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());

  // TRUNCATE tenants CASCADE no borra plans (no referencian tenants): limpiamos aparte.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE plans CASCADE');

  const free = await prisma.plan.create({
    data: { code: 'test-free', name: 'Free', price: 0, maxVenues: 1, trialDays: 0 },
  });
  const pro = await prisma.plan.create({
    data: { code: 'test-pro', name: 'Pro', price: 49, maxVenues: 5, trialDays: 14 },
  });
  freePlanId = free.id;
  proPlanId = pro.id;

  owner = await registerTenant(app, 'billing-owner@test.com');
  staffToken = await createStaff(app, owner.token, 'billing-staff@test.com');
});

afterAll(async () => {
  await app.close();
});

describe('Plans (solo lectura)', () => {
  it('lista los planes activos de la plataforma', async () => {
    const res = await request(server()).get('/api/plans').set(auth(owner.token)).expect(200);
    expect(res.body).toHaveLength(2);
    // Ordenados por precio ascendente.
    expect(res.body[0].code).toBe('test-free');
    expect(Number(res.body[1].price)).toBe(49);
  });

  it('sin token -> 401', async () => {
    await request(server()).get('/api/plans').expect(401);
  });
});

describe('Subscriptions', () => {
  it('sin suscripcion -> /me devuelve 404', async () => {
    await request(server()).get('/api/subscriptions/me').set(auth(owner.token)).expect(404);
  });

  it('el staff NO puede suscribir (403); el owner si', async () => {
    await request(server())
      .post('/api/subscriptions')
      .set(auth(staffToken))
      .send({ planId: freePlanId })
      .expect(403);

    const res = await request(server())
      .post('/api/subscriptions')
      .set(auth(owner.token))
      .send({ planId: freePlanId })
      .expect(201);

    // Free no tiene trial -> arranca activa.
    expect(res.body.status).toBe('active');
    expect(res.body.trialEndsAt).toBeNull();
    expect(res.body.plan.code).toBe('test-free');
    expect(new Date(res.body.currentPeriodEnd).getTime()).toBeGreaterThan(
      new Date(res.body.currentPeriodStart).getTime(),
    );
  });

  it('cambiar a un plan con trial deja la suscripcion en trialing y cierra la anterior', async () => {
    const res = await request(server())
      .post('/api/subscriptions')
      .set(auth(owner.token))
      .send({ planId: proPlanId })
      .expect(201);

    expect(res.body.status).toBe('trialing');
    expect(res.body.trialEndsAt).not.toBeNull();
    expect(res.body.plan.code).toBe('test-pro');

    // /me devuelve la vigente (la nueva).
    const me = await request(server())
      .get('/api/subscriptions/me')
      .set(auth(owner.token))
      .expect(200);
    expect(me.body.plan.code).toBe('test-pro');

    // Solo puede haber una vigente: la anterior quedo cancelada.
    const live = await prisma.subscription.count({
      where: {
        tenantId: owner.tenantId,
        status: { in: ['trialing', 'active', 'past_due'] },
      },
    });
    expect(live).toBe(1);
  });

  it('cancelar deja la suscripcion en cancelled; cancelar de nuevo -> 409', async () => {
    const cancelled = await request(server())
      .post('/api/subscriptions/me/cancel')
      .set(auth(owner.token))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.cancelledAt).not.toBeNull();

    await request(server()).post('/api/subscriptions/me/cancel').set(auth(owner.token)).expect(409);
  });

  it('plan inexistente -> 404', async () => {
    await request(server())
      .post('/api/subscriptions')
      .set(auth(owner.token))
      .send({ planId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });
});

describe('Limite de locales del plan (cuota)', () => {
  it('el plan Free (1 local) bloquea el segundo venue con 409', async () => {
    const t = await registerTenant(app, 'quota@test.com');

    await request(server())
      .post('/api/subscriptions')
      .set(auth(t.token))
      .send({ planId: freePlanId })
      .expect(201);

    // Primer local: permitido.
    await request(server())
      .post('/api/venues')
      .set(auth(t.token))
      .send({ name: 'Local 1' })
      .expect(201);

    // Segundo: supera el limite del plan Free.
    const blocked = await request(server())
      .post('/api/venues')
      .set(auth(t.token))
      .send({ name: 'Local 2' })
      .expect(409);
    expect(blocked.body.message).toContain('Free');

    // Al pasar a Pro (5 locales) ya puede crearlo.
    await request(server())
      .post('/api/subscriptions')
      .set(auth(t.token))
      .send({ planId: proPlanId })
      .expect(201);

    await request(server())
      .post('/api/venues')
      .set(auth(t.token))
      .send({ name: 'Local 2' })
      .expect(201);
  });

  it('sin suscripcion no se aplica limite (no rompe los flujos existentes)', async () => {
    const t = await registerTenant(app, 'noplan@test.com');
    for (const name of ['Local A', 'Local B', 'Local C']) {
      await request(server()).post('/api/venues').set(auth(t.token)).send({ name }).expect(201);
    }
  });
});
