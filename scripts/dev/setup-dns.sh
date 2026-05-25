#!/bin/bash
# One-time host DNS setup for composable.env projects (macOS).
#
# Reads ce.json profile domains and configures dnsmasq + /etc/resolver/
# so *.{tld} resolves to 127.0.0.1 with no /etc/hosts edits.
# Skips OrbStack-managed .orb.local domains (OrbStack owns those).
#
# Idempotent — re-run anytime ce.json profile domains change.
# Requires: macOS, Homebrew, sudo for /etc/resolver writes.

set -euo pipefail

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "setup-dns.sh is macOS-only (uses /etc/resolver). For Linux, edit /etc/resolv.conf or use systemd-resolved."
  exit 1
fi

if [ ! -f ce.json ]; then
  echo "ce.json not found. Run this from the project root."
  exit 1
fi

# Extract unique TLDs from ce.json profiles[].domain (everything after the
# first dot). Skip *.orb.local — OrbStack handles those. Skip public TLDs
# (staging/production domains pointing at real DNS) so we never blackhole
# .com / .io / .dev / etc. into 127.0.0.1.
TLDS=$(node -e '
const cfg = require("./ce.json");
// Curated set of real public TLDs whose presence in ce.json means a
// staging/prod domain — never route them to 127.0.0.1. Extend as needed.
const PUBLIC_TLDS = new Set([
  "com", "net", "org", "io", "dev", "app", "co", "me", "ai", "so",
  "tv", "cc", "us", "uk", "de", "jp", "cn", "in", "fr", "it", "es",
  "ru", "br", "au", "ca", "nl", "eu", "biz", "info", "gov", "edu",
  "xyz", "sh", "site", "tech", "online", "store", "live", "world",
]);
const tlds = new Set();
for (const p of Object.values(cfg.profiles || {})) {
  if (!p.domain) continue;
  if (p.domain.endsWith(".orb.local")) continue;
  const parts = p.domain.split(".");
  if (parts.length < 2) continue;
  const tld = parts[parts.length - 1];
  if (PUBLIC_TLDS.has(tld.toLowerCase())) continue;
  // For multi-label domains like "stg.example.test", route the TLD
  // ("test"), not the whole suffix — dnsmasq address=/test/ catches
  // every subdomain under it.
  tlds.add(tld);
}
console.log([...tlds].join("\n"));
')

if [ -z "$TLDS" ]; then
  echo "No domains in ce.json profiles need local DNS (or all use .orb.local)."
  echo "Add a profile with a custom domain (e.g., \"domain\": \"myapp.local\") first."
  exit 0
fi

echo "Setting up local DNS for TLDs: $(echo $TLDS | tr '\n' ' ')"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install from https://brew.sh"
  exit 1
fi

if ! command -v dnsmasq >/dev/null 2>&1; then
  echo "Installing dnsmasq..."
  brew install dnsmasq
fi

DNSMASQ_CONF="$(brew --prefix)/etc/dnsmasq.conf"
if [ ! -f "$DNSMASQ_CONF" ]; then
  mkdir -p "$(dirname "$DNSMASQ_CONF")"
  touch "$DNSMASQ_CONF"
fi

while IFS= read -r tld; do
  [ -z "$tld" ] && continue
  ADDR_LINE="address=/$tld/127.0.0.1"
  if grep -qxF "$ADDR_LINE" "$DNSMASQ_CONF" 2>/dev/null; then
    echo "  dnsmasq.conf: $tld already configured"
  else
    echo "$ADDR_LINE" >> "$DNSMASQ_CONF"
    echo "  dnsmasq.conf: added $tld -> 127.0.0.1"
  fi
done <<< "$TLDS"

echo "Restarting dnsmasq (sudo required)..."
sudo brew services restart dnsmasq >/dev/null

sudo mkdir -p /etc/resolver
while IFS= read -r tld; do
  [ -z "$tld" ] && continue
  RESOLVER_FILE="/etc/resolver/$tld"
  EXPECTED="nameserver 127.0.0.1"
  if [ -f "$RESOLVER_FILE" ] && grep -qxF "$EXPECTED" "$RESOLVER_FILE"; then
    echo "  /etc/resolver/$tld already configured"
  else
    echo "$EXPECTED" | sudo tee "$RESOLVER_FILE" >/dev/null
    echo "  /etc/resolver/$tld written"
  fi
done <<< "$TLDS"

sudo dscacheutil -flushcache 2>/dev/null || true
sudo killall -HUP mDNSResponder 2>/dev/null || true

echo ""
echo "Done. Verify a TLD resolves with: ping -c1 anything.$(echo "$TLDS" | head -n1)"
