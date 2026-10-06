import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { PageHeader } from '../../components/ui';

interface Entry {
  date: string;
  area: string;
  title: string;
  detail: string;
}

const ENTRIES: Entry[] = [
  {
    date: '2026-09-29',
    area: 'Seguridad',
    title: 'Integridad de precios en servidor',
    detail:
      'El flete y el IVA se recalculan con trigger (migración 15): el comprador ya no puede abaratar su pedido. Reseñas verificadas solo con compra real y una sola dirección principal por usuario.',
  },
  {
    date: '2026-09-29',
    area: 'Modelo',
    title: 'Lotes pasan a ser Productos',
    detail:
      'Renombre completo (migración 14): tablas, columnas, triggers, vistas, políticas y bucket, más rutas /productos y textos en español. SKU RP-##### se mantiene.',
  },
  {
    date: '2026-09-29',
    area: 'Seguridad',
    title: 'Auditoría integral y correcciones',
    detail:
      'Triggers de totales/stock como DEFINER (el checkout fallaba por RLS), guard anti-RPC en stock, errores legibles en 20 vistas y cabeceras de seguridad en Vercel. Cero vulnerabilidades en dependencias.',
  },
  {
    date: '2026-09-20',
    area: 'Diseño',
    title: 'Versión móvil completa',
    detail:
      'Barra inferior con 5 pestañas, menú hamburguesa, safe-areas, metas móviles y unidades dvh. Escritorio intacto.',
  },
  {
    date: '2026-09-20',
    area: 'Landing',
    title: 'Portada comercial con degradados',
    detail:
      'Nueva landing sin información de desarrollo: propuesta de valor, cómo funciona, empresas y personas, categorías y destacados.',
  },
  {
    date: '2026-09-20',
    area: 'Modelo',
    title: 'Método único de recepción',
    detail:
      'Tabla reception_methods con "Personal de pkg-recover" como único método obligatorio al registrar paquetes (migración 13).',
  },
  {
    date: '2026-09-20',
    area: 'Seguridad',
    title: 'Eliminado el modo exploración',
    detail:
      'Se retiró por completo el acceso temporal (entraba como admin sin cuenta), con purga al arrancar para navegadores con sesiones viejas.',
  },
  {
    date: '2026-09-20',
    area: 'Contenido',
    title: 'Página Nosotros + marca personal',
    detail: 'Secciones de proyecto, aporte y proceso, con la firma del creador Luis D. Gamboa.',
  },
  {
    date: '2026-09-18',
    area: 'Pagos',
    title: 'MercadoPago y flete dinámico (Fase 2)',
    detail:
      'Edge Functions create-payment/payment-webhook desplegadas, tabla payments, matriz de flete por ciudad y peso (20 tarifas), y guía de pago por método en el detalle del pedido.',
  },
  {
    date: '2026-09-18',
    area: 'Backend',
    title: 'Automatización Fase 1',
    detail:
      'Historial de ventas en inventario y 5 avisos automáticos (pedido, despacho, novedad, oferta, disponibilidad) respetando preferencias. Verificado con pruebas vivas.',
  },
  {
    date: '2026-09-18',
    area: 'Base de datos',
    title: 'Migraciones 01–12 aplicadas',
    detail:
      'Esquema 1NF–3NF, RLS por rol, seed chileno (CLP, Webpay, SCL/VLP), hardening, índices, direcciones atómicas y corrección de recursión en políticas de pedidos.',
  },
  {
    date: '2026-09-16',
    area: 'Tienda',
    title: 'Vistas cliente y paneles iniciales',
    detail:
      'Catálogo con filtros, detalle, carrito, checkout con IVA 19%, pedidos con seguimiento, favoritos, reseñas, perfil, ayuda, empresa y panel admin con reportes y gráficos.',
  },
  {
    date: '2026-09-08',
    area: 'Fundación',
    title: 'Esquema inicial y autenticación',
    detail:
      'Modelo normalizado desde el preliminar, Supabase Auth sin contraseñas propias y vistas de login/registro con roles.',
  },
];

const AREA_STYLE: Record<string, string> = {
  Seguridad: 'text-red-800 bg-red-100',
  Modelo: 'text-brand-900 bg-brand-100',
  Diseño: 'text-fuchsia-800 bg-fuchsia-100',
  Tienda: 'text-emerald-800 bg-emerald-100',
  Pagos: 'text-amber-800 bg-amber-100',
  Backend: 'text-sky-800 bg-sky-100',
  Contenido: 'text-slate-700 bg-slate-200',
  'Base de datos': 'text-violet-800 bg-violet-100',
  Fundación: 'text-slate-700 bg-slate-200',
};

export default function AdminChangelog() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <PageHeader
          title="Cambios del sistema"
          subtitle="Historial de lo implementado en la plataforma, en orden reciente."
        />
        <ol className="relative space-y-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {ENTRIES.map((e) => (
            <li key={`${e.date}-${e.title}`} className="relative pl-8">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-brand-900 border-2 border-white shadow"
              />
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">{e.date}</span>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${AREA_STYLE[e.area] ?? 'text-slate-600 bg-slate-200'}`}
                  >
                    {e.area}
                  </span>
                </div>
                <h2 className="mt-2 font-bold text-brand-950">{e.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{e.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </AdminLayout>
    </RequireAdmin>
  );
}
