# Sentinel

Production-grade fraud detection platform.

**Status:** in development. See [`docs/build_plan.md`](docs/build_plan.md) for the roadmap.

## Quick start

```bash
make install
make test
make lint
```

## Stack

- **ML:** Python 3.12, LightGBM, XGBoost, MLflow, DVC, Prefect
- **API:** FastAPI, PostgreSQL 16, SQLAlchemy 2.0, Alembic, Pydantic v2
- **Frontend:** Vite, React 18, TypeScript, Tailwind, shadcn/ui, Recharts
- **Infra:** Docker, GitHub Actions, Railway
