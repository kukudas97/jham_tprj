#!/bin/sh
# jham.duckdns.org TLS 인증서 상태 점검
#
# 두 가지를 확인한다.
#   1) nginx 가 실제로 서빙하는 인증서의 잔여일수
#   2) acme.sh 보관본과 설치본의 불일치 (갱신은 됐으나 설치가 실패한 상태)
#
# 문제가 있으면 stdout 으로 출력하고 exit 1 로 끝난다.
# 배포: scp docker/check-cert.sh oracle-jham:/home/ubuntu/check-cert.sh
# 크론: 10 5 * * * /home/ubuntu/check-cert.sh >> /home/ubuntu/.acme.sh/cert-check.log 2>&1

DOMAIN=jham.duckdns.org
LIVE=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
ACME=$HOME/.acme.sh/${DOMAIN}_ecc/fullchain.cer
WARN_DAYS=21
STAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
RC=0

if [ ! -f "$LIVE" ]; then
    echo "[$STAMP] CRITICAL: 설치된 인증서 없음: $LIVE"
    exit 1
fi

END=$(openssl x509 -in "$LIVE" -noout -enddate | cut -d= -f2)
END_TS=$(date -d "$END" +%s)
NOW_TS=$(date +%s)
DAYS=$(( (END_TS - NOW_TS) / 86400 ))

if [ "$DAYS" -lt 0 ]; then
    echo "[$STAMP] CRITICAL: 인증서 만료됨 ($((-DAYS))일 경과, 만료일 $END)"
    RC=1
elif [ "$DAYS" -lt "$WARN_DAYS" ]; then
    echo "[$STAMP] WARNING: 인증서 만료 $DAYS일 전 (만료일 $END)"
    RC=1
fi

# acme.sh 가 갱신했는데 설치가 안 된 상태를 잡아낸다 (2026-08 장애의 원인)
if [ -f "$ACME" ]; then
    if ! cmp -s "$LIVE" "$ACME"; then
        A_END=$(openssl x509 -in "$ACME" -noout -enddate | cut -d= -f2)
        echo "[$STAMP] CRITICAL: acme.sh 보관본과 설치본 불일치 - 설치 실패 의심"
        echo "           설치본: $END"
        echo "           보관본: $A_END"
        RC=1
    fi
fi

if [ "$RC" -eq 0 ]; then
    echo "[$STAMP] OK: 만료까지 ${DAYS}일 (만료일 $END)"
fi
exit $RC
