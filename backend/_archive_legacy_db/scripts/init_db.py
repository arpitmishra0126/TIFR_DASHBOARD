"""Create all V1 tables in the configured PostgreSQL database.

Usage (from backend/):
    python -m scripts.init_db

V1 uses a single create_all pass rather than migrations; introduce Alembic
when the schema needs versioned migrations in a later phase.
"""
import logging

from app.core.logging import configure_logging
from app.database import Base, engine
from app.models import (  # noqa: F401 — import registers all models on Base.metadata
    AssessmentProgress,
    Child,
    HealthScreening,
    NeurodevelopmentAssessment,
    PhysicalActivity,
    ScreenTime,
    SESProfile,
)

configure_logging()
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("Creating tables on %s", engine.url.render_as_string(hide_password=True))
    Base.metadata.create_all(bind=engine)
    logger.info("Done.")


if __name__ == "__main__":
    main()
