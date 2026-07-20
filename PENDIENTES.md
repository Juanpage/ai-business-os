# AI Business OS — Pendientes y Backlog

> Documento vivo. Registra todo lo pendiente para no perder el hilo entre sesiones.
> Última actualización: **2026-07-13**.

---

## Estado general

Vertical **bar/discoteca funcionalmente completo** a nivel backend. Módulos de negocio
implementados y verificados end-to-end (aislamiento por tenant, roles, soft-delete,
validaciones cruzadas): `identity(+members)`, `tenants`, `venues`, `categories`,
`products`, `tables`, `customers`, `reservations`, `orders(+items+payments)`, `events`,
`promotions`, `health`.

- Repo git local en `D:\AI-Business-OS`, rama `main`, **10 commits**, sin remoto.
- Base de datos PostgreSQL en contenedor Docker (`aibos-postgres`, puerto host 5433).
- Dev servers con hot-reload: `api` (:3001), `web` (:3000).

---

## 1. Pendientes de infraestructura / entorno

- [x] **Remoto git + push** — ✅ HECHO (2026-07-13). Remoto `origin`:
      https://github.com/Juanpage/ai-business-os · rama `main` sincronizada.
      Recordar `git push` tras cada commit nuevo.
- [ ] **Docker desincronizado** — los contenedores `aibos-api`/`aibos-web` están **parados**
      a favor de los dev servers. La imagen `aibos-api` quedaría desactualizada si se
      reconstruye. Además, al encender Docker Desktop se reinician solos
      (`restart: unless-stopped`) y chocan con los dev servers en 3000/3001
      → hay que pararlos con `docker compose stop api web` (dejando `postgres`).
- [x] **`turbo` + `pnpm` global** — ✅ HECHO (2026-07-14, commit `9a1df4e`).
      `turbo` agregado a devDeps raíz **y pnpm instalado globalmente** (10.34.5, en el
      prefijo de usuario `AppData\Roaming\npm`, sin admin). Turbo necesitaba el binario
      del package manager en el PATH. Ahora `pnpm dev/build/typecheck` funcionan a nivel
      monorepo (verificado: `pnpm typecheck` → 2/2 en verde).
      **Esto cierra de raíz el viejo gotcha de "pnpm no es global"** (corepack enable
      fallaba con EPERM). Ya no hace falta `npx pnpm@10...`.
- [x] **`.claude/launch.json` duplicado** — ✅ HECHO. Eliminada la copia del proyecto;
      la funcional vive en la carpeta de la sesión (que es donde `preview_start` lee).
- [ ] **husky pre-commit mínimo** — solo corre prettier sobre archivos staged.
      Falta (opcional): agregar eslint y/o typecheck al hook. (Ahora que turbo funciona,
      `pnpm typecheck` en el hook sería viable, aunque encarece cada commit.)

## 2. Pendientes de negocio (features)

- [x] **Aplicar promociones a órdenes** — ✅ HECHO (2026-07-13, commit `fdf6441`).
      `POST/DELETE /orders/:id/promotion`. Order gana `promotionId` + `discountTotal`
      (migr. `add_order_discount`). Una promo por orden, valida activa/vigente y
      venue/tenant-wide, tope = subtotal, IVA sobre base descontada. Cubierto por e2e.
      Falta (opcional): promos acumulables, promos por producto/categoría.
- [x] **Facturación SaaS** — ✅ HECHO (2026-07-14, commit `4c7a888`). Módulo `billing`:
      `GET /plans` (solo lectura, los define la plataforma), `GET /subscriptions/me`,
      `POST /subscriptions` (suscribir/cambiar plan, solo owner),
      `POST /subscriptions/me/cancel`. Plan gana price/interval/trialDays/maxVenues/
      maxUsers; Subscription gana currentPeriodStart/End, trialEndsAt, cancelledAt
      (migr. `add_billing_fields`). **El límite `maxVenues` se aplica de verdad**:
      crear un venue sobre la cuota → 409. Seed con 3 planes (Free/Pro/Enterprise).
      Falta (diferido): cobro real con pasarela, invoices, prorrateo, renovación por cron.
- [ ] **`AIGenerationLog`** — entidad/módulo aún stub; registrar generaciones de IA.
- [~] **Frontend real (`web`)** — incremento 1 HECHO (2026-07-13, commit `e086547`):
  login (JWT en localStorage) + dashboard protegido que muestra tenant/venues/carta
  del seed + logout. `lib/api.ts` (fetch) y `lib/auth-context.tsx`. Verificado en
  navegador + build prod + typecheck. FALTA: POS (crear órdenes), gestión de
  catálogo/mesas/reservas desde la UI, i18n selector, etc.
  Nota: en el navegador in-app se ve un error de consola cacheado en `/`
  (`__webpack_require__.n`), es artefacto de caché del preview, NO del código
  (build de producción limpio). En navegador normal / `next start` no ocurre.
- [ ] **`apps/admin`** — carpeta reservada, vacía. Panel de administración pendiente.

## 3. Interfaces vacías A PROPÓSITO (no implementar sin indicación)

- [ ] **Gateway de pago PayPhone** — `modules/payments/services/payment-gateway/` puerto vacío.
- [ ] **Proveedor de IA** — `modules/ai/services/ai-provider/` puerto vacío.

## 4. Calidad y robustez (deuda técnica conocida)

- [x] **Tests automatizados** — ✅ HECHO. Base (commit `9442c85`) + ampliación a todos los
      módulos (commit `ee8f539`). Suite e2e jest+supertest contra DB de test `aibos_test`:
      **20 tests en verde** (auth, aislamiento, roles, ventas/IVA, promos en órdenes,
      tables, customers, reservations, events, promotions).
      Correr: `pnpm --filter @ai-business-os/api test:e2e`.
      Falta (opcional): tests unitarios de services con mocks.
- [ ] **Máquina de estados de `status`** — en orders/reservations/events/promotions el
      `status` se setea libremente vía PATCH; no se validan transiciones
      (ej. no impedir pasar de `cancelled` a `paid`). La única transición automática es
      la de pagos (order → pending_payment/paid).
- [ ] **Solapamiento de reservas** — no se valida que dos reservas choquen en la misma
      mesa/horario.
- [ ] **Unicidad de datos** — `tables` no tiene unique en `[venueId, code]`;
      `customers.documentId` no es único por tenant. Evaluar si se necesita.
- [ ] **Paginación** — los listados (`GET`) devuelven todo sin paginar.

## 5. Historial de decisiones de schema (campos añadidos al scaffold)

El scaffold inicial creó modelos sin campos de datos útiles. Ya completados con migración:

- `Product` → `price` (Decimal 12,2) — migr. `add_product_price`.
- `Customer` → `fullName`, `email`, `phone`, `documentId` — migr. `add_customer_fields`.
- `Reservation` → `reservedAt`, `partySize`, `notes` — migr. `add_reservation_fields`.
- `Venue` → `taxRate`; `Order` → subtotal/taxTotal/total; `OrderItem` →
  productName(snapshot)/quantity/unitPrice/lineTotal; `Payment` → `amount`
  — migr. `add_sales_fields`.
- `Event` → name/description/startsAt/endsAt/capacity/coverPrice;
  `Promotion` → name/description/discountType(enum)/discountValue/startsAt/endsAt
  — migr. `add_event_promotion_fields`.

Decisiones clave: dinero siempre `Decimal` (nunca float); precio/nombre se "congelan"
(snapshot) en `OrderItem` al vender; IVA configurable por venue (`Venue.taxRate`),
`taxTotal = subtotal * taxRate / 100`.

---

## Cola de desarrollo activa (roadmap — trabajar en orden)

> Toda sugerencia que surja se agrega AQUÍ para no perderla. Se van tomando en orden.

**Hitos completados:** tests e2e base (y ampliados a 40) · promos en órdenes · seed demo ·
remoto GitHub · frontend (login/dashboard/POS/catálogo/operación/i18n) · infra
(turbo+pnpm global) · facturación SaaS (planes+límite real) · panel admin (backend+frontend).

**En cola (orden actual):**

1. ~~Frontend — POS / crear órdenes~~ ✅ HECHO (commit `a4f4515`). `/dashboard/pos`:
   venue → productos → cantidades → promo → cobro → orden paid. Verificado en vivo.
2. ~~Frontend — Gestión de catálogo~~ ✅ HECHO (commit `25b1e80`). `/dashboard/catalog`:
   CRUD productos y categorías (modal, multiidioma es/en, borrado con modal in-app).
3. ~~Frontend — Gestión operativa~~ ✅ HECHO (commit `428b31b`). `/dashboard/operations`:
   3 pestañas mesas/clientes/reservas (reserva con mesa filtrada al local + datetime).
4. ~~Frontend — Selector de idioma (i18n)~~ ✅ HECHO (commit `a7732b0`). Toggle ES/EN
   (LanguageProvider + localStorage) en dashboard/POS/catálogo; `localized(v, locale)`
   con fallback. Incluye además: **cierre de sesión automático en 401** (el JWT expira
   en 1 día; antes el usuario quedaba atascado con un error).
5. ~~Ampliar cobertura de tests e2e~~ ✅ HECHO (commit `ee8f539`). `test/helpers.ts` +
   `test/modules.e2e-spec.ts`: tables/customers/reservations/events/promotions con sus
   reglas de negocio (roles, validaciones, mesa↔venue, % >100, aislamiento).
   **Suite total: 20/20 en verde.** Correr: `pnpm --filter @ai-business-os/api test:e2e`.
6. ~~Facturación SaaS~~ ✅ HECHO (commit `4c7a888`). Planes + suscripciones + límite
   real de locales por plan (409). Suite e2e: **29/29 en verde**.
7. **Panel admin** — ✅ HECHO. **Fase 1 (backend)** commit `3a1aab9`: modelo
   `PlatformAdmin` separado, auth propia scope 'platform', aislamiento bidireccional (401),
   `GET/PATCH /admin/tenants`, CRUD `/admin/plans`, `GET /admin/metrics` (MRR). Suite 40/40.
   **Fase 2 (frontend)** commit `2f781a0`: `apps/admin` (Next.js nuevo, puerto **3002**):
   login, dashboard (MRR/tenants/suscripciones), tabla tenants (suspender/reactivar),
   CRUD planes (modal). localStorage con claves propias (`aibos_admin_*`) — verificado que
   la sesión de plataforma y la de tenant **conviven sin pisarse** en pestañas distintas.
   Seed `admin@platform.com`/`demo1234`.
8. **Endurecimiento**: máquina de estados de `status`, solapamiento de reservas,
   uniques (`tables[venueId,code]`, `customers.documentId`), paginación en listados.
9. **Infra**: agregar `turbo` a devDeps raíz; hooks husky (eslint/typecheck);
   resolver `.claude/launch.json` duplicado; reconstruir imagen Docker `api` cuando aplique.

**Diferido / requiere indicación explícita:** gateway PayPhone, proveedor de IA,
`AIGenerationLog`.
