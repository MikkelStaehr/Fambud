'use client';

// Adresse-fieldset med DAWA autocomplete. Bruges af /signup, /join/[code]
// og /indstillinger til både bopæls- og arbejdsplads-adresser.
//
// DAWA = Danmarks Adresseregister (api.dataforsyningen.dk). Public API,
// ingen nøgle. Vi henter forslag når brugeren har skrevet >=3 tegn,
// debounced 200ms. Klik på et forslag fylder gade+postnr+by automatisk.
//
// Vi beholder den manuelle indtastning som fallback - hvis DAWA er nede
// eller ikke matcher, kan brugeren stadig taste i alle 3 felter manuelt.
// Ingen validering på submit; appen accepterer hvad bruger taster.

import { useEffect, useRef, useState } from 'react';

type DawaSuggestion = {
  tekst: string;
  adresse: {
    id: string;
    vejnavn: string;
    husnr: string;
    etage: string | null;
    dør: string | null;
    postnr: string;
    postnrnavn: string;
  };
};

type Props = {
  legend: string;
  // Form-navne bygges som ${namePrefix}_address, _zip_code, _city.
  // Fx 'home' giver felter med name='home_address'.
  namePrefix: string;
  defaults?: {
    address?: string | null;
    zip_code?: string | null;
    city?: string | null;
  };
  hint?: string;
};

function formatStreet(a: DawaSuggestion['adresse']): string {
  let s = `${a.vejnavn} ${a.husnr}`;
  if (a.etage) {
    s += `, ${a.etage}.`;
    if (a.dør) s += a.dør;
  }
  return s;
}

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export function DawaAddressInput({
  legend,
  namePrefix,
  defaults,
  hint,
}: Props) {
  const [address, setAddress] = useState(defaults?.address ?? '');
  const [zipCode, setZipCode] = useState(defaults?.zip_code ?? '');
  const [city, setCity] = useState(defaults?.city ?? '');
  const [suggestions, setSuggestions] = useState<DawaSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hent DAWA-forslag når brugeren har tastet >=3 tegn. Debounced 200ms.
  // Vi annullerer in-flight requests hvis brugeren taster videre - undgår
  // race conditions hvor et gammelt svar overskriver et nyere.
  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const url =
          'https://api.dataforsyningen.dk/adresser/autocomplete?per_side=8&q=' +
          encodeURIComponent(trimmed);
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as DawaSuggestion[];
        setSuggestions(data);
        setActiveIndex(-1);
      } catch (err) {
        // AbortError er forventet ved hurtig tastning - ignorér stille
        if ((err as Error).name !== 'AbortError') {
          // Stille fejl - DAWA-nedbrud må ikke blokere signup
          setSuggestions([]);
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [address]);

  // Klik udenfor lukker dropdown'en
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function selectSuggestion(s: DawaSuggestion) {
    setAddress(formatStreet(s.adresse));
    setZipCode(s.adresse.postnr);
    setCity(s.adresse.postnrnavn);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50/50 p-3">
      <legend className="px-1 text-xs font-medium text-neutral-600">
        {legend}
      </legend>
      <div ref={wrapperRef} className="relative">
        <label htmlFor={`${namePrefix}_address`} className={labelClass}>
          Adresse <span className="text-neutral-400">(evt. etage)</span>
        </label>
        <input
          id={`${namePrefix}_address`}
          name={`${namePrefix}_address`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Vesterbrogade 12, 3.tv"
          className={fieldClass}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
            {suggestions.map((s, i) => (
              <li
                key={s.adresse.id}
                onMouseDown={(e) => {
                  // mousedown frem for click - undgår at input mister focus
                  // før vi når at vælge.
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === activeIndex
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {s.tekst}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label htmlFor={`${namePrefix}_zip_code`} className={labelClass}>
            Postnr.
          </label>
          <input
            id={`${namePrefix}_zip_code`}
            name={`${namePrefix}_zip_code`}
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{4}"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="1620"
            className={fieldClass}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor={`${namePrefix}_city`} className={labelClass}>
            By
          </label>
          <input
            id={`${namePrefix}_city`}
            name={`${namePrefix}_city`}
            type="text"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="København V"
            className={fieldClass}
          />
        </div>
      </div>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </fieldset>
  );
}
