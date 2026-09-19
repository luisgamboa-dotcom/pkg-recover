# ENTREGABLE — Plataforma de recuperación de paquetes (RecuperaPack)

Corresponde al punto 31 del prompt (`prompt.txt`): estructura final, SQL,
relaciones, RLS, funciones, frontend, integración y verificaciones.
Economía: **Chile (CLP, IVA 19%)**. Proyecto Supabase: `pkg-recover`.

---

## 1. Estructura final de la base de datos (31 tablas, PostgreSQL/Supabase)

**Acceso:** `roles` (customer/reseller/company/admin + permissions jsonb),
`profiles` (PK/FK a `auth.users`, sin contraseñas propias).

**Empresas y bodegas:** `companies` (RUT, código verificación, convenios),
`company_members` (N usuarios por empresa), `warehouses` (SCL-01, VLP-01).

**Catálogo:** `categories` (8 seed), `brands`, `lot_categories` (N:M).

**Núcleo:** `packages` (físico recibido) → `lots` (publicación, unidad de venta:
SKU auto, estados empaque/producto, verificación, unidades, peso, dimensiones,
precio/MSRP, moneda, stock, estado, destacado, circularidad) → `lot_images`
(refs Storage), `lot_price_tiers` (volumen), `inventory_movements` (libro).

**Compra:** `payment_methods` (card/webpay/bank_transfer/cash_on_delivery),
`addresses` (atómica: calle, número, depto, comuna, ciudad, región, postal,
país), `orders` (número auto, estados, subtotal/envío/IVA/total, método,
snapshot atómico de dirección) + `order_items` (precio histórico, total
generado), `shipments` + `shipment_events`, `payments` (intentos por pasarela),
`shipping_rates` (matriz ciudad×peso, 20 tarifas CLP).

**Comunidad:** `favorites` (N:M), `reviews` (rating 1–5, compra verificada),
`notifications` + `notification_preferences` (5 interruptores),
`support_tickets` + `ticket_messages`, `messages` (por lote).

**Marketing:** `promotions` + `promotion_lots`, `faqs` (10 seed).

Normalización 1NF/2NF/3NF: sin multivalores (direcciones atómicas,
categorías en intermedia), sin dependencias parciales ni transitivas
(snapshots históricos justifican su redundancia).

## 2. SQL necesario

`supabase/migrations/` en orden (ya aplicadas 01–12 en el proyecto):

| Archivo | Contenido |
|---|---|
| `2026090801_schema.sql` | Tablas, CHECKs, índices, triggers base, 3 vistas |
| `2026090802_rls.sql` | RLS + 60 políticas + buckets Storage |
| `2026090803_seed.sql` | Roles, categorías, pagos, bodegas, FAQs |
| `2026090804_hardening.sql` | `search_path` fijo en funciones |
| `2026090805_perf_indexes.sql` | 13 índices sobre FKs |
| `2026090806_trigger_definer.sql` | Totales/stock como DEFINER (checkout) |
| `2026090807_stock_guard.sql` | `pg_trigger_depth()` anti-RPC |
| `2026090808_automation.sql` | Historial de ventas + 5 avisos automáticos |
| `2026090809_payments_shipping.sql` | `payments`, `shipping_rates` + seed |
| `2026090810_address_atomic.sql` | Direcciones atómicas |
| `2026090812_payment_faqs.sql` | FAQs de pago |

Edge Functions: `supabase/functions/create-payment`, `payment-webhook`
(MercadoPago, desplegadas y activas).

## 3. Relaciones entre tablas (44 FKs)

- `profiles.role_id → roles`, `profiles.id → auth.users` (cascada).
- `company_members → companies, profiles` (única la pareja).
- `packages.company_id → companies`; `lots → companies, packages, warehouses, brands`.
- `lot_categories → lots, categories`; `lot_images, lot_price_tiers → lots`.
- `inventory_movements → lots (RESTRICT), warehouses, profiles`.
- `addresses → profiles`; `orders → profiles (RESTRICT), payment_methods, addresses (SET NULL)`.
- `order_items → orders (cascada), lots (RESTRICT)`; `shipments → orders (único), warehouses`.
- `shipment_events → shipments`; `payments → orders`.
- `favorites → profiles, lots`; `reviews → lots, profiles, orders (SET NULL)`.
- `notifications → profiles, orders/lots (SET NULL)`; `notification_preferences → profiles`.
- `support_tickets → profiles, orders (SET NULL)`; `ticket_messages → tickets, profiles`.
- `messages → lots, profiles ×2`; `promotion_lots → promotions, lots`.
- `shipping_rates → warehouses`.

## 4. Políticas RLS (71 en public+storage, 31/31 tablas protegidas)

- Públicas: roles, categorías, marcas, pagos, bodegas, FAQs/promociones
  activas, vitrina (`lots` publicados con stock), imágenes, tramos,
  `lot_categories`, reseñas visibles, tarifas activas.
- Dueño: perfiles (el rol solo lo cambia admin), direcciones, pedidos,
  favoritos, reseñas propias, avisos, tickets/mensajes propios.
- Empresa: sus paquetes (lee/crea), sus lotes, pedidos con sus lotes,
  despachos asociados.
- Comprador: crea su pedido; totales/estado solo vía trigger+admin.
- `payments`: solo lectura propia (escriben las Functions con service_role).
- Admin: todo. Helpers DEFINER: `is_admin`, `own_role_id`,
  `my_company_ids`, `is_order_buyer`, `order_has_company_lot` (estos dos
  rompen la recursión orders↔order_items, migración 11).
- Storage: lectura pública en `lot-images`/`avatars`; escritura admin o
  carpeta propia.

## 5. Funciones/triggers y justificación

| Función/trigger | Justificación |
|---|---|
| `set_updated_at` + 18 triggers | Auditoría `updated_at` |
| `handle_new_user` (DEFINER, en `auth.users`) | Perfil + preferencias al registrarse, rol customer/reseller |
| `assign_order_number/lot_sku/ticket_number` | Identificadores legibles que exige la UI |
| `recalc_order_totals` (DEFINER) | Total = detalle + envío + IVA, imposible de falsear |
| `apply_stock_delta/adjust_lot_stock` (DEFINER + guard RPC) | Sin stock negativo, `sold_out` automático |
| `log_sale_movement` (DEFINER) | Historial de inventario por venta |
| `notify_order_status/shipment/new_lot/promotion/back_in_stock` (DEFINER) | Avisos respetando preferencias |
| `status_es` | Etiquetas ES en avisos |
| Vistas `v_inventory_summary, v_company_recovery, v_best_selling_lots` | Reporter�\
...[truncated 3075 chars]