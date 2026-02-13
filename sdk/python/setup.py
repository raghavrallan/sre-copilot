"""SRE Copilot Python SDK setup."""
from setuptools import find_packages, setup

setup(
    name="sre-copilot-sdk",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "httpx>=0.24.0",
        "starlette>=0.27.0",
    ],
    python_requires=">=3.9",
    description="SRE Copilot Python SDK for auto-instrumentation",
)
