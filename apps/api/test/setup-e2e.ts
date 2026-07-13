// Configuracion de entorno para tests e2e.
// Se ejecuta ANTES de cargar la app, para que ConfigModule/Prisma usen la DB de test.
// dotenv (ConfigModule) no sobreescribe variables ya definidas en process.env.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://aibos:aibos@localhost:5433/aibos_test?schema=public';
process.env.JWT_SECRET = 'test-secret-e2e';
process.env.JWT_EXPIRES_IN = '1d';
