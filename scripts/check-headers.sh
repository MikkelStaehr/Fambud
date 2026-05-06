#!/usr/bin/env bash
#
# Verificerer at production-deploy serverer alle required security
# headers. Sættes ind i CI (.github/workflows/headers-check.yml) men
# kan også køres lokalt:
#
#   bash scripts/check-headers.sh https://www.fambud.dk
#
# Hvert header-tjek er en eksplicit assertion. Hvis nogen flytter sig
# ud af tolerance, fejler scriptet med tydelig output. Skema'et matcher
# next.config.ts + SECURITY_AUDITS.md Prompt 2 + Prompt 11.

set -uo pipefail

URL="${1:-https://www.fambud.dk}"

echo "=== Headers check mod $URL ==="

HEADERS=$(curl -sI "$URL")

# Hjælpefunktion: tjek at en header indeholder en given streng.
# Bruger bash-native substring-match - undgår grep -q i pipe-kæder
# (kombineret med set -e + pipefail giver det "Aborted"-fejl).
assert_contains() {
    local name="$1"
    local needle="$2"
    # Find linjen med case-insensitive header-name-match. Vi bruger
    # awk i stedet for grep så pipe-fejl ikke aborterer scriptet.
    local line
    line=$(awk -v IGNORECASE=1 -v hdr="^${name}:" '$0 ~ hdr' <<< "$HEADERS")
    if [ -z "$line" ]; then
        echo "FAIL: $name header mangler helt"
        return 1
    fi
    # Bash-native substring match (case-sensitive på værdi).
    if [[ "$line" != *"$needle"* ]]; then
        echo "FAIL: $name mangler '$needle'"
        echo "      Faktisk værdi: $line"
        return 1
    fi
    echo "OK:   $name indeholder '$needle'"
}

# Hjælpefunktion: tjek at en header er FRAVÆRENDE.
assert_absent() {
    local name="$1"
    local line
    line=$(awk -v IGNORECASE=1 -v hdr="^${name}:" '$0 ~ hdr' <<< "$HEADERS")
    if [ -n "$line" ]; then
        echo "FAIL: $name header bør ikke være sat (info-disclosure)"
        echo "      Faktisk værdi: $line"
        return 1
    fi
    echo "OK:   $name fraværende"
}

failures=0

# CSP — fuld streng-match på de vigtigste direktiver.
assert_contains "Content-Security-Policy" "default-src 'self'" || ((failures++))
assert_contains "Content-Security-Policy" "frame-ancestors 'none'" || ((failures++))
assert_contains "Content-Security-Policy" "object-src 'none'" || ((failures++))
assert_contains "Content-Security-Policy" "upgrade-insecure-requests" || ((failures++))
assert_contains "Content-Security-Policy" "form-action 'self'" || ((failures++))
assert_contains "Content-Security-Policy" "base-uri 'self'" || ((failures++))

# HSTS — minimum 1 år (Vercel default 63072000=2 år) + includeSubDomains.
# preload deferret til P4 (efter varmeperiode).
assert_contains "Strict-Transport-Security" "max-age=" || ((failures++))
assert_contains "Strict-Transport-Security" "includeSubDomains" || ((failures++))

# Klassiske XSS/clickjacking-headers.
assert_contains "X-Frame-Options" "DENY" || ((failures++))
assert_contains "X-Content-Type-Options" "nosniff" || ((failures++))
assert_contains "Referrer-Policy" "strict-origin-when-cross-origin" || ((failures++))

# Permissions-Policy — låser sensitive APIer ned.
assert_contains "Permissions-Policy" "camera=()" || ((failures++))
assert_contains "Permissions-Policy" "microphone=()" || ((failures++))
assert_contains "Permissions-Policy" "geolocation=()" || ((failures++))

# Headers der IKKE må være sat (info-disclosure / fingerprinting).
# X-Powered-By: Next.js fjerner via poweredByHeader: false.
# Server: Vercel sætter "Server: Vercel" som vi ikke kan kontrollere -
# det skipper vi i denne version (overflade-kompromis vs. praktisk
# kontrol; ikke deal-breaker for sikkerhed).
assert_absent "X-Powered-By" || ((failures++))

echo ""
echo "=== Resultat ==="
if [ "$failures" -eq 0 ]; then
    echo "Alle headers OK"
    exit 0
else
    echo "$failures header(s) failed"
    exit 1
fi
