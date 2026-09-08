-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 3: datos iniciales mínimos
-- Solo catálogos y configuración base (prompt §27.13). Sin datos ficticios
-- de negocio: lotes, empresas, pedidos y usuarios se crean operando.
-- ============================================================================

-- Roles del sistema (prompt §24)
insert into public.roles (code, name, description, permissions) values
  ('customer', 'Cliente particular',
   'Explora, compra, gestiona pedidos, favoritos, reseñas y notificaciones.',
   '{"catalog": ["read"], "orders": ["create", "read_own"], "favorites": ["manage_own"], "reviews": ["manage_own"], "support": ["create_own"]}'),
  ('reseller', 'Revendedor',
   'Compra por volumen con precios especiales y consulta historial.',
   '{"catalog": ["read"], "wholesale": ["read", "buy"], "orders": ["create", "read_own"], "support": ["create_own"]}'),
  ('company', 'Empresa proveedora',
   'Registra paquetes entregados y consulta productos, ventas y recuperación.',
   '{"packages": ["create_own", "read_own"], "lots": ["read_own"], "sales": ["read_own"], "reports": ["read_own"]}'),
  ('admin', 'Administrador',
   'Gestión total: usuarios, productos, inventario, paquetes, pedidos, empresas.',
   '{"all": ["manage"]}')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions;

-- Categorías (pantalla Carga B2B + filtros de catálogo)
insert into public.categories (name, slug, description, sort_order) values
  ('Electrónica',   'electronica', 'Lotes de electrónica de consumo y componentes.', 1),
  ('Hogar',         'hogar',       'Electrodomésticos y artículos para el hogar.',   2),
  ('Moda',          'moda',        'Vestuario, calzado y accesorios.',                3),
  ('Juguetería',    'jugueteria',  'Juguetes y artículos infantiles.',                4),
  ('Automotriz',    'automotriz',  'Repuestos y accesorios para vehículos.',          5),
  ('Deportes',      'deportes',    'Artículos deportivos y aire libre.',              6),
  ('Belleza',       'belleza',     'Cuidado personal y cosmética.',                   7),
  ('Herramientas',  'herramientas','Herramientas y ferretería.',                      8)
on conflict (name) do update set
  slug = excluded.slug,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Métodos de pago (pantalla Finalizar Compra). Sin datos de tarjetas.
insert into public.payment_methods (code, name, description, allows_installments, max_installments, sort_order) values
  ('card', 'Tarjeta de Crédito / Débito',
   'Hasta 12 cuotas sin interés con bancos aliados.', true, 12, 1),
  ('pse', 'PSE / Transferencia Bancaria',
   'Débito directo desde cuenta de ahorros o corriente.', false, null, 2),
  ('bank_transfer', 'Transferencia Bancaria',
   'Transferencia directa a cuenta de la plataforma.', false, null, 3),
  ('cash_on_delivery', 'Pago contra entrega',
   'Paga al recibir en efectivo o con QR. Sujeto a cobertura.', false, null, 4)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  allows_installments = excluded.allows_installments,
  max_installments = excluded.max_installments,
  sort_order = excluded.sort_order;

-- Bodegas iniciales
insert into public.warehouses (code, name, city, country, capacity_lots) values
  ('BOG-01', 'Bodega Central Bogotá', 'Bogotá D.C.', 'Colombia', 5000),
  ('MED-01', 'Bodega Medellín', 'Medellín', 'Colombia', 2000)
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  capacity_lots = excluded.capacity_lots;

-- Preguntas frecuentes (pantalla Centro de Ayuda)
insert into public.faqs (category, question, answer, sort_order) values
  ('plataforma', '¿Cómo funciona RecuperaPack?',
   'Recuperamos paquetes extraviados o no reclamados, clasificamos su contenido y lo publicamos en lotes verificados con descuento frente al precio de referencia. Compras el lote completo con garantía de calidad.',
   1),
  ('compra', '¿Qué significa el porcentaje de descuento de un lote?',
   'Es la reducción estimada frente al precio de referencia (MSRP) de los productos que componen el lote. El precio publicado excluye IVA y costo de envío.',
   2),
  ('compra', '¿Qué métodos de pago aceptan?',
   'Tarjeta de crédito/débito hasta 12 cuotas, PSE/transferencia bancaria y pago contra entrega en zonas con cobertura. No almacenamos datos de tarjetas.',
   3),
  ('despachos', '¿Cómo sigo mi pedido?',
   'Cada pedido genera un número de seguimiento. En "Mis pedidos" ves el estado del despacho y su historial: preparación, tránsito y entrega.',
   4),
  ('devoluciones', '¿Puedo devolver o cancelar un pedido?',
   'Puedes solicitar cancelación antes del despacho y devolución según las condiciones publicadas. Abre un ticket de soporte con tu número de pedido.',
   5),
  ('garantia', '¿Los lotes tienen garantía?',
   'Todos los lotes verificados cuentan con Garantía Recupera: el estado publicado (empaque y producto) corresponde a lo recibido o te devolvemos tu dinero.',
   6),
  ('empresas', 'Soy empresa, ¿cómo entrego paquetes?',
   'Regístrate como empresa proveedora. Un administrador verifica tu cuenta y podrás registrar paquetes entregados y ver el valor económico recuperado.',
   7)
on conflict do nothing;
