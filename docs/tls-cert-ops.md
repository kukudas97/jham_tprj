# TLS 인증서 운영 (jham.duckdns.org)

## 구성

| 항목 | 값 |
|---|---|
| 서버 | Oracle Cloud, `129.154.209.31` (SSH alias `oracle-jham`, user `ubuntu`) |
| 발급 도구 | acme.sh (`/home/ubuntu/.acme.sh`) |
| CA | ZeroSSL (acme.sh 기본 CA) — Let's Encrypt 아님 |
| 검증 방식 | DNS-01 (`dns_duckdns`) — 80 포트와 무관 |
| 보관 경로 | `/home/ubuntu/.acme.sh/jham.duckdns.org_ecc/` |
| 설치 경로 | `/etc/letsencrypt/live/jham.duckdns.org/` (소유자 `ubuntu`) |
| nginx 참조 | `docker/nginx.conf` — `/etc/letsencrypt` 를 `:ro` 로 마운트 |
| 갱신 크론 | `55 4 * * *` acme.sh --cron |
| 감시 크론 | `10 5 * * *` `check-cert.sh` |

발급 경로는 `/etc/letsencrypt` 지만 certbot 이 아니라 acme.sh 가 관리한다.
`certbot.timer` 가 남아 있으나 `/etc/letsencrypt/renewal/` 이 비어 있어 관리 대상이 0개다.

## 2026-08 만료 장애

**증상**: 8/25 인증서 만료, 브라우저에 "주의 요함". 서버·nginx 는 정상 동작 중이었다.

**원인**: acme.sh 는 8/11 에 갱신에 **성공**했으나, 새 인증서를 `/etc/letsencrypt/live/` 로
복사하는 단계에서 실패했다. 크론은 `ubuntu` 로 도는데 해당 디렉토리가 `root:root` 소유였다.
결과적으로 nginx 는 5/27 자 옛 인증서를 계속 서빙했다.

**왜 늦게 발견됐나** — 3중으로 침묵했다.

1. acme.sh 가 복사 실패에도 `Le_NextRenewTime` 을 10/26 으로 갱신해 "성공"으로 기록. 재시도하지 않음
2. `~/.acme.sh/acme.sh.log` 파일 자체가 없었음 (`LOG_FILE` 미설정)
3. 크론이 `> /dev/null` 로 출력을 버렸고 `/var/mail/ubuntu` 도 없어 stderr 조차 남지 않음

**조치**

- `chown -R ubuntu:ubuntu /etc/letsencrypt/live/jham.duckdns.org` — 근본 원인
- `--install-cert` 재실행 후 nginx 재시작 (재발급 없이 기존 인증서 배치)
- `account.conf` 에 `LOG_FILE` / `LOG_LEVEL=1` 추가
- 크론 출력을 `~/.acme.sh/cron.log` 로 보존
- `check-cert.sh` 감시 크론 추가

## 감시 스크립트

`docker/check-cert.sh` 가 소스이며, 서버 `/home/ubuntu/check-cert.sh` 로 배포한다.

```sh
scp docker/check-cert.sh oracle-jham:/home/ubuntu/check-cert.sh
ssh oracle-jham 'chmod +x /home/ubuntu/check-cert.sh && /home/ubuntu/check-cert.sh'
```

만료 21일 전 경고와 함께, **보관본과 설치본의 불일치**를 검사한다.
후자가 이번 장애의 실제 형태이므로 잔여일수만 보는 것으로는 부족하다.

로그: `~/.acme.sh/cert-check.log`

## 점검 명령

```sh
# 외부에서 인증서 검증
openssl s_client -connect jham.duckdns.org:443 -servername jham.duckdns.org </dev/null 2>&1 \
  | grep -E 'NotBefore|Verify return code'

# 서버 상태
ssh oracle-jham '~/.acme.sh/acme.sh --list'
ssh oracle-jham 'openssl x509 -in /etc/letsencrypt/live/jham.duckdns.org/fullchain.pem -noout -dates'
ssh oracle-jham '/home/ubuntu/check-cert.sh'
```

## 수동 복구

갱신은 됐는데 설치가 안 된 경우 — 재발급 없이 배치만 다시 한다.

```sh
ssh oracle-jham
~/.acme.sh/acme.sh --install-cert -d jham.duckdns.org --ecc \
  --cert-file      /etc/letsencrypt/live/jham.duckdns.org/cert.pem \
  --key-file       /etc/letsencrypt/live/jham.duckdns.org/privkey.pem \
  --fullchain-file /etc/letsencrypt/live/jham.duckdns.org/fullchain.pem \
  --reloadcmd      "cd ~/jham && docker compose restart nginx"
```

`docker-compose.yml` 이 `/etc/letsencrypt` 를 `:ro` 로 마운트하므로 파일 교체 후
nginx 재시작이 반드시 필요하다. `--reloadcmd` 가 이를 수행한다.

## 미결 사항

- **알림 채널 없음**: `check-cert.sh` 결과가 로그에만 쌓인다. Slack Webhook 등 연결 필요
- **HSTS 미적용**: 응답에 `Strict-Transport-Security` 헤더가 없어 `http://` 진입점이 남아 있으면
  브라우저가 HTTP 를 먼저 시도한다. 적용 시 만료 사고가 나면 우회조차 불가능해지므로
  `max-age=300` 정도로 짧게 시작할 것
- **`certbot.timer` 공회전**: 관리 대상 0개로 무해하나 원인 파악을 헷갈리게 한다.
  `sudo systemctl disable --now certbot.timer` 로 정리 권장
