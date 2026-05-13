.PHONY: help install lint format typecheck test test-cov clean train mlflow-ui frontend-install seed seed-txns serve frontend dev

help:  ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install all dependencies
	uv sync

lint:  ## Run ruff linter
	uv run ruff check .

format:  ## Format code with ruff
	uv run ruff format .
	uv run ruff check --fix .

typecheck:  ## Run mypy type checking
	uv run mypy ml api

test:  ## Run all tests
	uv run pytest

test-cov:  ## Run tests with coverage
	uv run pytest --cov=ml --cov=api --cov-report=html

clean:  ## Remove cache and build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf htmlcov .coverage

train:  ## Train the fraud detection model (use MODEL=lightgbm|xgboost|logreg, SAMPLE=1.0)
	uv run python -m ml.training.train --model $(or $(MODEL),lightgbm) --sample-frac $(or $(SAMPLE),1.0)

mlflow-ui:  ## Open MLflow UI at http://localhost:5000
	uv run mlflow ui --backend-store-uri file:./mlruns

seed:  ## Seed demo tenant, users, and model_version into Postgres
	uv run python -m scripts.seed_demo

seed-txns:  ## Seed 500 scored demo transactions into Postgres
	uv run python -m scripts.seed_transactions

serve:  ## Start FastAPI dev server on http://localhost:8000
	uv run uvicorn api.main:app --reload --port 8000

frontend:  ## Start frontend dev server on http://localhost:5173
	cd frontend && pnpm dev

frontend-install:  ## Install frontend dependencies
	cd frontend && pnpm install

dev:  ## Start all services locally (Phase 4)
	@echo "Not yet implemented — Phase 4, Step 4.2"
