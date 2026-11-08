import { LegalShell } from '../LegalShell';

export const metadata = { title: 'Términos de uso · Ónix Govern' };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-[17px] font-semibold text-ink">{children}</h2>;

export default function TerminosPage() {
  return (
    <LegalShell title="Términos de uso" updated="8 de noviembre de 2026">
      <section>
        <H>El servicio</H>
        <p className="mt-2">
          Ónix Govern es una plataforma de ÓNIX para revisar la madurez de una organización en el uso de inteligencia artificial, registrar sus casos y agentes de IA, priorizarlos y dar seguimiento a un plan de gobierno.
        </p>
      </section>
      <section>
        <H>Naturaleza orientativa</H>
        <p className="mt-2">
          Los resultados son una revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador; la plataforma no emite certificaciones ni sustituye asesoría legal.
        </p>
      </section>
      <section>
        <H>Asistente con IA</H>
        <p className="mt-2">
          Las redacciones y recomendaciones del Asistente Ónix son sugerencias generadas con los datos que tu organización registra. Revísalas antes de usarlas; las decisiones son de la organización.
        </p>
      </section>
      <section>
        <H>Cuentas y uso responsable</H>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cada persona usa su propia cuenta y cuida su contraseña.</li>
          <li>La organización decide quién tiene acceso y con qué rol.</li>
          <li>No subas información que no tengas derecho a compartir ni datos personales sensibles.</li>
          <li>No intentes acceder a datos de otras organizaciones ni afectar el funcionamiento del servicio.</li>
        </ul>
      </section>
      <section>
        <H>Información de la organización</H>
        <p className="mt-2">
          La información que cargas sigue siendo de tu organización. ÓNIX la usa solo para dar el servicio, conforme al aviso de privacidad. Al terminar la relación, puedes pedir una copia y su eliminación.
        </p>
      </section>
      <section>
        <H>Disponibilidad y responsabilidad</H>
        <p className="mt-2">
          Trabajamos para que el servicio esté disponible y seguro, pero puede tener interrupciones por mantenimiento o causas ajenas. ÓNIX no responde por decisiones tomadas solo con base en los resultados orientativos de la plataforma.
        </p>
      </section>
      <section>
        <H>Ley aplicable</H>
        <p className="mt-2">Estos términos se rigen por las leyes de los Estados Unidos Mexicanos.</p>
      </section>
    </LegalShell>
  );
}
