# Poupa.ai

Compara preços de supermercados em Portugal e divide a lista de compras entre 1 e 3 mercados para poupar o máximo.

## Rodar localmente
Requisitos: Node 24, Docker.

```bash
cp .env.example .env
make install
make run      # Postgres no docker + migrations + http://localhost:3000
make test
make lint
```

Mais: [produto](docs/product.md) · [arquitetura](docs/architecture.md) · [roadmap](docs/roadmap.md) · [deploy](docs/runbooks/deploy.md)
