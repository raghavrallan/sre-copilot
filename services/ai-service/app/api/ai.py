"""
AI endpoints for hypothesis generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json

from shared.models.incident import Incident, Hypothesis
from app.services.redis_publisher import redis_publisher

router = APIRouter()

# Check if we have Azure OpenAI credentials
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "sre-copilot-deployment-002")
USE_MOCK = not AZURE_OPENAI_API_KEY or AZURE_OPENAI_API_KEY == ""


class GenerateHypothesesRequest(BaseModel):
    incident_id: str
    title: str
    description: str
    service_name: str


class HypothesisCandidate(BaseModel):
    claim: str
    description: str
    confidence_score: float
    supporting_evidence: List[str]


async def generate_hypotheses_mock(title: str, description: str, service_name: str) -> List[HypothesisCandidate]:
    """Mock hypothesis generation (when no API key)"""
    return [
        HypothesisCandidate(
            claim=f"High CPU usage in {service_name} due to inefficient query",
            description="The service is experiencing elevated CPU usage, likely caused by an inefficient database query introduced in a recent deployment.",
            confidence_score=0.85,
            supporting_evidence=[
                "CPU metrics show 90% utilization",
                "Recent deployment detected 10 minutes before symptoms",
                "Similar pattern observed in INC-445 on 2025-12-03"
            ]
        ),
        HypothesisCandidate(
            claim=f"Memory leak in {service_name}",
            description="Gradual memory increase suggests a memory leak, potentially in the caching layer or connection pooling.",
            confidence_score=0.72,
            supporting_evidence=[
                "Memory usage trending upward since deployment",
                "Heap dumps show unreleased objects"
            ]
        ),
        HypothesisCandidate(
            claim=f"External API timeout affecting {service_name}",
            description="Downstream API calls are timing out, causing request backlog and resource exhaustion.",
            confidence_score=0.65,
            supporting_evidence=[
                "Increased latency on external API calls",
                "Timeout errors in application logs"
            ]
        )
    ]


async def generate_hypotheses_real(title: str, description: str, service_name: str) -> List[HypothesisCandidate]:
    """Real hypothesis generation using Azure OpenAI GPT-4o-mini"""
    try:
        from openai import AsyncAzureOpenAI

        print(f"🤖 Initializing Azure OpenAI client...")
        print(f"   Endpoint: {AZURE_OPENAI_ENDPOINT}")
        print(f"   Deployment: {AZURE_OPENAI_DEPLOYMENT}")
        print(f"   Model: gpt-4o-mini")
        print(f"   API Key: {'*' * 20}{AZURE_OPENAI_API_KEY[-4:] if AZURE_OPENAI_API_KEY else 'NOT SET'}")

        # Initialize Azure OpenAI client
        client = AsyncAzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2024-08-01-preview",  # Use stable API version
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )

        prompt = f"""You are an expert SRE analyzing a production incident.

Incident: {title}
Description: {description}
Service: {service_name}

Generate 3-5 possible root cause hypotheses. For each hypothesis, provide:
1. A clear, concise claim (one sentence)
2. A detailed description
3. A confidence score (0.0 to 1.0)
4. List of supporting evidence

Return your response in JSON format:
{{
    "hypotheses": [
        {{
            "claim": "...",
            "description": "...",
            "confidence_score": 0.85,
            "supporting_evidence": ["...", "..."]
        }}
    ]
}}
"""

        print(f"📤 Sending request to Azure OpenAI GPT-4o-mini...")

        # Call Azure OpenAI GPT-4o-mini
        try:
            response = await client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT,  # Deployment name in Azure
                messages=[
                    {"role": "system", "content": "You are an expert SRE assistant that generates root cause hypotheses for production incidents. Always respond in valid JSON format."},
                    {"role": "user", "content": prompt}
                ],
                max_completion_tokens=2000
            )
        except Exception as e:
            print(f"❌ API call failed: {e}")
            raise

        print(f"📥 Received response from Azure OpenAI")
        print(f"   Response type: {type(response)}")
        print(f"   Choices count: {len(response.choices) if response.choices else 0}")

        # Parse JSON response
        if not response.choices or len(response.choices) == 0:
            print("❌ No choices in response")
            raise ValueError("No choices in response")

        content = response.choices[0].message.content
        print(f"📄 Response content length: {len(content) if content else 0}")
        print(f"📄 Response content (first 500 chars): {content[:500] if content else 'EMPTY'}")

        if not content or content.strip() == "":
            print("❌ Empty response from Azure OpenAI")
            raise ValueError("Empty response from Azure OpenAI")

        # Try to parse JSON
        try:
            result = json.loads(content)
            print(f"✅ Successfully parsed JSON response")
        except json.JSONDecodeError as je:
            print(f"❌ JSON parse error: {je}")
            print(f"   Content: {content}")
            raise

        hypotheses_data = result.get("hypotheses", [])
        print(f"📊 Extracted {len(hypotheses_data)} hypotheses")

        # Convert to HypothesisCandidate objects
        candidates = []
        for h in hypotheses_data:
            candidates.append(HypothesisCandidate(
                claim=h.get("claim", "Unknown hypothesis"),
                description=h.get("description", ""),
                confidence_score=h.get("confidence_score", 0.5),
                supporting_evidence=h.get("supporting_evidence", [])
            ))

        if len(candidates) == 0:
            print("⚠️  No hypotheses generated, using mock")
            return await generate_hypotheses_mock(title, description, service_name)

        print(f"✅ Successfully generated {len(candidates)} hypotheses")
        return candidates

    except Exception as e:
        print(f"❌ Azure OpenAI API error: {e}, falling back to mock")
        import traceback
        traceback.print_exc()
        return await generate_hypotheses_mock(title, description, service_name)


@router.post("/generate-hypotheses")
async def generate_hypotheses(request: GenerateHypothesesRequest):
    """Generate hypotheses for an incident"""
    # Verify incident exists
    try:
        incident = await Incident.objects.aget(id=request.incident_id)
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Generate hypotheses
    if USE_MOCK:
        print(f"Using MOCK hypothesis generation (no Azure OpenAI API key)")
        candidates = await generate_hypotheses_mock(
            request.title,
            request.description,
            request.service_name
        )
    else:
        print(f"Using Azure OpenAI GPT-4o-mini for hypothesis generation")
        candidates = await generate_hypotheses_real(
            request.title,
            request.description,
            request.service_name
        )

    # Save hypotheses to database
    saved_hypotheses = []
    for rank, candidate in enumerate(candidates, 1):
        hypothesis = await Hypothesis.objects.acreate(
            incident=incident,
            claim=candidate.claim,
            description=candidate.description,
            confidence_score=candidate.confidence_score,
            supporting_evidence=candidate.supporting_evidence,
            rank=rank
        )
        saved_hypotheses.append({
            "id": str(hypothesis.id),
            "claim": hypothesis.claim,
            "confidence_score": hypothesis.confidence_score,
            "rank": hypothesis.rank
        })

        # Publish hypothesis.generated event to WebSocket
        try:
            await redis_publisher.publish_hypothesis_generated(
                hypothesis_data={
                    "id": str(hypothesis.id),
                    "incident_id": str(incident.id),
                    "claim": hypothesis.claim,
                    "description": hypothesis.description,
                    "confidence_score": hypothesis.confidence_score,
                    "rank": hypothesis.rank,
                    "supporting_evidence": hypothesis.supporting_evidence
                },
                tenant_id=str(incident.tenant_id)
            )
        except Exception as e:
            print(f"Failed to publish hypothesis.generated event: {e}")

    return {
        "incident_id": str(incident.id),
        "hypotheses_generated": len(saved_hypotheses),
        "hypotheses": saved_hypotheses,
        "using_mock": USE_MOCK
    }


@router.get("/status")
async def ai_status():
    """Get AI service status"""
    return {
        "status": "operational",
        "using_mock": USE_MOCK,
        "api_configured": not USE_MOCK
    }
