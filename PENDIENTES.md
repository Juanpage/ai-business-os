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

- [ ] **Remoto git + push** — POSPUESTO por decisión del usuario (desde 2026-07-10).
      Requiere que el usuario cree el repo remoto vacío (GitHub/GitLab) y comparta la URL.
      Hay 10 commits locales sin subir.
- [ ] **Docker desincronizado** — los contenedores `aibos-api`/`aibos-web` están **parados**
      a favor de los dev servers. La imagen `aibos-api` quedaría desactualizada si se
      reconstruye. Además, al encender Docker Desktop se reinician solos
      (`restart: unless-stopped`) y chocan con los dev servers en 3000/3001
      → hay que pararlos con `docker compose stop api web` (dejando `postgres`).
- [ ] **`turbo` no instalado** — el `package.json` raíz usa `turbo run ...` en sus scripts,
      pero `turbo` no está en devDependencies. `pnpm dev`/`build` a nivel raíz fallarían.
      Hoy se evita con `pnpm --filter <pkg> run <script>`. Falta: agregar `turbo` como
      devDependency raíz, o quitar esos scripts.
- [ ] **husky pre-commit mínimo** — solo corre prettier sobre archivos staged.
      Falta (opcional): agregar eslint y/o typecheck al hook.
- [ ] **`.claude/launch.json` duplicado** — el funcional vive en la carpeta de la sesión
      (Capturas de pantalla) porque `preview_start` lee de ahí; hay una copia redundante
      en `D:/AI-Business-OS/.claude/`. Decidir cuál se mantiene.

## 2. Pendientes de negocio (features)

- [x] **Aplicar promociones a órdenes** — ✅ HECHO (2026-07-13, commit `fdf6441`).
      `POST/DELETE /orders/:id/promotion`. Order gana `promotionId` + `discountTotal`
      (migr. `add_order_discount`). Una promo por orden, valida activa/vigente y
      venue/tenant-wide, tope = subtotal, IVA sobre base descontada. Cubierto por e2e.
      Falta (opcional): promos acumulables, promos por producto/categoría.
- [ ] **Facturación SaaS** — módulos `plans` y `subscriptions` siguen como stubs.
      Es el cobro a los tenants por usar la plataforma (no confundir con los pagos de
      órdenes de los bares).
- [ ] **`AIGenerationLog`** — entidad/módulo aún stub; registrar generaciones de IA.
- [ ] **Frontend real (`web`)** — hoy es solo una página en blanco con Tailwind.
      Falta toda la UI (login, dashboard, POS, catálogo, etc.).
- [ ] **`apps/admin`** — carpeta reservada, vacía. Panel de administración pendiente.

## 3. Interfaces vacías A PROPÓSITO (no implementar sin indicación)

- [ ] **Gateway de pago PayPhone** — `modules/payments/services/payment-gateway/` puerto vacío.
- [ ] **Proveedor de IA** — `modules/ai/services/ai-provider/` puerto vacío.

## 4. Calidad y robustez (deuda técnica conocida)

- [x] **Tests automatizados (base)** — ✅ HECHO (2026-07-13, commit `9442c85`).
      Suite e2e jest+supertest contra DB de test `aibos_test` (7 tests: health, auth,
      aislamiento, roles, ventas). Correr: `pnpm --filter @ai-business-os/api test:e2e`.
      Falta (ampliar): cobertura de los módulos restantes (reservations, tables,
      customers, events, promotions) y tests unitarios de services.
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

## Próximos pasos sugeridos (en orden)

1. ~~Tests automatizados (base)~~ ✅ HECHO.
2. ~~Aplicar promociones a órdenes~~ ✅ HECHO.
3. **Seed demo.** ← siguiente
4. Remoto git + push (cuando el usuario dé la URL).
5. Frontend real / facturación SaaS.
6. Ampliar cobertura de tests a los módulos restantes.
