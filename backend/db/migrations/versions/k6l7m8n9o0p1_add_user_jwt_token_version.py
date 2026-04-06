from alembic import op as _op
import sqlalchemy as sa


revision = "k6l7m8n9o0p1"
down_revision = "j5k6l7m8n9o0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _op.add_column(
        "users",
        sa.Column("jwt_token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    _op.alter_column("users", "jwt_token_version", server_default=None)


def downgrade() -> None:
    _op.drop_column("users", "jwt_token_version")
