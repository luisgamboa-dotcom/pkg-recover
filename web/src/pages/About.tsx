import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/ui';

export default function About() {
  return (
    <Layout>
      <PageHeader
        title="Nosotros"
        subtitle="Quiénes somos, qué aportamos y cómo lo hacemos."
      />

      {/* 1. El proyecto */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-900 to-[#4c2a85] text-white p-8 lg:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-500">
          El proyecto
        </p>
        <h2 className="mt-2 text-2xl lg:text-3xl font-extrabold tracking-tight">
          RecuperaPack: la vitrina circular de Chile
        </h2>
        <p className="mt-3 max-w-3xl text-brand-100/90">
          Miles de paquetes se extravían o nunca son reclamados, y toneladas de
          objetos en buen estado terminan en la basura porque sus dueños ya no
          los quieren. RecuperaPack nace para darle una segunda vida a todo
          eso: rescatamos, verificamos y publicamos lotes con descuento para
          que comprar barato también sea comprar responsable.
        </p>
      </section>

      {/* Creador */}
      <section className="mt-10 rounded-3xl bg-white border border-slate-200 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-[0_10px_30px_rgba(26,54,93,0.08)]">
        <span className="grid place-items-center w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-brand-900 to-[#4c2a85] text-white text-2xl font-extrabold">
          LG
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-600">
            Creador
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">
            Luis D. Gamboa
          </h2>
          <p className="mt-1 text-slate-600">
            Fundador de RecuperaPack. Impulsa una vitrina circular donde nada
            útil termine en la basura: tecnología, trazabilidad y precios
            justos al servicio de las personas y las empresas de Chile.
          </p>
        </div>
      </section>

      {/* 2. Qué aporta */}
      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">
          Qué aporta
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-[0_10px_30px_rgba(26,54,93,0.08)]">
            <span className="text-3xl" aria-hidden="true">🌎</span>
            <h3 className="mt-3 font-bold text-brand-950">Al planeta</h3>
            <p className="mt-1.5 text-slate-600">
              Cada lote vendido evita kilos de desecho electrónico, textil y
              domiciliario. Medimos la circularidad y el material recuperado
              lote por lote.
            </p>
          </article>
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-[0_10px_30px_rgba(26,54,93,0.08)]">
            <span className="text-3xl" aria-hidden="true">💰</span>
            <h3 className="mt-3 font-bold text-brand-950">A las personas</h3>
            <p className="mt-1.5 text-slate-600">
              Precios hasta 45% bajo la referencia, con ficha verificada
              (estado, peso, unidades), garantía Recupera y seguimiento total
              del despacho. Y si tienes objetos que ya no usas, también pueden
              entrar a la vitrina.
            </p>
          </article>
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-[0_10px_30px_rgba(26,54,93,0.08)]">
            <span className="text-3xl" aria-hidden="true">🏢</span>
            <h3 className="mt-3 font-bold text-brand-950">A las empresas</h3>
            <p className="mt-1.5 text-slate-600">
              Las proveedoras convierten paquetes no reclamados en valor
              económico recuperado, con reportes de trazabilidad por lote,
              paquete y venta.
            </p>
          </article>
        </div>
      </section>

      {/* 3. Cómo lo hace */}
      <section className="mt-10 rounded-3xl bg-gradient-to-b from-white to-brand-50 border border-slate-200 p-8">
        <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">
          Cómo lo hace
        </h2>
        <ol className="mt-5 space-y-4">
          {[
            ['Recepción', 'Nuestro personal recibe paquetes de empresas y objetos de personas, registrando origen, unidades y peso.'],
            ['Clasificación', 'Evaluamos empaque y producto (original/dañada, intacto/funcional/repuestos) y asignamos bodega y zona.'],
            ['Publicación', 'Cada lote sale con SKU, fotos, precio, referencia MSRP y descuento calculado. Nada se vende sin verificar.'],
            ['Venta y despacho', 'Compras con IVA incluido, número de pedido y seguimiento por transportadora hasta tu puerta.'],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 text-white font-extrabold">
                {i + 1}
              </span>
              <div>
                <p className="font-bold text-brand-950">{title}</p>
                <p className="text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/catalogo"
            className="rounded-xl bg-brand-900 text-white font-semibold px-5 py-3 hover:bg-brand-700"
          >
            Ver lotes
          </Link>
          <Link
            to="/ayuda"
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-brand-900 hover:border-brand-900"
          >
            Contáctanos
          </Link>
        </div>
      </section>
    </Layout>
  );
}
