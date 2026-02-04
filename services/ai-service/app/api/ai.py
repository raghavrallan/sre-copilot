"""
AI endpoints for hypothesis generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import time
import redis
from asgiref.sync import sync_to_async

from shared.models.incident import Incident, Hypothesis
from shared.models.ai_request import AIRequest
from shared.models.analysis_step import AnalysisStep, AnalysisStepType, AnalysisStepStatus
from app.services.redis_publisher import redis_publisher

router = APIRouter()

# Azure OpenAI Configuration from environment
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "gpt-4o-mini")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

# Pricing Configuration from environment (per 1M tokens)
AI_INPUT_TOKEN_PRICE = float(os.getenv("AI_INPUT_TOKEN_PRICE", "0.150"))
AI_OUTPUT_TOKEN_PRICE = float(os.getenv("AI_OUTPUT_TOKEN_PRICE", "0.600"))

USE_MOCK = not AZURE_OPENAI_API_KEY or AZURE_OPENAI_API_KEY == ""

# Redis client for caching
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


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
        print(f"   Model: {AZURE_OPENAI_MODEL}")
        print(f"   API Version: {AZURE_OPENAI_API_VERSION}")
        print(f"   API Key: {'*' * 20}{AZURE_OPENAI_API_KEY[-4:] if AZURE_OPENAI_API_KEY else 'NOT SET'}")

        # Initialize Azure OpenAI client
        client = AsyncAzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )

        # OPTIMIZED PROMPT - Reduced from ~500 tokens to ~200 tokens
        prompt = f"""Analyze this production incident and return 3-5 root cause hypotheses as JSON.

Incident: {title}
Details: {description}
Service: {service_name}

Format: {{"hypotheses":[{{"claim":"one sentence hypothesis","description":"brief explanation","confidence_score":0.85,"supporting_evidence":["evidence1","evidence2"]}}]}}

Focus on common SRE issues: resource exhaustion, config errors, dependency failures, deployment issues, external API problems."""

        print(f"📤 Sending request to Azure OpenAI GPT-4o-mini...")

        # Call Azure OpenAI GPT-4o-mini
        # OPTIMIZED: Reduced max_completion_tokens from 2000 to 800 (60% reduction)
        start_time = time.time()
        try:
            response = await client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT,  # Deployment name in Azure
                messages=[
                    {"role": "system", "content": "Expert SRE assistant. Generate root cause hypotheses in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                max_completion_tokens=800  # Reduced from 2000 to 800 for cost optimization
            )
            duration_ms = int((time.time() - start_time) * 1000)
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

        # Clean markdown formatting from response (```json ... ```)
        cleaned_content = content.strip()
        if cleaned_content.startswith("```"):
            # Remove opening code block
            lines = cleaned_content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            # Remove closing code block
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_content = "\n".join(lines)

        # Try to parse JSON
        try:
            result = json.loads(cleaned_content)
            print(f"✅ Successfully parsed JSON response")
        except json.JSONDecodeError as je:
            print(f"❌ JSON parse error: {je}")
            print(f"   Content: {cleaned_content}")
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

        # Return candidates along with token usage
        return {
            "candidates": candidates,
            "usage": {
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
                "duration_ms": duration_ms
            }
        }

    except Exception as e:
        print(f"❌ Azure OpenAI API error: {e}, falling back to mock")
        import traceback
        traceback.print_exc()
        mock_result = await generate_hypotheses_mock(title, description, service_name)
        return {
            "candidates": mock_result,
            "usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "duration_ms": 0
            }
        }


@router.post("/generate-hypotheses")
async def generate_hypotheses(request: GenerateHypothesesRequest):
    """
    Generate hypotheses for an incident with caching and token tracking

    OPTIMIZATION FEATURES:
    1. Checks if hypotheses already exist (caching)
    2. Uses Redis lock to prevent duplicate concurrent requests
    3. Tracks token usage and costs
    4. Creates analysis workflow step
    """
    # Verify incident exists
    try:
        incident = await Incident.objects.aget(id=request.incident_id)
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    # OPTIMIZATION 1: Check if hypotheses already exist in database (cache)
    existing_count = await Hypothesis.objects.filter(incident=incident).acount()
    if existing_count > 0:
        print(f"✅ Cache hit: {existing_count} hypotheses already exist for incident {request.incident_id}")
        existing_hypotheses = []
        async for hypothesis in Hypothesis.objects.filter(incident=incident).order_by('rank'):
            existing_hypotheses.append({
                "id": str(hypothesis.id),
                "claim": hypothesis.claim,
                "confidence_score": hypothesis.confidence_score,
                "rank": hypothesis.rank
            })
        return {
            "incident_id": str(incident.id),
            "hypotheses_generated": len(existing_hypotheses),
            "hypotheses": existing_hypotheses,
            "using_mock": USE_MOCK,
            "cached": True
        }

    # OPTIMIZATION 2: Use Redis lock to prevent duplicate concurrent requests
    lock_key = f"ai:generating:{request.incident_id}"
    if redis_client.exists(lock_key):
        print(f"⚠️  Another request is already generating hypotheses for incident {request.incident_id}")
        raise HTTPException(status_code=409, detail="Hypothesis generation already in progress for this incident")

    # Set lock with 60 second TTL
    redis_client.setex(lock_key, 60, "1")

    analysis_step = None
    try:
        # Create analysis step for tracking (using incident_id instead of incident object)
        try:
            analysis_step = await AnalysisStep.objects.acreate(
                incident_id=request.incident_id,
                step_type=AnalysisStepType.HYPOTHESIS_GENERATED,
                step_number=5,
                status=AnalysisStepStatus.IN_PROGRESS,
                input_data={
                    "title": request.title,
                    "description": request.description,
                    "service_name": request.service_name
                }
            )
            # Use sync_to_async for the start() method which calls save()
            await sync_to_async(analysis_step.start)()
        except Exception as e:
            print(f"Warning: Could not create analysis step: {e}")
            analysis_step = None

        # Generate hypotheses
        if USE_MOCK:
            print(f"Using MOCK hypothesis generation (no Azure OpenAI API key)")
            mock_candidates = await generate_hypotheses_mock(
                request.title,
                request.description,
                request.service_name
            )
            result = {
                "candidates": mock_candidates,
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "duration_ms": 0
                }
            }
        else:
            print(f"Using Azure OpenAI GPT-4o-mini for hypothesis generation")
            result = await generate_hypotheses_real(
                request.title,
                request.description,
                request.service_name
            )

        candidates = result["candidates"]
        usage = result["usage"]

        # Save hypotheses to database
        saved_hypotheses = []
        for rank, candidate in enumerate(candidates, 1):
            hypothesis = await Hypothesis.objects.acreate(
                incident_id=request.incident_id,
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
                        "incident_id": request.incident_id,
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

        # OPTIMIZATION 3: Track token usage and cost
        if not USE_MOCK:
            ai_request = await AIRequest.objects.acreate(
                incident_id=request.incident_id,
                request_type="hypothesis",
                input_tokens=usage["input_tokens"],
                output_tokens=usage["output_tokens"],
                duration_ms=usage["duration_ms"],
                model_used=AZURE_OPENAI_DEPLOYMENT,
                prompt_summary=f"Generate hypotheses for: {request.title[:100]}",
                response_summary=f"Generated {len(saved_hypotheses)} hypotheses"
            )
            print(f"💰 Token usage: {usage['input_tokens']} input + {usage['output_tokens']} output = {usage['total_tokens']} total")

            # Update analysis step with token info (if enabled)
            if analysis_step:
                analysis_step.input_tokens = usage["input_tokens"]
                analysis_step.output_tokens = usage["output_tokens"]
                analysis_step.total_tokens = usage["total_tokens"]
                await sync_to_async(analysis_step.calculate_cost)()

        # Mark analysis step as complete (if enabled)
        if analysis_step:
            await sync_to_async(analysis_step.complete)(output_data={
                "hypotheses_count": len(saved_hypotheses),
                "using_mock": USE_MOCK
            })

        # Cache the result in Redis for 24 hours
        cache_key = f"hypothesis:{request.incident_id}"
        redis_client.setex(cache_key, 86400, "1")  # 24 hour TTL

        return {
            "incident_id": str(incident.id),
            "hypotheses_generated": len(saved_hypotheses),
            "hypotheses": saved_hypotheses,
            "using_mock": USE_MOCK,
            "cached": False,
            "token_usage": usage if not USE_MOCK else None
        }

    finally:
        # Always release the lock
        redis_client.delete(lock_key)


@router.post("/generate-hypotheses-batch")
async def generate_hypotheses_batch(incidents: List[GenerateHypothesesRequest]):
    """
    Generate hypotheses for multiple incidents in a single batch

    OPTIMIZATION: Process 5-10 incidents in one AI call to reduce costs by 5-10x
    This endpoint combines multiple incident contexts into a single prompt,
    reducing API overhead and total token usage.

    Note: Maximum 10 incidents per batch for optimal performance
    """
    if len(incidents) == 0:
        raise HTTPException(status_code=400, detail="No incidents provided")

    if len(incidents) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 incidents per batch")

    # Check cache and filter out incidents that already have hypotheses
    incidents_to_process = []
    cached_results = []

    for incident_request in incidents:
        try:
            incident = await Incident.objects.aget(id=incident_request.incident_id)
            existing_count = await Hypothesis.objects.filter(incident=incident).acount()

            if existing_count > 0:
                # Cache hit - return existing hypotheses
                hypotheses = []
                async for h in Hypothesis.objects.filter(incident=incident).order_by('rank'):
                    hypotheses.append({
                        "id": str(h.id),
                        "claim": h.claim,
                        "confidence_score": h.confidence_score,
                        "rank": h.rank
                    })
                cached_results.append({
                    "incident_id": str(incident.id),
                    "hypotheses": hypotheses,
                    "cached": True
                })
            else:
                incidents_to_process.append((incident_request, incident))
        except Incident.DoesNotExist:
            continue

    # If all incidents were cached, return immediately
    if len(incidents_to_process) == 0:
        return {
            "batch_size": len(incidents),
            "processed": 0,
            "cached": len(cached_results),
            "results": cached_results,
            "using_mock": USE_MOCK
        }

    # Build batch prompt for remaining incidents
    if USE_MOCK:
        # Process each incident with mock data
        results = []
        for incident_request, incident in incidents_to_process:
            candidates = await generate_hypotheses_mock(
                incident_request.title,
                incident_request.description,
                incident_request.service_name
            )

            # Save hypotheses
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

            results.append({
                "incident_id": str(incident.id),
                "hypotheses": saved_hypotheses,
                "cached": False
            })

        return {
            "batch_size": len(incidents),
            "processed": len(results),
            "cached": len(cached_results),
            "results": results + cached_results,
            "using_mock": True
        }

    # Real AI processing with batch optimization
    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2024-08-01-preview",
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )

        # Build batch prompt
        batch_context = []
        for idx, (incident_request, incident) in enumerate(incidents_to_process, 1):
            batch_context.append(f"""
Incident {idx}:
- Title: {incident_request.title}
- Details: {incident_request.description}
- Service: {incident_request.service_name}
""")

        batch_prompt = f"""Analyze these {len(incidents_to_process)} production incidents and generate 3-5 root cause hypotheses for EACH incident.

{chr(10).join(batch_context)}

Return JSON with hypotheses for each incident:
{{"incidents":[{{"incident_number":1,"hypotheses":[{{"claim":"...","description":"...","confidence_score":0.85,"supporting_evidence":["..."]}}]}}]}}

Focus on common SRE issues: resource exhaustion, config errors, dependency failures, deployment issues, external API problems."""

        start_time = time.time()
        response = await client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": "Expert SRE assistant. Generate root cause hypotheses in JSON format."},
                {"role": "user", "content": batch_prompt}
            ],
            max_completion_tokens=1500 * len(incidents_to_process)  # Scale with batch size
        )
        duration_ms = int((time.time() - start_time) * 1000)

        # Parse response
        content = response.choices[0].message.content
        result = json.loads(content)

        # Process each incident's hypotheses
        results = []
        for idx, (incident_request, incident) in enumerate(incidents_to_process):
            incident_result = result["incidents"][idx]
            hypotheses_data = incident_result.get("hypotheses", [])

            saved_hypotheses = []
            for rank, h in enumerate(hypotheses_data, 1):
                hypothesis = await Hypothesis.objects.acreate(
                    incident=incident,
                    claim=h.get("claim", "Unknown hypothesis"),
                    description=h.get("description", ""),
                    confidence_score=h.get("confidence_score", 0.5),
                    supporting_evidence=h.get("supporting_evidence", []),
                    rank=rank
                )
                saved_hypotheses.append({
                    "id": str(hypothesis.id),
                    "claim": hypothesis.claim,
                    "confidence_score": hypothesis.confidence_score,
                    "rank": hypothesis.rank
                })

                # Publish to WebSocket
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

            results.append({
                "incident_id": str(incident.id),
                "hypotheses": saved_hypotheses,
                "cached": False
            })

        # Track token usage for batch
        usage = {
            "input_tokens": response.usage.prompt_tokens if response.usage else 0,
            "output_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
            "duration_ms": duration_ms
        }

        # Create AI request record for the batch (DISABLED - using dummy data)
        # batch_incident = incidents_to_process[0][1]  # Use first incident for tracking
        # ai_request = await AIRequest.objects.acreate(
        #     incident=batch_incident,
        #     request_type="hypothesis_batch",
        #     input_tokens=usage["input_tokens"],
        #     output_tokens=usage["output_tokens"],
        #     duration_ms=usage["duration_ms"],
        #     model_used=AZURE_OPENAI_DEPLOYMENT,
        #     prompt_summary=f"Batch process {len(incidents_to_process)} incidents",
        #     response_summary=f"Generated hypotheses for {len(results)} incidents"
        # )

        print(f"💰 Batch token usage: {usage['input_tokens']} input + {usage['output_tokens']} output = {usage['total_tokens']} total")
        cost_per_incident = (usage['input_tokens']*AI_INPUT_TOKEN_PRICE/1000000 + usage['output_tokens']*AI_OUTPUT_TOKEN_PRICE/1000000) / len(incidents_to_process)
        print(f"📊 Cost per incident: ${cost_per_incident:.6f}")

        return {
            "batch_size": len(incidents),
            "processed": len(results),
            "cached": len(cached_results),
            "results": results + cached_results,
            "using_mock": False,
            "batch_token_usage": usage,
            "cost_per_incident": cost_per_incident
        }

    except Exception as e:
        print(f"❌ Batch processing failed: {e}")
        # Fall back to individual processing
        results = []
        for incident_request, incident in incidents_to_process:
            try:
                individual_result = await generate_hypotheses(incident_request)
                results.append({
                    "incident_id": incident_request.incident_id,
                    "hypotheses": individual_result.get("hypotheses", []),
                    "cached": False
                })
            except Exception:
                pass

        return {
            "batch_size": len(incidents),
            "processed": len(results),
            "cached": len(cached_results),
            "results": results + cached_results,
            "using_mock": USE_MOCK,
            "error": "Batch processing failed, fell back to individual processing"
        }


@router.get("/status")
async def ai_status():
    """Get AI service status"""
    return {
        "status": "operational",
        "using_mock": USE_MOCK,
        "api_configured": not USE_MOCK
    }
