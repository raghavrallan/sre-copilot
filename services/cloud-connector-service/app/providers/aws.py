"""
AWS provider - test connection, sync resources, sync metrics
"""
import asyncio
from typing import Any, Dict, List


async def test_aws_connection(credentials: dict) -> dict:
    """Test AWS credentials. Returns status dict. Uses boto3 STS get-caller-identity."""
    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError

        access_key = credentials.get("access_key_id") or credentials.get("accessKeyId")
        secret_key = credentials.get("secret_access_key") or credentials.get("secretAccessKey")
        region = credentials.get("region", "us-east-1")

        if not access_key or not secret_key:
            return {
                "success": False,
                "message": "Missing required credentials: access_key_id, secret_access_key",
            }

        def _test():
            sts = boto3.client(
                "sts",
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
            )
            identity = sts.get_caller_identity()
            return identity

        loop = asyncio.get_event_loop()
        identity = await loop.run_in_executor(None, _test)
        return {
            "success": True,
            "message": "AWS credentials validated successfully",
            "account_id": identity.get("Account"),
            "arn": identity.get("Arn"),
        }
    except ImportError as e:
        return {
            "success": False,
            "message": f"AWS SDK (boto3) not installed: {e}",
            "error": "ImportError",
        }
    except Exception as e:
        err_msg = str(e)
        if "InvalidClientTokenId" in err_msg or "SignatureDoesNotMatch" in err_msg or "InvalidAccessKeyId" in err_msg:
            return {"success": False, "message": "Invalid credentials", "error": type(e).__name__}
        if "NoCredentialsError" in type(e).__name__ or "no credentials" in err_msg.lower():
            return {"success": False, "message": "No credentials provided", "error": type(e).__name__}
        return {"success": False, "message": err_msg, "error": type(e).__name__}


async def sync_aws_resources(connection) -> list:
    """Pull resources from AWS account: EC2 instances, ECS services, RDS instances, Lambda functions."""
    resources = []
    try:
        from app.utils.encryption import decrypt_credentials
        import boto3

        creds = decrypt_credentials(connection.credentials_encrypted)
        region = creds.get("region") or connection.config.get("region", "us-east-1")
        access_key = creds.get("access_key_id") or creds.get("accessKeyId")
        secret_key = creds.get("secret_access_key") or creds.get("secretAccessKey")

        def _list_ec2():
            ec2 = boto3.client(
                "ec2",
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
            )
            resp = ec2.describe_instances()
            instances = []
            for r in resp.get("Reservations", []):
                for i in r.get("Instances", []):
                    state = i.get("State", {}).get("Name", "unknown")
                    instances.append({
                        "type": "ec2",
                        "id": i.get("InstanceId"),
                        "name": next((t["Value"] for t in i.get("Tags", []) if t["Key"] == "Name"), i.get("InstanceId")),
                        "state": state,
                        "instance_type": i.get("InstanceType"),
                    })
            return instances

        loop = asyncio.get_event_loop()
        resources = await loop.run_in_executor(None, _list_ec2)
        # ECS, RDS, Lambda would require additional describe_* calls - extend as needed
    except ImportError:
        return []
    except Exception:
        return []
    return resources


async def sync_aws_metrics(connection) -> list:
    """Pull metrics from CloudWatch."""
    metrics = []
    try:
        from app.utils.encryption import decrypt_credentials
        import boto3

        creds = decrypt_credentials(connection.credentials_encrypted)
        region = creds.get("region") or connection.config.get("region", "us-east-1")
        access_key = creds.get("access_key_id") or creds.get("accessKeyId")
        secret_key = creds.get("secret_access_key") or creds.get("secretAccessKey")

        def _list_metrics():
            cw = boto3.client(
                "cloudwatch",
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
            )
            return cw.list_metrics(MaxRecords=50)

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, _list_metrics)
        for m in resp.get("Metrics", [])[:20]:
            metrics.append({
                "namespace": m.get("Namespace"),
                "metric_name": m.get("MetricName"),
                "dimensions": m.get("Dimensions", []),
            })
    except ImportError:
        return []
    except Exception:
        return []
    return metrics
