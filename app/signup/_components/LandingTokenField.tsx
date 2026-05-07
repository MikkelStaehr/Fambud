'use client';

// Skjult input på signup-form'en der bærer landing-flow-tokenen videre
// til server-actionen. Token'en er sat i localStorage af
// LandingFlowModalTrigger på fambud.dk når brugeren rammer Step 3.
// Hvis ingen token findes (brugeren kom direkte til /signup), sendes
// inputtet bare med en tom værdi.
//
// SECURITY: signup-actionen validerer formatet (UUID v4-mønster) før
// den kalder link_landing_submission RPC'en, så et ondsindet tokenværdi
// her kan ikke skrive til andre brugeres rækker.
//
// Hydration: localStorage er kun tilgængelig på klienten. Vi renderer
// først tom-input på SSR + initial hydrate, og opdaterer derefter med
// tokenværdien. Det giver en kort flicker hvor input er tomt, men da
// formularen er hidden er der intet visuelt at se.

import { useEffect, useRef } from 'react';

const TOKEN_STORAGE_KEY = 'fambud-landing-token';

export function LandingTokenField() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Skriv tokenen direkte til DOM-noden via ref - undgår en setState-i-
  // effect-runde og dermed lint-reglen 'set-state-in-effect'. Det er
  // sikkert her fordi inputtet er hidden og ikke kontrolleret af React
  // efter mount; React renderer aldrig om dette specifikke felt.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored && inputRef.current) {
        inputRef.current.value = stored;
      }
    } catch {
      // localStorage blokeret - drop attribuering, ikke kritisk.
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="hidden"
      name="landing_flow_token"
      defaultValue=""
    />
  );
}
