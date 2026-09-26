import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>
        <p className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Entwurf: Bitte ergänzen Sie die Angaben in eckigen Klammern (E-Mail, Telefon, ggf. Register/USt-IdNr.) vor dem Livebetrieb.</p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold">
          <section>
            <h2>Angaben gemäß § 5 DDG</h2>
            <p>
              Selimcan Özden
              <br />
              Kalrsteinstraße 2
              <br />
              80937 München
            </p>
          </section>
          <section>
            <h2>Vertreten durch</h2>
            <p>Selimcan Özden</p>
          </section>
          <section>
            <h2>Kontakt</h2>
            <p>
              E-Mail: [E-MAIL]
              <br />
              Telefon: [TELEFON]
            </p>
          </section>
          <section>
            <h2>Registereintrag und Umsatzsteuer-ID</h2>
            <p>[Registergericht, Registernummer und USt-IdNr., sofern vorhanden]</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
