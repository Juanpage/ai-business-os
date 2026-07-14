/**
 * Seed demo — AI Business OS (vertical bar/discoteca).
 *
 * Crea un tenant demo COMPLETO y realista. Idempotente: si el tenant demo
 * (slug fijo) ya existe, borra todos sus datos y lo recrea limpio.
 * Solo afecta al tenant "bar-demo"; nunca toca otros tenants.
 *
 * Correr: pnpm --filter @ai-business-os/api prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_SLUG = 'bar-demo';
const DEMO_PASSWORD = 'demo1234';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

async function cleanupDemoTenant(): Promise<void> {
  const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!existing) return;

  const tenantId = existing.id;
  // Borrado en orden de dependencias (hijos antes que padres).
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.orderItem.deleteMany({ where: { tenantId } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.reservation.deleteMany({ where: { tenantId } });
  await prisma.event.deleteMany({ where: { tenantId } });
  await prisma.promotion.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.table.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.aIGenerationLog.deleteMany({ where: { tenantId } });
  await prisma.userVenueRole.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.venue.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  console.log('  (tenant demo previo eliminado)');
}

async function main(): Promise<void> {
  console.log('Seed demo — inicio');
  await cleanupDemoTenant();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- Tenant ----
  const tenant = await prisma.tenant.create({
    data: { name: 'Bar Demo AI', slug: DEMO_SLUG },
  });

  // ---- Planes de la plataforma (globales) + suscripcion del tenant demo ----
  // Los planes son de la plataforma: se definen aqui, no los crean los tenants.
  const planData = [
    {
      code: 'free',
      name: 'Free',
      description: 'Para empezar: un solo local.',
      price: 0,
      interval: 'monthly' as const,
      trialDays: 0,
      maxVenues: 1,
      maxUsers: 3,
    },
    {
      code: 'pro',
      name: 'Pro',
      description: 'Hasta 5 locales, con 14 dias de prueba.',
      price: 49,
      interval: 'monthly' as const,
      trialDays: 14,
      maxVenues: 5,
      maxUsers: 25,
    },
    {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'Locales y usuarios ilimitados.',
      price: 199,
      interval: 'monthly' as const,
      trialDays: 0,
      maxVenues: null,
      maxUsers: null,
    },
  ];

  const plans: Record<string, string> = {};
  for (const p of planData) {
    const created = await prisma.plan.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    plans[p.code] = created.id;
  }

  // Elimina planes obsoletos de corridas anteriores (solo si nadie los usa).
  const obsolete = await prisma.plan.findMany({
    where: {
      code: { notIn: planData.map((p) => p.code) },
      subscriptions: { none: {} },
    },
    select: { id: true, code: true },
  });
  if (obsolete.length > 0) {
    await prisma.plan.deleteMany({ where: { id: { in: obsolete.map((p) => p.id) } } });
    console.log(`  (planes obsoletos eliminados: ${obsolete.map((p) => p.code).join(', ')})`);
  }

  // El tenant demo esta en Pro, con el periodo mensual vigente.
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plans['pro'],
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  // ---- Venues ----
  const centro = await prisma.venue.create({
    data: { tenantId: tenant.id, name: 'Sede Centro', slug: 'sede-centro', taxRate: 15 },
  });
  const norte = await prisma.venue.create({
    data: { tenantId: tenant.id, name: 'Sede Norte', slug: 'sede-norte', taxRate: 12 },
  });

  // ---- Usuarios + roles ----
  const owner = await prisma.user.create({
    data: { tenantId: tenant.id, email: 'owner@demo.com', passwordHash },
  });
  await prisma.userVenueRole.create({
    data: { tenantId: tenant.id, userId: owner.id, role: 'owner' },
  });

  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, email: 'admin@demo.com', passwordHash },
  });
  await prisma.userVenueRole.create({
    data: { tenantId: tenant.id, userId: admin.id, role: 'admin' },
  });

  for (const [email, venueId] of [
    ['staff.centro@demo.com', centro.id],
    ['staff.norte@demo.com', norte.id],
  ] as const) {
    const staff = await prisma.user.create({
      data: { tenantId: tenant.id, email, passwordHash },
    });
    await prisma.userVenueRole.create({
      data: { tenantId: tenant.id, userId: staff.id, venueId, role: 'staff' },
    });
  }

  // ---- Categorias ----
  const catData = [
    { es: 'Cervezas', en: 'Beers' },
    { es: 'Cocteles', en: 'Cocktails' },
    { es: 'Whiskies', en: 'Whiskies' },
    { es: 'Snacks', en: 'Snacks' },
  ];
  const categories: Record<string, string> = {};
  for (const name of catData) {
    const c = await prisma.category.create({
      data: { tenantId: tenant.id, name },
    });
    categories[name.es] = c.id;
  }

  // ---- Productos (name multiidioma, precio) ----
  const productData: Array<{
    es: string;
    en: string;
    price: number;
    cat: string;
    venueId?: string;
  }> = [
    { es: 'Cerveza Nacional', en: 'Local Beer', price: 2.5, cat: 'Cervezas' },
    { es: 'Cerveza Importada', en: 'Imported Beer', price: 4.0, cat: 'Cervezas' },
    { es: 'Mojito', en: 'Mojito', price: 6.5, cat: 'Cocteles' },
    { es: 'Margarita', en: 'Margarita', price: 7.0, cat: 'Cocteles' },
    { es: 'Whisky 12 anos', en: '12yo Whisky', price: 9.0, cat: 'Whiskies' },
    {
      es: 'Whisky Premium',
      en: 'Premium Whisky',
      price: 15.0,
      cat: 'Whiskies',
      venueId: centro.id,
    },
    { es: 'Alitas BBQ', en: 'BBQ Wings', price: 8.5, cat: 'Snacks' },
    { es: 'Nachos', en: 'Nachos', price: 6.0, cat: 'Snacks' },
  ];
  const products: Record<string, { id: string; price: number; name: object }> = {};
  for (const p of productData) {
    const created = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        venueId: p.venueId ?? null,
        categoryId: categories[p.cat],
        name: { es: p.es, en: p.en },
        price: p.price,
      },
    });
    products[p.es] = { id: created.id, price: p.price, name: { es: p.es, en: p.en } };
  }

  // ---- Mesas ----
  for (let i = 1; i <= 10; i++) {
    await prisma.table.create({
      data: { tenantId: tenant.id, venueId: centro.id, code: `C-${String(i).padStart(2, '0')}` },
    });
  }
  const tableN1 = await prisma.table.create({
    data: { tenantId: tenant.id, venueId: norte.id, code: 'N-01' },
  });
  for (let i = 2; i <= 5; i++) {
    await prisma.table.create({
      data: { tenantId: tenant.id, venueId: norte.id, code: `N-${String(i).padStart(2, '0')}` },
    });
  }
  const tableC1 = await prisma.table.findFirst({
    where: { tenantId: tenant.id, venueId: centro.id, code: 'C-01' },
  });

  // ---- Clientes ----
  const cliData = [
    {
      fullName: 'Juan Perez',
      email: 'juanp@mail.com',
      phone: '0999111222',
      documentId: '1712345678',
    },
    {
      fullName: 'Maria Lopez',
      email: 'marial@mail.com',
      phone: '0988333444',
      documentId: '0923456789',
    },
    { fullName: 'Carlos Ruiz', phone: '0977555666' },
    { fullName: 'Ana Torres', email: 'anat@mail.com' },
  ];
  const customers = [];
  for (const c of cliData) {
    customers.push(await prisma.customer.create({ data: { tenantId: tenant.id, ...c } }));
  }

  // ---- Reservas ----
  await prisma.reservation.create({
    data: {
      tenantId: tenant.id,
      venueId: centro.id,
      customerId: customers[0].id,
      tableId: tableC1?.id ?? null,
      reservedAt: new Date('2026-07-18T21:00:00.000Z'),
      partySize: 4,
      notes: 'Cumpleanos',
      status: 'confirmed',
    },
  });
  await prisma.reservation.create({
    data: {
      tenantId: tenant.id,
      venueId: norte.id,
      customerId: customers[1].id,
      tableId: tableN1.id,
      reservedAt: new Date('2026-07-20T22:30:00.000Z'),
      partySize: 2,
      status: 'pending',
    },
  });

  // ---- Eventos ----
  await prisma.event.create({
    data: {
      tenantId: tenant.id,
      venueId: centro.id,
      name: { es: 'Noche Latina', en: 'Latin Night' },
      description: { es: 'Salsa y bachata en vivo', en: 'Live salsa and bachata' },
      startsAt: new Date('2026-08-01T22:00:00.000Z'),
      endsAt: new Date('2026-08-02T03:00:00.000Z'),
      capacity: 200,
      coverPrice: 10,
      status: 'published',
    },
  });
  await prisma.event.create({
    data: {
      tenantId: tenant.id,
      venueId: norte.id,
      name: { es: 'DJ Night', en: 'DJ Night' },
      startsAt: new Date('2026-08-08T23:00:00.000Z'),
      capacity: 150,
      coverPrice: 15,
      status: 'scheduled',
    },
  });

  // ---- Promociones ----
  const happyHour = await prisma.promotion.create({
    data: {
      tenantId: tenant.id,
      name: { es: 'Happy Hour 20%', en: 'Happy Hour 20%' },
      description: { es: 'Descuento en toda la carta', en: 'Discount on the whole menu' },
      discountType: 'percentage',
      discountValue: 20,
      startsAt: new Date('2026-07-01T00:00:00.000Z'),
      endsAt: new Date('2026-12-31T23:59:59.000Z'),
      status: 'active',
    },
  });
  await prisma.promotion.create({
    data: {
      tenantId: tenant.id,
      venueId: centro.id,
      name: { es: '5 de descuento', en: '5 off' },
      discountType: 'fixed',
      discountValue: 5,
      status: 'active',
    },
  });

  // ---- Ordenes de ejemplo ----
  // Helper para crear una orden con items y totales calculados.
  async function createOrder(opts: {
    venueId: string;
    taxRate: number;
    items: Array<{ key: string; qty: number }>;
    customerId?: string;
    tableId?: string;
    promotion?: { id: string; type: 'percentage' | 'fixed'; value: number };
    pay?: boolean;
  }) {
    let subtotal = 0;
    const itemsData = opts.items.map(({ key, qty }) => {
      const p = products[key];
      const lineTotal = round2(p.price * qty);
      subtotal = round2(subtotal + lineTotal);
      return {
        tenantId: tenant.id,
        venueId: opts.venueId,
        productId: p.id,
        productName: p.name,
        quantity: qty,
        unitPrice: p.price,
        lineTotal,
      };
    });

    let discountTotal = 0;
    if (opts.promotion) {
      discountTotal =
        opts.promotion.type === 'percentage'
          ? round2(subtotal * (opts.promotion.value / 100))
          : Math.min(opts.promotion.value, subtotal);
    }
    const base = round2(subtotal - discountTotal);
    const taxTotal = round2(base * (opts.taxRate / 100));
    const total = round2(base + taxTotal);

    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        venueId: opts.venueId,
        customerId: opts.customerId ?? null,
        tableId: opts.tableId ?? null,
        promotionId: opts.promotion?.id ?? null,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        status: opts.pay ? 'paid' : 'open',
        items: { create: itemsData },
      },
    });

    if (opts.pay) {
      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          venueId: opts.venueId,
          orderId: order.id,
          amount: total,
          method: 'cash',
          status: 'paid',
        },
      });
    }
    return order;
  }

  // Orden abierta (en curso) en Centro, en una mesa.
  await createOrder({
    venueId: centro.id,
    taxRate: 15,
    tableId: tableC1?.id,
    items: [
      { key: 'Cerveza Nacional', qty: 3 },
      { key: 'Nachos', qty: 1 },
    ],
  });

  // Orden pagada con cliente.
  await createOrder({
    venueId: centro.id,
    taxRate: 15,
    customerId: customers[0].id,
    items: [
      { key: 'Mojito', qty: 2 },
      { key: 'Alitas BBQ', qty: 1 },
    ],
    pay: true,
  });

  // Orden con promocion Happy Hour 20% aplicada.
  await createOrder({
    venueId: norte.id,
    taxRate: 12,
    items: [
      { key: 'Whisky 12 anos', qty: 2 },
      { key: 'Cerveza Importada', qty: 2 },
    ],
    promotion: { id: happyHour.id, type: 'percentage', value: 20 },
  });

  // ---- Resumen ----
  const counts = {
    venues: await prisma.venue.count({ where: { tenantId: tenant.id } }),
    users: await prisma.user.count({ where: { tenantId: tenant.id } }),
    categories: await prisma.category.count({ where: { tenantId: tenant.id } }),
    products: await prisma.product.count({ where: { tenantId: tenant.id } }),
    tables: await prisma.table.count({ where: { tenantId: tenant.id } }),
    customers: await prisma.customer.count({ where: { tenantId: tenant.id } }),
    reservations: await prisma.reservation.count({ where: { tenantId: tenant.id } }),
    events: await prisma.event.count({ where: { tenantId: tenant.id } }),
    promotions: await prisma.promotion.count({ where: { tenantId: tenant.id } }),
    orders: await prisma.order.count({ where: { tenantId: tenant.id } }),
  };

  console.log('Seed demo — completado. Tenant "Bar Demo AI" (slug bar-demo).');
  console.log('  Login owner: owner@demo.com / ' + DEMO_PASSWORD);
  console.log(
    '  Otros: admin@demo.com, staff.centro@demo.com, staff.norte@demo.com (misma password)',
  );
  console.log('  Datos:', JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error('Seed demo — ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
