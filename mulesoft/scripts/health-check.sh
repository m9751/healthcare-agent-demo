#!/usr/bin/env zsh
# health-check.sh — Verify all CloudHub 2.0 Mule apps are responding

echo ""
echo "============================================"
echo "  CloudHub 2.0 Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "============================================"

UP=0
DOWN=0
TOTAL=0

check() {
    local name=$1
    local url=$2
    TOTAL=$((TOTAL + 1))

    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)
    [[ -z "$code" ]] && code="000"

    case $code in
        200|201|204)
            echo "  UP    $name  (HTTP $code)"
            UP=$((UP + 1))
            ;;
        401|403)
            echo "  AUTH  $name  (HTTP $code — running, needs credentials)"
            UP=$((UP + 1))
            ;;
        000)
            echo "  DOWN  $name  (timeout / unreachable)"
            DOWN=$((DOWN + 1))
            ;;
        *)
            echo "  ERR   $name  (HTTP $code)"
            DOWN=$((DOWN + 1))
            ;;
    esac
}

check "agent-tools-exp-api"        "https://agent-tools-exp-api-sewtob.5sc6y6-5.usa-e2.cloudhub.io/api/v1/clinical/patients"
check "carestack-fhir-sys-api"     "https://carestack-fhir-sys-api-sewtob.5sc6y6-3.usa-e2.cloudhub.io/api/v1/carestack/patients"
check "clinical-federation-prc-api" "https://clinical-federation-prc-api-sewtob.5sc6y6-4.usa-e2.cloudhub.io/api/v1/clinical/patients"
check "fhir-r4-standard-adapter"   "https://fhir-r4-standard-adapter-sewtob.5sc6y6-1.usa-e2.cloudhub.io/api/v1/fhir/patients"
check "meditech-fhir-sys-api"      "https://meditech-fhir-sys-api-sewtob.5sc6y6-2.usa-e2.cloudhub.io/api/v1/meditech/patients"

echo ""
echo "  $UP/$TOTAL responding"
echo "============================================"
