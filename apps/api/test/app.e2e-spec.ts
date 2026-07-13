import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

// Bootstrap identico a main.ts (prefijo global + ValidationPipe).
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  prisma = app.get(PrismaService);
  // Limpia la DB de test (todas las tablas referencian tenants -> CASCADE).
  await prisma.$executeRawUnsafe('TRUNCATE TABLE tenants CASCADE');
});

afterAll(async () => {
  await app.close();
});

const server = () => app.getHttpServer();

async function registerTenant(email: string, tenantName = 'Tenant Test') {
  const res = await request(server())
    .post('/api/identity/register')
    .send({ tenantName, email, password: 'password123' })
    .expect(201);
  return res.body as { accessToken: string; user: { id: string; tenantId: string } };
}

describe('Health', () => {
  it('GET /health -> 200 ok', async () => {
    const res = await request(server()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth (identity)', () => {
  it('register devuelve token y usuario', async () => {
    const body = await registerTenant('auth1@test.com');
    expect(body.accessToken).toBeDefined();
    expect(body.user.tenantId).toBeDefined();
  });

  it('login correcto -> 200; password incorrecta -> 401', async () => {
    await registerTenant('auth2@test.com');
    await request(server())
      .post('/api/identity/login')
      .send({ email: 'auth2@test.com', password: 'password123' })
      .expect(200);
    await request(server())
      .post('/api/identity/login')
      .send({ email: 'auth2@test.com', password: 'wrongpass' })
      .expect(401);
  });

  it('/me sin token -> 401; con token -> 200', async () => {
    const { accessToken } = await registerTenant('auth3@test.com');
    await request(server()).get('/api/identity/me').expect(401);
    const res = await request(server())
      .get('/api/identity/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.tenant.tenantId).toBeDefined();
  });
});

describe('Aislamiento multi-tenant', () => {
  it('un tenant no ve los venues de otro (404)', async () => {
    const a = await registerTenant('iso-a@test.com');
    const b = await registerTenant('iso-b@test.com');

    const venue = await request(server())
      .post('/api/venues')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ name: 'Local A' })
      .expect(201);

    // B no ve el venue de A
    await request(server())
      .get(`/api/venues/${venue.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // B lista y no aparece
    const listB = await request(server())
      .get('/api/venues')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(200);
    expect(listB.body).toHaveLength(0);
  });
});

describe('Autorizacion por rol', () => {
  it('staff no crea venue (403); owner si (201)', async () => {
    const owner = await registerTenant('rol-o@test.com');
    await request(server())
      .post('/api/identity/members')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'rol-s@test.com', password: 'password123', role: 'staff' })
      .expect(201);
    const staffLogin = await request(server())
      .post('/api/identity/login')
      .send({ email: 'rol-s@test.com', password: 'password123' })
      .expect(200);
    const staffToken = staffLogin.body.accessToken;

    await request(server())
      .post('/api/venues')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'No permitido' })
      .expect(403);

    await request(server())
      .post('/api/venues')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Permitido' })
      .expect(201);
  });
});

describe('Ventas: totales, IVA y pagos', () => {
  it('orden con IVA 15%, snapshot y auto-paid', async () => {
    const { accessToken } = await registerTenant('venta@test.com');
    const auth = { Authorization: `Bearer ${accessToken}` };

    const venue = await request(server())
      .post('/api/venues')
      .set(auth)
      .send({ name: 'Bar Ventas', taxRate: 15 })
      .expect(201);

    const product = await request(server())
      .post('/api/products')
      .set(auth)
      .send({ name: { es: 'Cerveza' }, price: 2.5 })
      .expect(201);

    const order = await request(server())
      .post('/api/orders')
      .set(auth)
      .send({ venueId: venue.body.id })
      .expect(201);
    const orderId = order.body.id;

    // 4 x 2.50 = 10.00; IVA 15% = 1.50; total = 11.50
    const withItem = await request(server())
      .post(`/api/orders/${orderId}/items`)
      .set(auth)
      .send({ productId: product.body.id, quantity: 4 })
      .expect(201);

    expect(Number(withItem.body.subtotal)).toBe(10);
    expect(Number(withItem.body.taxTotal)).toBe(1.5);
    expect(Number(withItem.body.total)).toBe(11.5);
    // Snapshot de precio y nombre
    expect(withItem.body.items[0].productName.es).toBe('Cerveza');
    expect(Number(withItem.body.items[0].unitPrice)).toBe(2.5);

    // Pago total -> auto-transicion a paid
    const paid = await request(server())
      .post(`/api/orders/${orderId}/payments`)
      .set(auth)
      .send({ method: 'cash', amount: 11.5 })
      .expect(201);
    expect(paid.body.status).toBe('paid');

    // Orden pagada ya no es editable
    await request(server())
      .post(`/api/orders/${orderId}/items`)
      .set(auth)
      .send({ productId: product.body.id, quantity: 1 })
      .expect(409);
  });
});
