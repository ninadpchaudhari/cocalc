#!/usr/bin/env bash
. ./i18n/bin/common.sh

check_api_key

# Each language is downloaded into a spearate file and compiled – this allows for dynamic imports.
download() {
  local lang="$1"
  echo "calling download '$lang'"
  simplelocalize download \
    --apiKey "$SIMPLELOCALIZE_KEY" \
    --downloadPath "./i18n/trans/${lang}.json" \
    --downloadFormat single-language-json \
    --languageKey="$lang"
}

if command -v parallel &>/dev/null; then
  echo "Parallel is installed. Running downloads in parallel."
  export -f download
  echo "$LANGS" | tr ' ' '\n' | parallel -j8 --delay 0.1 --will-cite download
else
  echo "Parallel is not installed. Running downloads sequentially."
  for L in $LANGS; do
    download "$L"
  done
fi
