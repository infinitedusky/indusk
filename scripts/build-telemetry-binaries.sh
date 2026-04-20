#!/usr/bin/env bash
# build-telemetry-binaries.sh — produce the four platform-specific npm packages
# that bundle upstream Jaeger + OTel Collector (contrib) binaries for the
# local-telemetry extension.
#
# Reads pinned versions + URL templates from
# packages/telemetry-binaries-shared/UPSTREAM.json. For each platform:
#   1. Download the Jaeger + otelcol-contrib tarballs for that platform
#   2. Verify SHA256 against upstream checksums
#   3. Extract the specific binary from each archive
#   4. Stamp it into packages/telemetry-binaries-{platform}/bin/
#   5. Copy collector-config.yaml + jaeger-config.yaml from shared/ into the
#      platform package root
#   6. Copy LICENSE + NOTICE attributing upstream projects
#
# Idempotent: if binaries are already present in bin/ with matching checksums,
# skip the download. Safe to re-run.
#
# Usage:
#   scripts/build-telemetry-binaries.sh                 # build all 4 platforms
#   scripts/build-telemetry-binaries.sh darwin-arm64    # build one platform
#   scripts/build-telemetry-binaries.sh --publish       # build + npm publish
#
# Requires: curl, jq, shasum (macOS) or sha256sum (Linux), tar, node.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_ROOT="$REPO_ROOT/packages"
SHARED_DIR="$PKG_ROOT/telemetry-binaries-shared"
UPSTREAM_JSON="$SHARED_DIR/UPSTREAM.json"
CACHE_DIR="$REPO_ROOT/.cache/telemetry-binaries"

ALL_PLATFORMS=(darwin-arm64 darwin-x64 linux-arm64 linux-x64)
PUBLISH=false
SELECTED_PLATFORMS=()

# ---- arg parsing ----
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=true ;;
    darwin-arm64|darwin-x64|linux-arm64|linux-x64) SELECTED_PLATFORMS+=("$arg") ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//' | head -30
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [[ ${#SELECTED_PLATFORMS[@]} -eq 0 ]]; then
  SELECTED_PLATFORMS=("${ALL_PLATFORMS[@]}")
fi

# ---- deps check ----
for cmd in curl jq tar node; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "missing dep: $cmd" >&2; exit 2; }
done

if command -v sha256sum >/dev/null 2>&1; then
  SHA256_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA256_CMD="shasum -a 256"
else
  echo "need sha256sum (linux) or shasum (macOS)" >&2
  exit 2
fi

mkdir -p "$CACHE_DIR"

# ---- read UPSTREAM.json values ----
JAEGER_VERSION=$(jq -r '.jaeger.version' "$UPSTREAM_JSON")
JAEGER_SRC_TMPL=$(jq -r '.jaeger.source_template' "$UPSTREAM_JSON")
JAEGER_SHA_TMPL=$(jq -r '.jaeger.sha_template' "$UPSTREAM_JSON")
JAEGER_EXTRACT_TMPL=$(jq -r '.jaeger.extract_path' "$UPSTREAM_JSON")

OTELCOL_VARIANT=$(jq -r '.otelcol.variant' "$UPSTREAM_JSON")
OTELCOL_VERSION=$(jq -r '.otelcol.version' "$UPSTREAM_JSON")
OTELCOL_SRC_TMPL=$(jq -r '.otelcol.source_template' "$UPSTREAM_JSON")
OTELCOL_SHA_TMPL=$(jq -r '.otelcol.sha_template' "$UPSTREAM_JSON")
OTELCOL_BINARY=$(jq -r '.otelcol.binary_name' "$UPSTREAM_JSON")

# ---- helpers ----
substitute() {
  # args: template, var=val pairs...
  local tmpl="$1"; shift
  for kv in "$@"; do
    local k="${kv%%=*}"
    local v="${kv#*=}"
    tmpl="${tmpl//\{$k\}/$v}"
  done
  printf '%s' "$tmpl"
}

sha256_of() {
  $SHA256_CMD "$1" | awk '{print $1}'
}

download_with_cache() {
  local url="$1"
  local dest="$2"
  if [[ -f "$dest" ]]; then
    echo "  [cache] $dest"
    return 0
  fi
  echo "  [download] $url"
  curl -fsSL -o "$dest" "$url"
}

verify_sha() {
  local file="$1"
  local expected="$2"
  local actual
  actual=$(sha256_of "$file")
  if [[ "$actual" != "$expected" ]]; then
    echo "  [sha mismatch] $file: expected $expected, got $actual" >&2
    return 1
  fi
  echo "  [sha ok] ${file##*/}"
}

# ---- per-platform build ----
build_platform() {
  local platform="$1"
  echo ""
  echo "=== $platform ==="

  local pkg_dir="$PKG_ROOT/telemetry-binaries-$platform"
  local bin_dir="$pkg_dir/bin"
  mkdir -p "$bin_dir"

  # --- Jaeger ---
  local jp
  jp=$(jq -r ".jaeger.platform_map.\"$platform\"" "$UPSTREAM_JSON")
  local jaeger_url
  jaeger_url=$(substitute "$JAEGER_SRC_TMPL" "version=$JAEGER_VERSION" "jaeger_platform=$jp")
  local jaeger_sha_url
  jaeger_sha_url=$(substitute "$JAEGER_SHA_TMPL" "version=$JAEGER_VERSION" "jaeger_platform=$jp")
  local jaeger_tarball="$CACHE_DIR/jaeger-$JAEGER_VERSION-$jp.tar.gz"
  local jaeger_shafile="$CACHE_DIR/jaeger-$JAEGER_VERSION-$jp.sha256sum.txt"

  download_with_cache "$jaeger_url" "$jaeger_tarball"
  download_with_cache "$jaeger_sha_url" "$jaeger_shafile"

  # Jaeger's sha file has per-file hashes — we verify the inner binary after extraction.
  # Clean any prior extraction, re-extract.
  local work="$CACHE_DIR/work-jaeger-$platform"
  rm -rf "$work"; mkdir -p "$work"
  tar xzf "$jaeger_tarball" -C "$work"

  local jaeger_extract_rel
  jaeger_extract_rel=$(substitute "$JAEGER_EXTRACT_TMPL" "version=$JAEGER_VERSION" "jaeger_platform=$jp")
  local jaeger_bin="$work/$jaeger_extract_rel"

  if [[ ! -x "$jaeger_bin" ]]; then
    echo "  [missing] expected Jaeger binary at $jaeger_bin" >&2
    exit 3
  fi

  # Per-file hash from Jaeger's sha256sum.txt: "<hex> *<path-inside-archive>"
  local jaeger_expected_sha
  jaeger_expected_sha=$(grep -E " \*${jaeger_extract_rel}$" "$jaeger_shafile" | awk '{print $1}')
  if [[ -z "$jaeger_expected_sha" ]]; then
    echo "  [warn] no per-file sha for $jaeger_extract_rel in $jaeger_shafile — skipping hash verify" >&2
  else
    verify_sha "$jaeger_bin" "$jaeger_expected_sha"
  fi

  cp "$jaeger_bin" "$bin_dir/jaeger"
  chmod +x "$bin_dir/jaeger"

  # --- otelcol-contrib ---
  local op
  op=$(jq -r ".otelcol.platform_map.\"$platform\"" "$UPSTREAM_JSON")
  local otelcol_url
  otelcol_url=$(substitute "$OTELCOL_SRC_TMPL" "version=$OTELCOL_VERSION" "otelcol_platform=$op")
  local otelcol_sha_url
  otelcol_sha_url=$(substitute "$OTELCOL_SHA_TMPL" "version=$OTELCOL_VERSION")
  local otelcol_tarball="$CACHE_DIR/${OTELCOL_VARIANT}-$OTELCOL_VERSION-$op.tar.gz"
  local otelcol_shafile="$CACHE_DIR/${OTELCOL_VARIANT}-$OTELCOL_VERSION-checksums.txt"

  download_with_cache "$otelcol_url" "$otelcol_tarball"
  download_with_cache "$otelcol_sha_url" "$otelcol_shafile"

  # otelcol's checksum file has entries "<hex>  <archive-filename>"
  local otelcol_archive_basename="${OTELCOL_VARIANT}_${OTELCOL_VERSION}_${op}.tar.gz"
  local otelcol_expected_sha
  otelcol_expected_sha=$(awk -v f="$otelcol_archive_basename" '$2 == f {print $1}' "$otelcol_shafile")
  if [[ -z "$otelcol_expected_sha" ]]; then
    echo "  [warn] no checksum entry for $otelcol_archive_basename in $otelcol_shafile — skipping hash verify" >&2
  else
    verify_sha "$otelcol_tarball" "$otelcol_expected_sha"
  fi

  local owork="$CACHE_DIR/work-otelcol-$platform"
  rm -rf "$owork"; mkdir -p "$owork"
  tar xzf "$otelcol_tarball" -C "$owork"

  local otelcol_bin="$owork/$OTELCOL_BINARY"
  if [[ ! -x "$otelcol_bin" ]]; then
    echo "  [missing] expected otelcol binary at $otelcol_bin" >&2
    exit 3
  fi

  cp "$otelcol_bin" "$bin_dir/otelcol"
  chmod +x "$bin_dir/otelcol"

  # --- configs ---
  cp "$SHARED_DIR/jaeger-config.yaml" "$pkg_dir/jaeger-config.yaml"
  cp "$SHARED_DIR/collector-config.yaml" "$pkg_dir/collector-config.yaml"

  # --- LICENSE + NOTICE (upstream Apache 2.0 attribution) ---
  cp "$SHARED_DIR/LICENSE" "$pkg_dir/LICENSE" 2>/dev/null || true
  cp "$SHARED_DIR/NOTICE" "$pkg_dir/NOTICE" 2>/dev/null || true

  # --- size report ---
  local jaeger_sz
  local otelcol_sz
  jaeger_sz=$(du -h "$bin_dir/jaeger" | awk '{print $1}')
  otelcol_sz=$(du -h "$bin_dir/otelcol" | awk '{print $1}')
  echo "  [packed] $platform: jaeger=$jaeger_sz otelcol=$otelcol_sz"

  if $PUBLISH; then
    echo "  [publish] npm publish $pkg_dir"
    (cd "$pkg_dir" && npm publish)
  fi
}

echo "build-telemetry-binaries.sh — platforms: ${SELECTED_PLATFORMS[*]}"
echo "  Jaeger:            v$JAEGER_VERSION"
echo "  otelcol variant:   $OTELCOL_VARIANT v$OTELCOL_VERSION"
echo "  Cache:             $CACHE_DIR"
echo "  Publish:           $PUBLISH"

for p in "${SELECTED_PLATFORMS[@]}"; do
  build_platform "$p"
done

echo ""
echo "done."
