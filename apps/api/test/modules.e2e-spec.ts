import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { auth, createStaff, createTestApp, registerTenant, type Session } from './helpers';

let app: INestApplication;
let owner: Session;
let staffToken: string;
let venueA: string;
let venueB: string;

const server = () => app.getHttpServer();

beforeAll(async () => {
  ({ app } = await createTestApp());
  owner = await registerTenant(app, 'ops-owner@test.com');
  staffToken = await createStaff(app, owner.token, 'ops-staff@test.com');

  // Dos locales del mismo tenant (para probar validaciones cruzadas venue<->mesa).
  const a = await request(server())
    .post('/api/venues')
    .set(auth(owner.token))
    .send({ name: 'Sede A', taxRate: 15 })
    .expect(201);
  const b = await request(server())
    .post('/api/venues')
    .set(auth(owner.token))
    .send({ name: 'Sede B' })
    .expect(201);
  venueA = a.body.id;
  venueB = b.body.id;
});

afterAll(async () => {
  await app.close();
});

describe('Tables', () => {
  it('owner crea mesa; staff NO puede crear (403) pero SI cambia estado (operativo)', async () => {
    const created = await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'A-01', venueId: venueA })
      .expect(201);
    expect(created.body.status).toBe('available');

    // Estructural: staff no crea mesas.
    await request(server())
      .post('/api/tables')
      .set(auth(staffToken))
      .send({ code: 'A-02', venueId: venueA })
      .expect(403);

    // Operativo: staff si cambia el estado.
    const patched = await request(server())
      .patch(`/api/tables/${created.body.id}`)
      .set(auth(staffToken))
      .send({ status: 'occupied' })
      .expect(200);
    expect(patched.body.status).toBe('occupied');
  });

  it('no permite crear mesa en un venue de otro tenant (404)', async () => {
    const other = await registerTenant(app, 'ops-other@test.com');
    await request(server())
      .post('/api/tables')
      .set(auth(other.token))
      .send({ code: 'X-01', venueId: venueA })
      .expect(404);
  });
});

describe('Customers', () => {
  it('staff crea cliente (operativo) pero NO lo borra (403); owner si borra', async () => {
    const created = await request(server())
      .post('/api/customers')
      .set(auth(staffToken))
      .send({ fullName: 'Cliente Test', phone: '0999999999' })
      .expect(201);

    await request(server())
      .delete(`/api/customers/${created.body.id}`)
      .set(auth(staffToken))
      .expect(403);

    await request(server())
      .delete(`/api/customers/${created.body.id}`)
      .set(auth(owner.token))
      .expect(204);
  });

  it('valida fullName obligatorio y email valido (400)', async () => {
    await request(server())
      .post('/api/customers')
      .set(auth(owner.token))
      .send({ email: 'x@test.com' })
      .expect(400);

    await request(server())
      .post('/api/customers')
      .set(auth(owner.token))
      .send({ fullName: 'Ana', email: 'no-es-email' })
      .expect(400);
  });
});

describe('Reservations', () => {
  it('rechaza una mesa que no pertenece al venue de la reserva (404)', async () => {
    const tableB = await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'B-01', venueId: venueB })
      .expect(201);

    // Reserva en venue A con mesa de venue B -> no permitido.
    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId: venueA,
        reservedAt: '2026-09-01T21:00:00.000Z',
        partySize: 2,
        tableId: tableB.body.id,
      })
      .expect(404);
  });

  it('crea reserva valida y el staff la confirma; filtra por status', async () => {
    const created = await request(server())
      .post('/api/reservations')
      .set(auth(staffToken))
      .send({ venueId: venueA, reservedAt: '2026-09-01T21:00:00.000Z', partySize: 4 })
      .expect(201);
    expect(created.body.status).toBe('pending');

    const confirmed = await request(server())
      .patch(`/api/reservations/${created.body.id}`)
      .set(auth(staffToken))
      .send({ status: 'confirmed' })
      .expect(200);
    expect(confirmed.body.status).toBe('confirmed');

    const list = await request(server())
      .get('/api/reservations?status=confirmed')
      .set(auth(owner.token))
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('valida partySize >= 1 y fecha (400)', async () => {
    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({ venueId: venueA, reservedAt: '2026-09-01T21:00:00.000Z', partySize: 0 })
      .expect(400);

    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({ venueId: venueA, reservedAt: 'no-es-fecha', partySize: 2 })
      .expect(400);
  });
});

describe('Events', () => {
  it('owner crea evento multiidioma y lo publica; staff NO crea (403) pero SI lee', async () => {
    const created = await request(server())
      .post('/api/events')
      .set(auth(owner.token))
      .send({
        venueId: venueA,
        name: { es: 'Noche Latina', en: 'Latin Night' },
        startsAt: '2026-10-01T22:00:00.000Z',
        capacity: 100,
        coverPrice: 10,
      })
      .expect(201);
    expect(created.body.name.en).toBe('Latin Night');
    expect(created.body.status).toBe('draft');

    const published = await request(server())
      .patch(`/api/events/${created.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'published' })
      .expect(200);
    expect(published.body.status).toBe('published');

    // Config: el staff no crea eventos, pero puede leerlos.
    await request(server())
      .post('/api/events')
      .set(auth(staffToken))
      .send({ venueId: venueA, name: { es: 'X' }, startsAt: '2026-10-01T22:00:00.000Z' })
      .expect(403);

    await request(server()).get('/api/events').set(auth(staffToken)).expect(200);
  });

  it('valida name multiidioma y startsAt obligatorio (400)', async () => {
    // name como string plano (no multiidioma).
    await request(server())
      .post('/api/events')
      .set(auth(owner.token))
      .send({ venueId: venueA, name: 'texto plano', startsAt: '2026-10-01T22:00:00.000Z' })
      .expect(400);

    // sin startsAt.
    await request(server())
      .post('/api/events')
      .set(auth(owner.token))
      .send({ venueId: venueA, name: { es: 'Sin fecha' } })
      .expect(400);
  });
});

describe('Promotions', () => {
  it('crea promo porcentual y fija; rechaza porcentaje > 100 (400)', async () => {
    const pct = await request(server())
      .post('/api/promotions')
      .set(auth(owner.token))
      .send({ name: { es: '20% off' }, discountType: 'percentage', discountValue: 20 })
      .expect(201);
    expect(pct.body.status).toBe('draft');

    await request(server())
      .post('/api/promotions')
      .set(auth(owner.token))
      .send({ name: { es: '5 off' }, discountType: 'fixed', discountValue: 5 })
      .expect(201);

    // Un descuento porcentual no puede superar 100.
    await request(server())
      .post('/api/promotions')
      .set(auth(owner.token))
      .send({ name: { es: 'Bug' }, discountType: 'percentage', discountValue: 150 })
      .expect(400);
  });

  it('activa la promo y filtra por status=active', async () => {
    const promo = await request(server())
      .post('/api/promotions')
      .set(auth(owner.token))
      .send({ name: { es: 'Happy Hour' }, discountType: 'percentage', discountValue: 10 })
      .expect(201);

    await request(server())
      .patch(`/api/promotions/${promo.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'active' })
      .expect(200);

    const active = await request(server())
      .get('/api/promotions?status=active')
      .set(auth(owner.token))
      .expect(200);
    expect(active.body).toHaveLength(1);
    expect(active.body[0].name.es).toBe('Happy Hour');
  });
});

describe('Aislamiento entre tenants (modulos operativos)', () => {
  it('otro tenant no ve mesas, clientes, reservas, eventos ni promos', async () => {
    const other = await registerTenant(app, 'ops-isolated@test.com');
    const h = auth(other.token);

    for (const path of [
      '/api/tables',
      '/api/customers',
      '/api/reservations',
      '/api/events',
      '/api/promotions',
    ]) {
      const res = await request(server()).get(path).set(h).expect(200);
      expect(res.body).toHaveLength(0);
    }
  });
});
