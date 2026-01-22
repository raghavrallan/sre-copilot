#!/bin/bash
# Quick Demo - Trigger alerts and create incidents in SRE Copilot

echo "🚀 SRE Copilot - Quick Demo Script"
echo "===================================="
echo ""

# Check if services are running
echo "✓ Checking services..."
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ Dummy app not running. Start with: docker-compose -f docker-compose.monitoring.yml up -d"
    exit 1
fi

if ! curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "❌ Prometheus not running"
    exit 1
fi

echo "✓ All services running!"
echo ""

# Scenario: High Error Rate
echo "📊 Scenario 1: High Error Rate (15%)"
echo "-----------------------------------"
echo "1. Setting failure mode to 'high_errors'..."
curl -s -X POST "http://localhost:8080/simulate-failure?mode=high_errors" | python -m json.tool
echo ""

echo "2. Generating 200 requests..."
curl -s -X POST "http://localhost:8080/generate-traffic?requests=200" | python -m json.tool
echo ""

echo "3. Waiting 120 seconds for HighErrorRate alert to fire..."
echo "   (Alert threshold: >5% error rate for 2 minutes)"
sleep 30
echo "   ⏳ 30 seconds..."
sleep 30
echo "   ⏳ 60 seconds..."
sleep 30
echo "   ⏳ 90 seconds..."
sleep 30
echo "   ⏳ 120 seconds - checking alerts..."
echo ""

echo "4. Checking Prometheus alerts..."
ALERTS=$(curl -s "http://localhost:9090/api/v1/alerts" | python -m json.tool | grep -c "HighErrorRate" || echo "0")
if [ "$ALERTS" -gt 0 ]; then
    echo "   ✅ HighErrorRate alert is firing!"
else
    echo "   ⏳ Alert pending (may need more time)"
fi
echo ""

echo "5. Checking AlertManager..."
ALERTMANAGER_ALERTS=$(curl -s "http://localhost:9093/api/v2/alerts" | python -m json.tool | grep -c "HighErrorRate" || echo "0")
if [ "$ALERTMANAGER_ALERTS" -gt 0 ]; then
    echo "   ✅ Alert in AlertManager"
else
    echo "   ⏳ Alert not yet in AlertManager"
fi
echo ""

echo "6. Checking incidents in SRE Copilot..."
echo "   Recent incidents:"
curl -s "http://localhost:8002/incidents?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&skip=0&limit=3" | python -m json.tool | grep -E '"title"|"severity"|"detected_at"' | head -12
echo ""

echo "7. Resetting to normal mode..."
curl -s -X POST "http://localhost:8080/simulate-failure?mode=normal" > /dev/null
echo "   ✅ Reset complete"
echo ""

echo "🎉 Demo Complete!"
echo ""
echo "Next Steps:"
echo "1. Open SRE Copilot UI: http://localhost:5173"
echo "2. Login with test credentials"
echo "3. Go to Incidents page to see the alerts"
echo "4. Click on an incident to view AI-generated hypotheses"
echo ""
echo "Try other scenarios:"
echo "  - High Latency: curl -X POST 'http://localhost:8080/simulate-failure?mode=high_latency'"
echo "  - CPU Spike: curl -X POST 'http://localhost:8080/simulate-failure?mode=cpu_spike'"
echo "  - Memory Leak: curl -X POST 'http://localhost:8080/simulate-failure?mode=memory_leak'"
echo "  - Critical (All): curl -X POST 'http://localhost:8080/simulate-failure?mode=critical'"
echo ""
echo "Generate traffic: curl -X POST 'http://localhost:8080/generate-traffic?requests=100'"
echo "Check status: curl http://localhost:8080/failure-status | python -m json.tool"
echo ""
echo "Full documentation: See monitoring/DEMO.md"
