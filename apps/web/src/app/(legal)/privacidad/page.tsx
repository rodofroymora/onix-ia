import { LegalShell } from '../LegalShell';

export const metadata = { title: 'Aviso de privacidad · Ónix Govern' };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-[17px] font-semibold text-ink">{children}</h2>;

export default function PrivacidadPage() {
  return (
    <LegalShell title="Aviso de privacidad" updated="8 de noviembre de 2026">
      <section>
        <H>Quién es responsable</H>
        <p className="mt-2">
          ÓNIX (onix-ia.com) es responsable del tratamiento de los datos personales que se recaban en Ónix Govern, conforme a la legislación mexicana de protección de datos personales en posesión de los particulares.
        </p>
      </section>
      <section>
        <H>Qué datos tratamos</H>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Datos de cuenta: nombre, correo, organización, rol y registro de accesos.</li>
          <li>Respuestas al cuestionario de madurez y comentarios de cada respondente.</li>
          <li>Información de la organización: inventario de casos y agentes de IA, plan de acción, evidencias y archivos que tú subes.</li>
          <li>Datos de uso de herramientas de IA que la organización decida cargar (telemetría).</li>
        </ul>
        <p className="mt-2">No pedimos datos personales sensibles. Te pedimos no subir información de ese tipo en evidencias ni descripciones.</p>
      </section>
      <section>
        <H>Para qué los usamos</H>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Dar el servicio: evaluar la madurez, priorizar casos, dar seguimiento al plan y generar informes.</li>
          <li>Enviar invitaciones, recordatorios y avisos de la plataforma.</li>
          <li>Seguridad, soporte y mejora del servicio.</li>
        </ul>
      </section>
      <section>
        <H>Con quién se comparten</H>
        <p className="mt-2">Solo con proveedores que nos ayudan a operar el servicio, bajo contrato y sin permiso para usarlos con otros fines:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Alojamiento de la aplicación y base de datos (Vercel y Neon).</li>
          <li>Envío de correos (Resend).</li>
          <li>Redacción asistida por IA (Anthropic): cuando usas el Asistente Ónix se envía un resumen de los datos de tu organización. Por sus términos comerciales, Anthropic no usa esa información para entrenar sus modelos.</li>
        </ul>
        <p className="mt-2">Los datos de cada organización están aislados; ninguna otra organización puede verlos.</p>
      </section>
      <section>
        <H>Tus derechos</H>
        <p className="mt-2">
          Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, así como revocar tu consentimiento. Para hacerlo, contáctanos por WhatsApp desde onix-ia.com indicando tu nombre, correo y la solicitud. Te responderemos en los plazos que marca la ley.
        </p>
      </section>
      <section>
        <H>Conservación y seguridad</H>
        <p className="mt-2">
          Conservamos los datos mientras exista la relación con la organización y hasta 12 meses después, salvo que la ley pida otra cosa. Usamos cifrado en tránsito, contraseñas protegidas con funciones de derivación seguras y aislamiento por organización a nivel base de datos.
        </p>
      </section>
      <section>
        <H>Cookies</H>
        <p className="mt-2">Usamos solo cookies necesarias para mantener tu sesión y tus preferencias de vista. No usamos cookies de publicidad.</p>
      </section>
      <section>
        <H>Cambios a este aviso</H>
        <p className="mt-2">Publicaremos cualquier cambio en esta página con su fecha de actualización.</p>
      </section>
    </LegalShell>
  );
}
