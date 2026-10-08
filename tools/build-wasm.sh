#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../crates"
command -v cargo >/dev/null || { echo 'Required: Rust + cargo; install rustup with target wasm32-unknown-unknown' >&2; exit 1; }
cargo test -p nightcraft-world-core
rustup target add wasm32-unknown-unknown
cargo build -p nightcraft-world-wasm --release --target wasm32-unknown-unknown
mkdir -p ../assets/wasm
cp target/wasm32-unknown-unknown/release/nightcraft_world_wasm.wasm ../assets/wasm/world.wasm
echo 'Built experimental wasm asset. JS parity backend remains mandatory until rust worldgen matches golden V14 fixtures.'
