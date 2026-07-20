import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { auth, createTestApp, registerTenant, type Session } from './helpers';

let app: INestApplication;
let owner: Session;
let venueId: string;

const server = () => app.getHttpServer();

beforeAll(async () => {
  ({ app } = await createTestApp());
  owner = await registerTenant(app, 'hardening-owner@test.com');

  const venue = await request(server())
    .post('/api/venues')
    .set(auth(owner.token))
    .send({ name: 'Hardening Venue' })
    .expect(201);
  venueId = venue.body.id;

  await request(server())
    .post('/api/products')
    .set(auth(owner.token))
    .send({ name: { es: 'Producto Test' }, price: 5 })
    .expect(201);
});

afterAll(async () => {
  await app.close();
});

describe('Maquina de estados: Reservation', () => {
  it('pending -> confirmed -> seated -> completed (valido)', async () => {
    const r = await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({ venueId, reservedAt: '2026-11-01T20:00:00.000Z', partySize: 2 })
      .expect(201);

    await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'confirmed' })
      .expect(200);
    await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'seated' })
      .expect(200);
    const done = await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'completed' })
      .expect(200);
    expect(done.body.status).toBe('completed');
  });

  it('rechaza saltos invalidos: pending -> seated, y completed -> pending (400)', async () => {
    const r = await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({ venueId, reservedAt: '2026-11-02T20:00:00.000Z', partySize: 2 })
      .expect(201);

    await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'seated' })
      .expect(400);

    await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'cancelled' })
      .expect(200);

    // cancelled es terminal: no admite mas transiciones.
    await request(server())
      .patch(`/api/reservations/${r.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'pending' })
      .expect(400);
  });
});

describe('Maquina de estados: Order', () => {
  it('rechaza cancelled -> paid (400)', async () => {
    const order = await request(server())
      .post('/api/orders')
      .set(auth(owner.token))
      .send({ venueId })
      .expect(201);

    await request(server())
      .patch(`/api/orders/${order.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'cancelled' })
      .expect(200);

    await request(server())
      .patch(`/api/orders/${order.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'paid' })
      .expect(400);
  });
});

describe('Maquina de estados: Event', () => {
  it('rechaza finished -> draft (400); permite draft -> published -> finished', async () => {
    const event = await request(server())
      .post('/api/events')
      .set(auth(owner.token))
      .send({ venueId, name: { es: 'Evento' }, startsAt: '2026-12-01T20:00:00.000Z' })
      .expect(201);

    await request(server())
      .patch(`/api/events/${event.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'published' })
      .expect(200);
    await request(server())
      .patch(`/api/events/${event.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'finished' })
      .expect(200);
    await request(server())
      .patch(`/api/events/${event.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'draft' })
      .expect(400);
  });
});

describe('Solapamiento de reservas', () => {
  it('rechaza dos reservas en la misma mesa dentro de 2h (409); fuera de la ventana si', async () => {
    const table = await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'OVERLAP-1', venueId })
      .expect(201);

    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId,
        tableId: table.body.id,
        reservedAt: '2026-11-05T20:00:00.000Z',
        partySize: 2,
      })
      .expect(201);

    // 1h despues, misma mesa: dentro de la ventana de 2h -> conflicto.
    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId,
        tableId: table.body.id,
        reservedAt: '2026-11-05T21:00:00.000Z',
        partySize: 2,
      })
      .expect(409);

    // 3h despues: fuera de la ventana -> permitido.
    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId,
        tableId: table.body.id,
        reservedAt: '2026-11-05T23:00:00.000Z',
        partySize: 2,
      })
      .expect(201);
  });

  it('cancelar una reserva libera la mesa para el mismo horario', async () => {
    const table = await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'OVERLAP-2', venueId })
      .expect(201);

    const first = await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId,
        tableId: table.body.id,
        reservedAt: '2026-11-06T20:00:00.000Z',
        partySize: 2,
      })
      .expect(201);

    await request(server())
      .patch(`/api/reservations/${first.body.id}`)
      .set(auth(owner.token))
      .send({ status: 'cancelled' })
      .expect(200);

    // Ahora la mesa esta libre para el mismo horario.
    await request(server())
      .post('/api/reservations')
      .set(auth(owner.token))
      .send({
        venueId,
        tableId: table.body.id,
        reservedAt: '2026-11-06T20:00:00.000Z',
        partySize: 4,
      })
      .expect(201);
  });
});

describe('Unicidad de codigo de mesa por venue', () => {
  it('rechaza dos mesas con el mismo codigo en el mismo venue (409)', async () => {
    await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'DUP-1', venueId })
      .expect(201);

    await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'DUP-1', venueId })
      .expect(409);
  });

  it('el mismo codigo SI se permite en otro venue', async () => {
    const otherVenue = await request(server())
      .post('/api/venues')
      .set(auth(owner.token))
      .send({ name: 'Otro Venue' })
      .expect(201);

    await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'DUP-1', venueId: otherVenue.body.id })
      .expect(201);
  });

  it('borrar una mesa libera su codigo para una nueva', async () => {
    const table = await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'REUSE-1', venueId })
      .expect(201);

    await request(server())
      .delete(`/api/tables/${table.body.id}`)
      .set(auth(owner.token))
      .expect(204);

    await request(server())
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ code: 'REUSE-1', venueId })
      .expect(201);
  });
});

describe('Paginacion', () => {
  it('GET /products devuelve {data, total, page, pageSize} y respeta pageSize', async () => {
    // Ya existe productId; crea 2 mas para tener al menos 3.
    await request(server())
      .post('/api/products')
      .set(auth(owner.token))
      .send({ name: { es: 'Producto 2' }, price: 3 })
      .expect(201);
    await request(server())
      .post('/api/products')
      .set(auth(owner.token))
      .send({ name: { es: 'Producto 3' }, price: 4 })
      .expect(201);

    const res = await request(server())
      .get('/api/products?pageSize=2&page=1')
      .set(auth(owner.token))
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);

    const page2 = await request(server())
      .get('/api/products?pageSize=2&page=2')
      .set(auth(owner.token))
      .expect(200);
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1);
    // La pagina 2 no repite el primer item de la pagina 1.
    expect(page2.body.data[0].id).not.toBe(res.body.data[0].id);
  });

  it('pageSize > 100 -> 400 (limite del DTO)', async () => {
    await request(server()).get('/api/products?pageSize=500').set(auth(owner.token)).expect(400);
  });

  it('sin parametros usa page=1 pageSize=20 por defecto', async () => {
    const res = await request(server()).get('/api/customers').set(auth(owner.token)).expect(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
