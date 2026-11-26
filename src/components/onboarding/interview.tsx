"use client";

import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { EMPTY_DRAFT, type ProfileDraft } from "@/components/onboarding/business-profile-editor";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";
import type { Tone } from "@/lib/data/types";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Einrichtungs-Gespräch: eine Frage pro Bildschirm, mit Antworten zum Antippen. Jede Antwort wird beim "Weiter" gespeichert
 * (Betriebsprofil bzw. /api/onboarding/interview) – daraus schreibt FallFlow danach die Texte für jede Leistung.
 */

type Greeting = "guten-tag" | "hallo" | "sehr-geehrte";

export interface InterviewInitial {
  customers: string[];
  area: string;
  strengths: string[];
  faqs: { q: string; a: string }[];
  prices: { item: string; price: string; note?: string }[];
  tone: Tone;
  greeting: Greeting;
  signature: string;
}

interface Props {
  profile: ProfileDraft;
  onProfile: (p: ProfileDraft) => void;
  company: { name: string; website: string; address: string };
  firstName: string;
  initial: InterviewInitial;
  onDone: () => void;
  onBack: () => void;
}

const CUSTOMERS = ["Privatkunden", "Hausverwaltungen", "Vermieter & Eigentümer", "Firmen & Gewerbe", "Öffentliche Auftraggeber", "Architekten & Planer"];
const STRENGTHS = ["Meisterbetrieb", "Familienbetrieb", "Seit über 10 Jahren am Markt", "Schnelle Termine", "Notdienst", "Feste Ansprechpartner", "Saubere, ordentliche Arbeit", "Kostenlose Besichtigung"];
const HUMAN_TOPICS = ["Preise und Kosten", "Notfälle", "Reklamationen", "Sonderwünsche", "Terminänderungen", "Rechtliche Fragen"];
const FAQ_SUGGESTIONS = ["Wie schnell bekomme ich einen Termin?", "Machen Sie auch kleine Aufträge?", "Arbeiten Sie auch samstags?"];
const TONES: { id: Tone; title: string; example: string }[] = [
  { id: "friendly", title: "Freundlich", example: "„vielen Dank für Ihre Anfrage – wir kümmern uns gern darum.“" },
  { id: "professional", title: "Sachlich", example: "„vielen Dank für Ihre Anfrage. Wir prüfen Ihr Anliegen.“" },
  { id: "short", title: "Kurz & knapp", example: "„danke für Ihre Anfrage.“" },
];
const GREETINGS: { id: Greeting; label: string }[] = [
  { id: "guten-tag", label: "Guten Tag Maria Müller," },
  { id: "hallo", label: "Hallo Maria Müller," },
  { id: "sehr-geehrte", label: "Sehr geehrte/r Maria Müller," },
];
const TOTAL = 10;

/** Antippbare Auswahl (mehrere möglich) plus eigene Einträge. */
function Chips({ options, selected, onChange, addPlaceholder, locked = [] }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; addPlaceholder: string; locked?: string[] }) {
  const [draft, setDraft] = useState("");
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  const toggle = (o: string) => {
    if (locked.includes(o)) return;
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  };
  const add = () => {
    const v = draft.trim();
    if (v && !selected.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...selected, v]);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {all.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                on ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50",
                locked.includes(o) && "cursor-default",
              )}
            >
              {on && <Check className="size-3.5" />} {o}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder={addPlaceholder} />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()} aria-label="Hinzufügen">
          <Plus className="size-4" /> <span className="hidden sm:inline">Hinzufügen</span>
        </Button>
      </div>
    </div>
  );
}

/** Ort aus der Adresse ("Lindenweg 7, 82166 Gräfelfing" → "Gräfelfing"). */
const cityOf = (address: string) => address.match(/\b\d{5}\s+([^,\d]+)/)?.[1]?.trim() ?? "";

export function Interview({ profile, onProfile, company, firstName, initial, onDone, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Frage 1
  const [industryPick, setIndustryPick] = useState<string>(INDUSTRY_PRESETS.find((p) => p.industry === profile.industry)?.id ?? "");
  const [about, setAbout] = useState(profile.description);
  const [describedFor, setDescribedFor] = useState(profile.services.length ? `${industryPick}|${profile.description}` : "");
  const [useWebsite, setUseWebsite] = useState(Boolean(company.website));
  // Vorschläge der KI bzw. Vorlage merken, damit abgewählte Leistungen/Angaben wieder auswählbar sind.
  const [offeredServices, setOfferedServices] = useState<string[]>(profile.services);
  const [offeredFields, setOfferedFields] = useState(profile.fields);
  const [offeredDocs, setOfferedDocs] = useState<string[]>(profile.documents);
  // Weitere Antworten
  const [customers, setCustomers] = useState(initial.customers);
  const city = cityOf(company.address);
  const [area, setArea] = useState(initial.area);
  const [strengths, setStrengths] = useState(initial.strengths);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>(() => {
    const own = initial.faqs.filter((f) => !FAQ_SUGGESTIONS.includes(f.q) && f.q !== "In welchem Gebiet sind Sie tätig?");
    return [...FAQ_SUGGESTIONS.map((q) => ({ q, a: initial.faqs.find((f) => f.q === q)?.a ?? "" })), ...own];
  });
  const [newFaq, setNewFaq] = useState("");
  // Preise, die FallFlow nennen darf: gespeicherte Zeilen, sonst je Leistung eine leere Zeile zum Ausfüllen.
  const [prices, setPrices] = useState<{ item: string; price: string; note: string }[]>(() =>
    initial.prices.length ? initial.prices.map((x) => ({ item: x.item, price: x.price, note: x.note ?? "" })) : [],
  );
  const [newPrice, setNewPrice] = useState("");
  const [tone, setTone] = useState<Tone>(initial.tone);
  const [greeting, setGreeting] = useState<Greeting>(initial.greeting);
  const [signature, setSignature] = useState(initial.signature);

  const set = (patch: Partial<ProfileDraft>) => onProfile({ ...profile, ...patch });
  const saveProfile = (p: ProfileDraft) => apiFetch("PUT", "/api/business-profile", p);
  const saveAnswer = (body: Record<string, unknown>) => apiFetch("POST", "/api/onboarding/interview", body);

  /** Frage 1 → Vorschlag der KI (mit Branche, Beschreibung und ggf. Website); geht das nicht, die Branchen-Vorlage. */
  async function describe(): Promise<boolean> {
    const preset = INDUSTRY_PRESETS.find((p) => p.id === industryPick);
    const key = `${industryPick}|${about}`;
    if (key === describedFor && profile.services.length) return true;
    const description = [preset ? `Branche: ${preset.title}.` : "", about].filter(Boolean).join(" ");
    let draft: ProfileDraft | null = null;
    try {
      const { suggestion } = await apiFetch<{ suggestion: ProfileDraft }>("POST", "/api/business-profile/suggest", { description, website: useWebsite ? company.website : "" });
      draft = { ...suggestion, description: about || suggestion.description };
    } catch (e) {
      if (!preset) {
        setError(e instanceof Error ? e.message : "Der Vorschlag konnte nicht erstellt werden.");
        return false;
      }
    }
    if (!draft && preset) {
      draft = {
        industry: preset.industry,
        description: about || preset.description,
        services: [...preset.services],
        fields: preset.fields.map((x) => ({ ...x, services: [...x.services] })),
        documents: [...preset.documents],
        documentsByService: { ...preset.documentsByService },
        humanTopics: [...preset.humanTopics],
        needsAddress: preset.needsAddress,
      };
    }
    const next = draft ?? EMPTY_DRAFT;
    if (!next.humanTopics.includes("Preise und Kosten")) next.humanTopics = ["Preise und Kosten", ...next.humanTopics];
    onProfile(next);
    setOfferedServices(next.services);
    setOfferedFields(next.fields);
    setOfferedDocs(next.documents);
    setDescribedFor(key);
    return true;
  }

  async function next() {
    setPending(true);
    setError(null);
    try {
      if (index === 0 && !(await describe())) return;
      if (index === 1 || index === 5 || index === 9) await saveProfile(profile);
      if (index === 2) await saveAnswer({ step: "customers", values: customers });
      if (index === 3) await saveAnswer({ step: "area", value: area.trim() });
      if (index === 4) await saveAnswer({ step: "strengths", values: strengths });
      if (index === 6) await saveAnswer({ step: "faqs", faqs: faqs.filter((f) => f.q.trim().length >= 3).map((f) => ({ q: f.q.trim(), a: f.a.trim() })) });
      if (index === 7) await saveAnswer({ step: "prices", prices: prices.filter((x) => x.item.trim() && x.price.trim()).map((x) => ({ item: x.item.trim(), price: x.price.trim(), note: x.note.trim() })) });
      if (index === 8) await saveAnswer({ step: "tone", tone, greeting, signature: signature.trim() });
      if (index === 6 && prices.length === 0) setPrices(profile.services.filter((x) => x !== "Sonstiges").slice(0, 10).map((item) => ({ item, price: "", note: "" })));
      if (index === TOTAL - 1) onDone();
      else setIndex(index + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  const canNext = index === 0 ? Boolean(industryPick || about.trim() || (useWebsite && company.website)) : index === 1 ? profile.services.length > 0 : true;
  const optional = [2, 3, 4, 6, 7].includes(index);

  let title = "";
  let hint = "";
  let body: ReactNode = null;
  switch (index) {
    case 0:
      title = "Was macht Ihr Betrieb?";
      hint = "Tippen Sie Ihre Branche an und beschreiben Sie in 1–2 Sätzen, was Sie anbieten. Daraus schlägt die KI Ihre Leistungen vor.";
      body = (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={industryPick === p.id}
                onClick={() => setIndustryPick(industryPick === p.id ? "" : p.id)}
                className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", industryPick === p.id ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50")}
              >
                {p.title}
              </button>
            ))}
          </div>
          <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="z. B. Wir sind ein Malerbetrieb aus Gräfelfing und streichen Wohnungen, Treppenhäuser und Fassaden – vor allem für Privatkunden und Hausverwaltungen." />
          {company.website && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useWebsite} onChange={(e) => setUseWebsite(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Auch meine Website lesen ({company.website.replace(/^https?:\/\//, "")})
            </label>
          )}
          {pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 animate-pulse" /> Die KI schaut sich Ihren Betrieb an …
            </p>
          )}
        </div>
      );
      break;
    case 1:
      title = "Welche Leistungen bieten Sie an?";
      hint = "Antippen zum Ab- oder Anwählen, fehlende einfach ergänzen. So erkennt FallFlow, was der Kunde möchte.";
      body = <Chips options={offeredServices} selected={profile.services} onChange={(services) => set({ services })} addPlaceholder="Leistung ergänzen, z. B. Fassadenanstrich" />;
      break;
    case 2:
      title = "Wer sind Ihre Kunden?";
      hint = "Mehrere möglich. So trifft FallFlow in den Antworten den richtigen Ton.";
      body = <Chips options={CUSTOMERS} selected={customers} onChange={setCustomers} addPlaceholder="Andere Kunden, z. B. Gastronomie" />;
      break;
    case 3:
      title = "Wo sind Sie unterwegs?";
      hint = "Ihr Einsatzgebiet – FallFlow nennt es Kunden, die danach fragen.";
      body = (
        <div className="space-y-3">
          {city && (
            <div className="flex flex-wrap gap-2">
              {[`${city}`, `${city} und 20 km Umkreis`, `${city} und 50 km Umkreis`, "ganz Bayern"].map((o) => (
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
      );
      break;
    case 4:
      title = "Was macht Ihren Betrieb besonders?";
      hint = "Das, was Kunden über Sie wissen sollten. FallFlow erwähnt es passend in den Antworten – nur, was Sie hier angeben.";
      body = <Chips options={STRENGTHS} selected={strengths} onChange={setStrengths} addPlaceholder="z. B. Seit 1998 in Gräfelfing" />;
      break;
    case 5:
      title = "Was brauchen Sie vom Kunden, bevor Sie ein Angebot machen?";
      hint = "Name, E-Mail, Telefon und Adresse fragt FallFlow immer ab. Hier geht es um alles Weitere – FallFlow fragt nur danach, was Sie angetippt haben.";
      body = (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Angaben</p>
            <Chips
              options={offeredFields.map((f) => f.label)}
              selected={profile.fields.map((f) => f.label)}
              onChange={(labels) =>
                set({
                  fields: labels.map((label) => profile.fields.find((f) => f.label === label) ?? offeredFields.find((f) => f.label === label) ?? { key: "", label, prompt: `${label}?`, required: false }),
                })
              }
              addPlaceholder="z. B. Größe der Fläche in m²"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Unterlagen und Fotos</p>
            <Chips options={offeredDocs} selected={profile.documents} onChange={(documents) => set({ documents })} addPlaceholder="z. B. Fotos vom Schaden" />
          </div>
        </div>
      );
      break;
    case 6:
      title = "Welche Fragen bekommen Sie oft – und was antworten Sie?";
      hint = "Nur ausfüllen, was Sie wirklich so sagen würden. Leere Felder werden nicht verwendet. Preise kommen auf der nächsten Seite.";
      body = (
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={f.q} className="space-y-1.5">
              <p className="text-sm font-medium">{f.q}</p>
              <Textarea rows={2} value={f.a} onChange={(e) => setFaqs(faqs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} placeholder="Ihre Antwort (optional)" maxLength={600} />
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newFaq} onChange={(e) => setNewFaq(e.target.value)} placeholder="Eigene Frage hinzufügen" maxLength={200} />
            <Button
              type="button"
              variant="secondary"
              disabled={newFaq.trim().length < 3}
              onClick={() => {
                setFaqs([...faqs, { q: newFaq.trim(), a: "" }]);
                setNewFaq("");
              }}
            >
              <Plus className="size-4" /> <span className="hidden sm:inline">Hinzufügen</span>
            </Button>
          </div>
        </div>
      );
      break;
    case 7:
      title = "Gibt es Preise, die FallFlow Kunden nennen darf?";
      hint = "Nur feste Preise, die Sie so auch am Telefon sagen würden (z. B. „ab 120 €“). FallFlow nennt sie wörtlich – ohne zu schätzen oder zu rechnen. Leer lassen = Preisfragen beantworten Sie selbst.";
      body = (
        <div className="space-y-3">
          {prices.map((x, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr]">
              <Input value={x.item} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, item: e.target.value } : y)))} placeholder="Leistung" maxLength={80} aria-label="Leistung" />
              <Input value={x.price} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, price: e.target.value } : y)))} placeholder="z. B. ab 120 €" maxLength={40} aria-label={`Preis für ${x.item || "Leistung"}`} />
              <Input value={x.note} onChange={(e) => setPrices(prices.map((y, k) => (k === i ? { ...y, note: e.target.value } : y)))} placeholder="Hinweis (optional), z. B. je m²" maxLength={160} aria-label="Hinweis" />
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
            >
              <Plus className="size-4" /> <span className="hidden sm:inline">Hinzufügen</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Später jederzeit änderbar unter KI-Assistent → Wissen & Preise.</p>
        </div>
      );
      break;
    case 8:
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
            <p className="text-sm font-medium">Anrede</p>
            <p className="mb-2 text-xs text-muted-foreground">FallFlow nimmt den Namen so, wie der Kunde ihn angibt.</p>
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
          <div>
            <p className="mb-1 text-sm font-medium">Mit welchem Namen unterschreiben Sie?</p>
            <p className="mb-2 text-xs text-muted-foreground">Leer lassen = Ihr Firmenname „{company.name}“.</p>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={firstName ? `z. B. ${firstName} – ${company.name}` : company.name} maxLength={120} />
          </div>
        </div>
      );
      break;
    case 9:
      title = "Worum kümmern Sie sich lieber selbst?";
      hint = "Fragt ein Kunde dazu, antwortet nicht die KI – Sie bekommen Bescheid und antworten persönlich. Preise aus Ihrer Preisliste nennt FallFlow selbst, alle anderen Preisfragen beantworten Sie.";
      body = (
        <Chips
          options={[...new Set([...HUMAN_TOPICS, ...profile.humanTopics])]}
          selected={profile.humanTopics}
          onChange={(humanTopics) => set({ humanTopics })}
          addPlaceholder="z. B. Versicherungsschäden"
          locked={["Preise und Kosten"]}
        />
      );
      break;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Frage {index + 1} von {TOTAL}
          </span>
          {optional && <span>optional</span>}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + 1) / TOTAL) * 100}%` }} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{hint}</p>
      {body}
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => (index === 0 ? onBack() : setIndex(index - 1))} disabled={pending}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        <Button onClick={next} loading={pending} disabled={!canNext}>
          {optional && isEmpty(index, { customers, area, strengths, faqs, prices }) ? "Überspringen" : "Weiter"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function isEmpty(index: number, s: { customers: string[]; area: string; strengths: string[]; faqs: { a: string }[]; prices: { price: string }[] }) {
  if (index === 2) return s.customers.length === 0;
  if (index === 3) return !s.area.trim();
  if (index === 4) return s.strengths.length === 0;
  if (index === 6) return s.faqs.every((f) => !f.a.trim());
  if (index === 7) return s.prices.every((x) => !x.price.trim());
  return false;
}
