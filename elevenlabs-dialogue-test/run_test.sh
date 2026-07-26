#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESPONSE_FILE="$SCRIPT_DIR/response.json"
OUTPUT_DIR="$SCRIPT_DIR/output"

if [[ -z "${ELEVENLABS_API_KEY:-}" ]]; then
  printf "ElevenLabs API key (input hidden): "
  IFS= read -r -s ELEVENLABS_API_KEY
  printf "\n"
fi

if [[ -z "$ELEVENLABS_API_KEY" ]]; then
  echo "No API key was entered." >&2
  exit 1
fi

echo "Generating the dialogue..."
curl --silent --show-error --fail-with-body \
  --request POST \
  "https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128" \
  --header "xi-api-key: $ELEVENLABS_API_KEY" \
  --header "Content-Type: application/json" \
  --data-binary "@$SCRIPT_DIR/dialogue.json" \
  --output "$RESPONSE_FILE"

echo "Creating the master and character tracks..."
python3 "$SCRIPT_DIR/process_dialogue.py" "$RESPONSE_FILE" "$OUTPUT_DIR"

echo
echo "Done. Upload john-sitepal-balanced.wav to John and gr80-sitepal-balanced.wav to Saint GR80."
