.PHONY: install run test lint format db migrate migration collect build

install: ## install dependencies
	npm ci

db: ## start Postgres (docker)
	docker compose up -d --wait db

migrate: db ## apply DB migrations (explicit step)
	npm run db:migrate

migration: ## generate a migration after editing src/shared/db/schema.ts
	npm run db:generate

run: migrate ## dev server on http://localhost:3000
	npm run dev

collect: db ## run price collectors once
	npm run collect

test: db ## unit + integration tests (uses database supermkt_test)
	npm test

lint:
	npm run lint

format:
	npm run format

build: ## production image
	docker compose build app
