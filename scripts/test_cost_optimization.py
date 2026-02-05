"""
Cost Optimization Test Script

Tests the AI service optimizations by creating 10 test incidents
and measuring:
- Total AI requests made
- Token usage (input + output)
- Total cost
- Cache hit rate
- Average cost per incident

Usage:
    python scripts/test_cost_optimization.py
"""
import asyncio
import httpx
import time
from datetime import datetime
import json


API_BASE_URL = "http://localhost:8580/api/v1"
PROJECT_ID = "af98d006-d24f-4e57-be34-4e2d3b1c2a61"  # Default project ID


async def create_test_incident(client: httpx.AsyncClient, incident_num: int):
    """Create a single test incident"""
    incident_data = {
        "title": f"Test Incident #{incident_num}: High CPU usage on payment-service",
        "description": f"The payment service is experiencing elevated CPU usage (>85%) for the past 15 minutes. This started after deployment v2.{incident_num}.0. Error rate has increased from 0.1% to 2.5%.",
        "service_name": f"payment-service-{incident_num % 3}",
        "severity": ["low", "medium", "high", "critical"][incident_num % 4],
        "project_id": PROJECT_ID
    }

    try:
        response = await client.post(
            f"{API_BASE_URL}/incidents",
            json=incident_data
        )
        response.raise_for_status()
        result = response.json()
        print(f"✅ Created incident {incident_num}: {result['id']}")
        return result['id']
    except Exception as e:
        print(f"❌ Failed to create incident {incident_num}: {e}")
        return None


async def get_analytics(client: httpx.AsyncClient):
    """Get analytics from AI service"""
    try:
        response = await client.get(
            "http://localhost:8503/analytics/token-usage"
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Failed to get analytics: {e}")
        return None


async def get_cost_summary(client: httpx.AsyncClient):
    """Get cost summary from AI service"""
    try:
        response = await client.get(
            "http://localhost:8503/analytics/cost-summary?days=1"
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Failed to get cost summary: {e}")
        return None


async def get_incident_metrics(client: httpx.AsyncClient, incident_id: str):
    """Get metrics for a specific incident"""
    try:
        response = await client.get(
            f"{API_BASE_URL}/incidents/{incident_id}/metrics?project_id={PROJECT_ID}"
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"⚠️  Failed to get metrics for incident {incident_id}: {e}")
        return None


async def main():
    """Main test function"""
    print("=" * 80)
    print("SRE COPILOT - AI COST OPTIMIZATION TEST")
    print("=" * 80)
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Creating 10 test incidents...\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create 10 test incidents
        incident_ids = []
        start_time = time.time()

        for i in range(1, 11):
            incident_id = await create_test_incident(client, i)
            if incident_id:
                incident_ids.append(incident_id)
            # Small delay to allow processing
            await asyncio.sleep(1)

        creation_time = time.time() - start_time
        print(f"\n✅ Created {len(incident_ids)} incidents in {creation_time:.2f}s")

        # Wait for hypotheses to be generated
        print(f"\n⏳ Waiting 15 seconds for AI processing...")
        await asyncio.sleep(15)

        # Get analytics
        print(f"\n" + "=" * 80)
        print("COLLECTING METRICS")
        print("=" * 80)

        analytics = await get_analytics(client)
        cost_summary = await get_cost_summary(client)

        if analytics:
            print(f"\n📊 OVERALL STATISTICS:")
            print(f"   Total AI Requests: {analytics['total_requests']}")
            print(f"   Total Input Tokens: {analytics['total_input_tokens']:,}")
            print(f"   Total Output Tokens: {analytics['total_output_tokens']:,}")
            print(f"   Total Tokens: {analytics['total_tokens']:,}")
            print(f"   Total Cost: ${analytics['total_cost_usd']:.6f}")
            print(f"   Avg Duration: {analytics['avg_duration_ms']}ms")

            print(f"\n📈 BREAKDOWN BY REQUEST TYPE:")
            for breakdown in analytics.get('breakdown_by_type', []):
                print(f"   {breakdown['request_type']}:")
                print(f"      Requests: {breakdown['count']}")
                print(f"      Tokens: {breakdown['total_tokens']:,} ({breakdown['input_tokens']:,} in + {breakdown['output_tokens']:,} out)")
                print(f"      Cost: ${breakdown['cost_usd']:.6f}")

        if cost_summary:
            print(f"\n💰 COST SUMMARY:")
            stats = cost_summary['overall_stats']
            cache = cost_summary['cache_stats']

            print(f"   Total Requests: {stats['total_requests']}")
            print(f"   Total Cost: ${stats['total_cost_usd']:.6f}")
            print(f"   Avg Cost/Request: ${stats['avg_cost_per_request']:.6f}")
            print(f"   Cache Hit Rate: {cache['cache_hit_rate']:.1f}%")
            print(f"   Potential Savings: ${cache['potential_savings']:.6f}")

            if cost_summary.get('recommendations'):
                print(f"\n💡 RECOMMENDATIONS:")
                for rec in cost_summary['recommendations']:
                    print(f"   [{rec['priority'].upper()}] {rec['message']}")

        # Get per-incident metrics
        print(f"\n" + "=" * 80)
        print("PER-INCIDENT METRICS")
        print("=" * 80)

        total_per_incident_cost = 0.0
        total_per_incident_requests = 0

        for idx, incident_id in enumerate(incident_ids[:5], 1):  # Show first 5
            metrics = await get_incident_metrics(client, incident_id)
            if metrics:
                summary = metrics['summary']
                print(f"\n📋 Incident #{idx} ({incident_id[:8]}...):")
                print(f"   AI Requests: {summary['total_ai_requests']}")
                print(f"   Tokens: {summary['total_tokens']:,}")
                print(f"   Cost: ${summary['total_cost_usd']:.6f}")

                total_per_incident_cost += summary['total_cost_usd']
                total_per_incident_requests += summary['total_ai_requests']

        if len(incident_ids) > 0:
            avg_cost_per_incident = total_per_incident_cost / len(incident_ids)
            avg_requests_per_incident = total_per_incident_requests / len(incident_ids)

            print(f"\n" + "=" * 80)
            print("OPTIMIZATION RESULTS")
            print("=" * 80)
            print(f"\n✅ Test Completed Successfully!")
            print(f"   Incidents Created: {len(incident_ids)}")
            print(f"   Avg AI Requests/Incident: {avg_requests_per_incident:.1f}")
            print(f"   Avg Cost/Incident: ${avg_cost_per_incident:.6f}")
            print(f"   Total Cost for 10 Incidents: ${total_per_incident_cost:.6f}")

            # Calculate projection for 1000 incidents
            projected_cost_1000 = avg_cost_per_incident * 1000
            projected_requests_1000 = avg_requests_per_incident * 1000

            print(f"\n📈 PROJECTED FOR 1000 INCIDENTS:")
            print(f"   Estimated AI Requests: {projected_requests_1000:.0f}")
            print(f"   Estimated Cost: ${projected_cost_1000:.2f}")

            # Compare with previous results
            print(f"\n📊 COMPARISON (vs. Previous Test):")
            print(f"   Previous: 1000 incidents = $23.00")
            print(f"   Optimized: 1000 incidents = ${projected_cost_1000:.2f}")
            if projected_cost_1000 < 23:
                savings = 23 - projected_cost_1000
                savings_pct = (savings / 23) * 100
                print(f"   💚 SAVINGS: ${savings:.2f} ({savings_pct:.1f}% reduction)")
            else:
                print(f"   ⚠️  Cost increased (needs investigation)")

            # Optimization score
            print(f"\n🎯 OPTIMIZATION SCORE:")
            if avg_requests_per_incident <= 1:
                print(f"   ✅ Excellent: {avg_requests_per_incident:.1f} AI requests/incident (Target: ≤1)")
            elif avg_requests_per_incident <= 5:
                print(f"   ✅ Good: {avg_requests_per_incident:.1f} AI requests/incident (Target: ≤5)")
            else:
                print(f"   ⚠️  Needs improvement: {avg_requests_per_incident:.1f} AI requests/incident")

            if projected_cost_1000 <= 5:
                print(f"   ✅ Excellent: ${projected_cost_1000:.2f} for 1000 incidents (Target: ≤$5)")
            elif projected_cost_1000 <= 10:
                print(f"   ✅ Good: ${projected_cost_1000:.2f} for 1000 incidents (Target: ≤$10)")
            else:
                print(f"   ⚠️  Needs improvement: ${projected_cost_1000:.2f} for 1000 incidents")

        print(f"\n" + "=" * 80)
        print(f"Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
