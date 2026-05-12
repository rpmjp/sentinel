.PHONY: help install lint format typecheck test test-cov clean train serve frontend dev

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

train:  ## Train the fraud detection model (Phase 1)
	@echo "Not yet implemented — Phase 1, Step 1.6"

serve:  ## Start FastAPI dev server (Phase 2)
	@echo "Not yet implemented — Phase 2, Step 2.2"

frontend:  ## Start frontend dev server (Phase 3)
	@echo "Not yet implemented — Phase 3, Step 3.1"

dev:  ## Start all services locally (Phase 4)
	@echo "Not yet implemented — Phase 4, Step 4.2"
