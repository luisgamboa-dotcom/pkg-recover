-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 12: FAQs de pago (Fase 2)
-- Responde "¿cómo pago?" directamente en el Centro de ayuda.
-- ============================================================================

insert into public.faqs (category, question, answer, sort_order) values
  ('pago', '¿Cómo pago mi pedido?',
   'Abre "Mis pedidos", entra al pedido pendiente y pulsa "Pagar ahora": te llevamos a la pasarela segura (MercadoPago o Webpay). Si elegiste transferencia, te contactaremos con los datos; contra entrega se paga al recibir.',
   10),
  ('pago', '¿Qué es Webpay y es seguro?',
   'Webpay de Transbank es la plataforma de pagos en línea más usada en Chile. El cobro ocurre en su sitio seguro: nunca vemos ni guardamos tu tarjeta.',
   11),
  ('pago', 'Mi pedido dice "pendiente de pago", ¿qué hago?',
   'Significa que el cobro aún no se confirma. Abre el pedido y completa el pago con el botón correspondiente, o contáctanos mediante un ticket de soporte.',
   12)
on conflict do nothing;
