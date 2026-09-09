"""
VoicePilot AI — Application Entry Point
"""
import sys
import structlog
import uvicorn

from app.api.routes import create_app
from app.security.config import get_settings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger(__name__)

settings = get_settings()

# Validate configuration at startup
startup_issues = settings.validate_on_startup()
for issue in startup_issues:
    if issue.startswith("ERROR"):
        logger.error("startup_config_error", message=issue)
    else:
        logger.warning("startup_config_warning", message=issue)

app = create_app()


@app.on_event("startup")
async def on_startup():
    logger.info(
        "voicepilot_starting",
        config=settings.redacted_summary(),
    )
    # Pre-warm voice catalog
    from app.voice_catalog.catalog_service import get_catalog_service
    catalog = get_catalog_service()
    await catalog.ensure_loaded()
    logger.info("voice_catalog_loaded", status=catalog.get_cache_status())


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
