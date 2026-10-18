import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold">
          <section>
            <h2>Angaben gemäß § 5 DDG</h2>
            <p>
              Selimcan Özden
              <br />
              Karlsteinstraße 2
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
              Telefon: <a href={`tel:${siteConfig.phone.replace(/s/g, "")}`}>{siteConfig.phone}</a>
              <br />
              E-Mail: {siteConfig.supportEmail}
            </p>
          </section>
          <section>
            <h2>Umsatzsteuer</h2>
            <p>Kleinunternehmer im Sinne von § 19 UStG. Es wird keine Umsatzsteuer berechnet.</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
