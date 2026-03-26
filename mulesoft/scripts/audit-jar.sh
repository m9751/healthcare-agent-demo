#!/bin/bash
# audit-jar.sh — Validate and fix Mule JARs before CloudHub upload
# Usage: ./audit-jar.sh <jar-file>        (audit one JAR)
#        ./audit-jar.sh <directory>        (audit all JARs in directory)
#        ./audit-jar.sh --fix <jar-file>   (audit + fix issues)
#
# Checks against CloudHub 2.0 deployment governance:
#   1. http.port must be 8081
#   2. mule-artifact.json at JAR root
#   3. mule-artifact.json at META-INF/mule-artifact/
#   4. classloader-model.json at META-INF/mule-artifact/
#   5. Name consistency (root vs META-INF)
#   6. Single HTTP listener config
#   7. api-gateway:autodiscovery element present
#   8. No non-XML files in Mule config paths

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FIX_MODE=false
PASS=0
FAIL=0
WARN=0

if [[ "${1:-}" == "--fix" ]]; then
    FIX_MODE=true
    shift
fi

audit_jar() {
    local jar="$1"
    local name=$(basename "$jar" .jar)
    local errors=0
    local warnings=0

    echo ""
    echo "============================================"
    echo "  $name"
    echo "============================================"

    # Check 1: http.port
    local port=$(unzip -p "$jar" config.properties 2>/dev/null | grep "^http.port=" | cut -d= -f2)
    if [[ "$port" == "8081" ]]; then
        echo -e "  ${GREEN}PASS${NC}  http.port=8081"
    elif [[ -z "$port" ]]; then
        echo -e "  ${RED}FAIL${NC}  http.port not found in config.properties"
        ((errors++))
    else
        echo -e "  ${RED}FAIL${NC}  http.port=$port (must be 8081)"
        ((errors++))
    fi

    # Check 2: root mule-artifact.json
    if unzip -l "$jar" | grep -q "^ .*mule-artifact.json$"; then
        local root_name=$(unzip -p "$jar" mule-artifact.json 2>/dev/null | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
        echo -e "  ${GREEN}PASS${NC}  mule-artifact.json at root (name: $root_name)"
    else
        echo -e "  ${RED}FAIL${NC}  mule-artifact.json MISSING at JAR root"
        ((errors++))
        if $FIX_MODE; then
            # Extract name from META-INF version
            local meta_name=$(unzip -p "$jar" META-INF/mule-artifact/mule-artifact.json 2>/dev/null | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
            if [[ -n "$meta_name" ]]; then
                local tmpdir=$(mktemp -d)
                echo "{\"name\":\"$meta_name\",\"minMuleVersion\":\"4.11.2\",\"javaSpecificationVersions\":[\"17\"]}" > "$tmpdir/mule-artifact.json"
                (cd "$tmpdir" && zip "$jar" mule-artifact.json > /dev/null 2>&1)
                rm -r "$tmpdir"
                echo -e "  ${GREEN}FIXED${NC} Injected root mule-artifact.json (name: $meta_name)"
                ((errors--))
            fi
        fi
    fi

    # Check 3: META-INF mule-artifact.json
    if unzip -l "$jar" | grep -q "META-INF/mule-artifact/mule-artifact.json"; then
        local meta_name=$(unzip -p "$jar" META-INF/mule-artifact/mule-artifact.json 2>/dev/null | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
        echo -e "  ${GREEN}PASS${NC}  META-INF/mule-artifact/mule-artifact.json (name: $meta_name)"
    else
        echo -e "  ${RED}FAIL${NC}  META-INF/mule-artifact/mule-artifact.json MISSING"
        ((errors++))
    fi

    # Check 4: classloader-model.json
    if unzip -l "$jar" | grep -q "META-INF/mule-artifact/classloader-model.json"; then
        echo -e "  ${GREEN}PASS${NC}  classloader-model.json present"
    else
        echo -e "  ${RED}FAIL${NC}  classloader-model.json MISSING"
        ((errors++))
    fi

    # Check 5: Name consistency
    local root_n=$(unzip -p "$jar" mule-artifact.json 2>/dev/null | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
    local meta_n=$(unzip -p "$jar" META-INF/mule-artifact/mule-artifact.json 2>/dev/null | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
    if [[ -n "$root_n" && -n "$meta_n" ]]; then
        if [[ "$root_n" == "$meta_n" ]]; then
            echo -e "  ${GREEN}PASS${NC}  Name consistent: $root_n"
        else
            echo -e "  ${RED}FAIL${NC}  Name mismatch: root=$root_n vs META-INF=$meta_n"
            ((errors++))
        fi
    fi

    # Check 6: Single HTTP listener
    local listener_count=$(unzip -p "$jar" global.xml 2>/dev/null | grep -c "http:listener-config" || true)
    # Subtract commented-out listeners
    local commented=$(unzip -p "$jar" global.xml 2>/dev/null | grep -c "<!--.*http:listener-config\|http:listener-config.*-->" || true)
    local active=$((listener_count - commented))
    if [[ $active -le 1 ]]; then
        echo -e "  ${GREEN}PASS${NC}  Single HTTP listener ($active active)"
    else
        echo -e "  ${YELLOW}WARN${NC}  Multiple HTTP listeners ($active active) — all must share port 8081"
        ((warnings++))
    fi

    # Check 7: Autodiscovery
    if unzip -p "$jar" global.xml 2>/dev/null | grep -q "api-gateway:autodiscovery"; then
        local api_id=$(unzip -p "$jar" global.xml 2>/dev/null | grep "autodiscovery" | sed 's/.*apiId="\([^"]*\)".*/\1/')
        echo -e "  ${GREEN}PASS${NC}  Autodiscovery present (apiId=$api_id)"
    else
        echo -e "  ${YELLOW}WARN${NC}  No autodiscovery element — app won't register with API Manager"
        ((warnings++))
    fi

    # Check 8: No non-XML in mule config
    local bad_files=$(unzip -l "$jar" | grep -E "^\s+[0-9]" | awk '{print $NF}' | grep -v "^repository/" | grep -v "^META-INF/" | grep -v "\.xml$" | grep -v "\.properties$" | grep -v "\.json$" | grep -v "\.dwl$" || true)
    if [[ -z "$bad_files" ]]; then
        echo -e "  ${GREEN}PASS${NC}  No unexpected file types in app root"
    else
        echo -e "  ${YELLOW}WARN${NC}  Non-standard files in app root (verify they're safe)"
        ((warnings++))
    fi

    # Summary
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        echo -e "  ── ${GREEN}READY TO UPLOAD${NC} ──"
        ((PASS++))
    elif [[ $errors -eq 0 ]]; then
        echo -e "  ── ${YELLOW}UPLOAD WITH CAUTION${NC} ($warnings warnings) ──"
        ((WARN++))
    else
        echo -e "  ── ${RED}DO NOT UPLOAD${NC} ($errors errors, $warnings warnings) ──"
        ((FAIL++))
    fi
}

# Main
target="${1:-}"
if [[ -z "$target" ]]; then
    echo "Usage: $0 [--fix] <jar-file|directory>"
    exit 1
fi

if [[ -d "$target" ]]; then
    for jar in "$target"/*.jar; do
        [[ -f "$jar" ]] && audit_jar "$jar"
    done
else
    audit_jar "$target"
fi

echo ""
echo "============================================"
echo "  SUMMARY: $PASS pass / $WARN warn / $FAIL fail"
echo "============================================"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
