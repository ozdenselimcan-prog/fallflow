"use client";

import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Chips, cityOf, CUSTOMERS, GREETINGS, STRENGTHS, TONES, type Greeting } from "@/components/onboarding/interview";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";
import type { Tone } from "@/lib/data/types";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Fragebogen „Wir richten alles für Sie ein“ (/einrichtung): eine Frage pro Bildschirm, ohne Anmeldung. Am Ende legt FallFlow
 * das Konto an und richtet es ein; wir prüfen es und schicken dann den Zugang (siehe lib/setup/managed.ts).
 */
const TOTAL = 8;

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ManagedSetupForm({ pilot = false }: { pilot?: boolean } = {}) {
  const trialText = pilot ? "einen Monat" : "7 Tage";
  const top = useRef<HTMLDivElement>(null);
  // Auf dem Handy steht der Fragebogen unter dem Einleitungstext: nach jedem Schritt zum Fragebogen scrollen, nicht zum Seitenanfang.
  const toTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [prices, setPrices] = useState<{ item: string; price: string; note: string }[]>([]);
  const [newPrice, setNewPrice] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [greeting, setGreeting] = useState<Greeting>("guten-tag");
  const [signature, setSignature] = useState("");
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState(false);
  const [hp, setHp] = useState("");

  const preset = INDUSTRY_PRESETS.find((p) => p.id === industry);
  const serviceOptions = [...new Set([...(preset?.services ?? []), ...services])];
  const city = cityOf(address);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const canNext =
    index === 0
      ? company.trim().length >= 2 && firstName.trim() && lastName.trim() && validEmail && phone.trim().length >= 5
      : index === 1
        ? Boolean(industry || description.trim().length >= 10 || website.trim())
        : index === 2
          ? services.length > 0
          : index === 7
            ? terms
            : true;
  const optional = [3, 4, 5].includes(index);
  const empty = (index === 3 && !customers.length && !area.trim()) || (index === 4 && !strengths.length) || (index === 5 && prices.every((p) => !p.price.trim()));

  function goNext() {
    setError(null);
    // Beim ersten Mal die Leistungen der gewählten Branche vorschlagen bzw. je Leistung eine Preiszeile anbieten.
    if (index === 1 && !services.length && preset) setServices([...preset.services]);
    if (index === 4 && !prices.length) setPrices(services.slice(0, 10).map((item) => ({ item, price: "", note: "" })));
    setIndex(index + 1);
    toTop();
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await apiFetch("POST", "/api/managed-setup", {
        company,
        firstName,
        lastName,
        email,
        phone,
        address,
        website,
        industry,
        description,
        services,
        customers,
        area,
        strengths,
        prices: prices.filter((p) => p.item.trim() && p.price.trim()),
        tone,
        greeting,
        signature,
        note,
        terms,
        pilot,
        hp,
      });
      setDone(true);
      toTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div ref={top} className="scroll-mt-24 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-white">
          <Check className="size-6" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Vielen Dank, {firstName}!</h2>
        <p className="mt-3 text-muted-foreground">
          Wir richten FallFlow jetzt für {company} ein und prüfen alles persönlich. Sie bekommen innerhalb eines Werktags eine E-Mail an <strong className="text-foreground">{email}</strong> mit Ihrem Zugang.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Dann müssen Sie nur noch ein Passwort festlegen und Ihr E-Mail-Postfach verbinden – auf Wunsch gemeinsam mit uns am Telefon.</p>
      </div>
    );
  }

  let title = "";
  let hint = "";
  let body: ReactNode = null;
  switch (index) {
    case 0:
      title = "Wie heißt Ihr Betrieb – und wie erreichen wir Sie?";
      hint = "An diese E-Mail-Adresse schicken wir Ihren Zugang, sobald alles eingerichtet ist.";
      body = (
        <div className="space-y-4">
          <Field label="Name Ihres Betriebs">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="z. B. Dachdeckerei Müller" maxLength={120} autoComplete="organization" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vorname">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </Field>
            <Field label="Nachname">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} autoComplete="family-name" />
            </Field>
          </div>
          <Field label="E-Mail-Adresse">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" />
          </Field>
          <Field label="Telefon" hint="Falls wir eine Rückfrage haben.">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" />
          </Field>
          {/* Unsichtbar – nur Spam-Bots füllen dieses Feld aus. */}
          <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden="true" />
        </div>
      );
      break;
    case 1:
      title = "Was macht Ihr Betrieb?";
      hint = "Tippen Sie Ihre Branche an und beschreiben Sie kurz, was Sie anbieten.";
      body = (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={industry === p.id}
                onClick={() => setIndustry(industry === p.id ? "" : p.id)}
                className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", industry === p.id ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50")}
              >
                {p.title}
              </button>
            ))}
          </div>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="z. B. Wir sind ein Malerbetrieb aus Gräfelfing und streichen Wohnungen, Treppenhäuser und Fassaden." maxLength={1500} />
          <Field label="Adresse Ihres Betriebs (optional)">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Straße Nr., PLZ Ort" maxLength={200} autoComplete="street-address" />
          </Field>
          <Field label="Website (optional)" hint="Wenn vorhanden, lesen wir sie für die Einrichtung mit.">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.ihr-betrieb.de" maxLength={200} />
          </Field>
        </div>
      );
      break;
    case 2:
      title = "Welche Leistungen bieten Sie an?";
      hint = "Antippen zum An- oder Abwählen, fehlende einfach ergänzen. Danach erkennt FallFlow, was der Kunde möchte.";
      body = <Chips options={serviceOptions} selected={services} onChange={setServices} addPlaceholder="Leistung ergänzen, z. B. Fassadenanstrich" />;
      break;
    case 3:
      title = "Wer sind Ihre Kunden – und wo sind Sie unterwegs?";
      hint = "So trifft FallFlow den richtigen Ton und kann Fragen zum Einsatzgebiet beantworten.";
      body = (
        <div className="space-y-6">
          <Chips options={CUSTOMERS} selected={customers} onChange={setCustomers} addPlaceholder="Andere Kunden, z. B. Gastronomie" />
          <div className="space-y-3">
            <p className="text-sm font-medium">Einsatzgebiet</p>
            {city && (
              <div className="flex flex-wrap gap-2">
                {[city, `${city} und 20 km Umkreis`, `${city} und 50 km Umkreis`].map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={area === o}
                    onClick={() => setArea(o)}
                    className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", area === o ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50")}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="z. B. München und Landkreis" maxLength={200} />
          </div>
        </div>
      );
      break;
    case 4:
      title = "Was macht Ihren Betrieb besonders?";
      hint = "FallFlow erwähnt das passend in den Antworten – nur, was Sie hier angeben.";
      body = <Chips options={STRENGTHS} selected={strengths} onChange={setStrengths} addPlaceholder="z. B. Seit 1998 in Gräfelfing" />;
      break;
    case 5:
      title = "Gibt es Preise, die FallFlow Kunden nennen darf?";
      hint = "Nur feste Preise, die Sie so auch am Telefon sagen würden (z. B. „ab 120 €“). FallFlow nennt sie wörtlich. Leer lassen = Preisfragen beantworten Sie selbst.";
      body = (
        <div className="space-y-3">
          {prices.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_9rem_1fr] sm:border-0 sm:p-0">
              <Input value={x.item} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, item: e.target.value } : y)))} placeholder="Leistung" maxLength={80} aria-label="Leistung" />
              <Input value={x.price} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, price: e.target.value } : y)))} placeholder="z. B. ab 120 €" maxLength={40} aria-label={`Preis für ${x.item || "Leistung"}`} />
              <Input value={x.note} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, note: e.target.value } : y)))} placeholder="Hinweis (optional)" maxLength={160} aria-label="Hinweis" />
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Weitere Leistung, z. B. Anfahrt" maxLength={80} />
            <Button
              type="button"
              variant="secondary"
              disabled={!newPrice.trim()}
              onClick={() => {
                setPrices([...prices, { item: newPrice.trim(), price: "", note: "" }]);
                setNewPrice("");
              }}
              aria-label="Hinzufügen"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      );
      break;
    case 6:
      title = "Wie sprechen Sie mit Ihren Kunden?";
      hint = "So klingen Ihre automatischen Antworten.";
      body = (
        <div className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tone === t.id}
                onClick={() => setTone(t.id)}
                className={cn("rounded-xl border p-4 text-left transition-colors", tone === t.id ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border bg-card hover:border-accent/50")}
              >
                <span className="block font-semibold">{t.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.example}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Anrede</p>
            <div className="flex flex-wrap gap-2">
              {GREETINGS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={greeting === g.id}
                  onClick={() => setGreeting(g.id)}
                  className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", greeting === g.id ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50")}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Mit welchem Namen unterschreiben Sie?" hint={`Leer lassen = Ihr Firmenname${company ? ` „${company}“` : ""}.`}>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={firstName && company ? `z. B. ${firstName} – ${company}` : ""} maxLength={120} />
          </Field>
        </div>
      );
      break;
    case 7:
      title = "Fast geschafft";
      hint = "So geht es weiter:";
      body = (
        <div className="space-y-5">
          <ol className="space-y-2 text-sm">
            {[
              "FallFlow richtet Ihr Konto mit Ihren Angaben ein – Leistungen, Rückfragen an Kunden, Texte für jede Leistung.",
              "Wir prüfen alles persönlich und melden uns bei Rückfragen.",
              "Sie bekommen innerhalb eines Werktags Ihren Zugang per E-Mail, legen ein Passwort fest und verbinden Ihr Postfach – gern gemeinsam am Telefon.",
              `Danach testen Sie FallFlow ${trialText} kostenlos. Ohne Zahlungsdaten, endet automatisch.`,
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <Field label="Noch etwas, das wir wissen sollten? (optional)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Bitte rufen Sie mich nachmittags an." maxLength={1000} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
            <span>
              Ich akzeptiere die{" "}
              <Link href="/agb" target="_blank" className="font-medium underline">
                AGB
              </Link>{" "}
              und den{" "}
              <Link href="/avv" target="_blank" className="font-medium underline">
                Auftragsverarbeitungsvertrag (AVV)
              </Link>{" "}
              und habe die{" "}
              <Link href="/datenschutz" target="_blank" className="font-medium underline">
                Datenschutzerklärung
              </Link>{" "}
              gelesen.
            </span>
          </label>
        </div>
      );
      break;
  }

  return (
    <div ref={top} className="scroll-mt-24">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Schritt {index + 1} von {TOTAL}
          </span>
          {optional && <span>optional</span>}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + 1) / TOTAL) * 100}%` }} />
        </div>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-balance">{title}</h2>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{hint}</p>
      {body}
      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center justify-between">
        {index > 0 ? (
          <Button variant="ghost" onClick={() => (setIndex(index - 1), toTop())} disabled={pending}>
            <ArrowLeft className="size-4" /> Zurück
          </Button>
        ) : (
          <span />
        )}
        {index < TOTAL - 1 ? (
          <Button onClick={goNext} disabled={!canNext}>
            {optional && empty ? "Überspringen" : "Weiter"} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={submit} loading={pending} disabled={!canNext}>
            Einrichten lassen <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
