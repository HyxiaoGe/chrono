"""add topic_normalized column

Revision ID: a1b2c3d4e5f6
Revises: fa54caecf7c9
Create Date: 2026-03-03 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "fa54caecf7c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add topic_normalized column (nullable initially)
    op.add_column(
        "researches",
        sa.Column("topic_normalized", sa.String(512), nullable=True, server_default=""),
    )

    # Backfill existing rows
    op.execute("UPDATE researches SET topic_normalized = LOWER(TRIM(topic))")

    # Deduplicate: keep only the newest row per normalized topic
    op.execute("""
        DELETE FROM researches
        WHERE id NOT IN (
            SELECT DISTINCT ON (topic_normalized) id
            FROM researches
            ORDER BY topic_normalized, created_at DESC
        )
    """)

    # Make non-nullable
    op.alter_column("researches", "topic_normalized", nullable=False)

    # Replace unique index on topic with non-unique
    op.drop_index("ix_researches_topic", table_name="researches")
    op.create_index("ix_researches_topic", "researches", ["topic"])

    # Add unique index on topic_normalized
    op.create_index(
        "ix_researches_topic_normalized", "researches", ["topic_normalized"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_researches_topic_normalized", table_name="researches")
    op.drop_index("ix_researches_topic", table_name="researches")
    op.create_index("ix_researches_topic", "researches", ["topic"], unique=True)
    op.drop_column("researches", "topic_normalized")
