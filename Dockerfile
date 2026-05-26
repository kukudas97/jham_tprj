FROM rust:1.88-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY migration ./migration
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/jham-cli /app/jham-cli
COPY config /app/config

RUN mkdir -p /app/qr /app/uploads

EXPOSE 5150

CMD ["/app/jham-cli", "start", "--environment", "production"]
