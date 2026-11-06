# Runbook: deploy (configuração única + como funciona)

Objetivo: alguém sem contexto consegue colocar o app no ar numa VPS e entender o deploy automático.
Última vez testado: ainda não executado na VPS (o deploy.sh e a imagem foram validados localmente em 2026-11-06).

## Como funciona
```
PR aberto       → CI: install, lint, test                 (nada é publicado)
Merge na main   → build da imagem (tag = commit) → push no GHCR
                → SSH na VPS → deploy/deploy.sh <tag>
deploy.sh       → backup do banco → migrations → sobe a nova versão → healthcheck
                → falhou? volta para a última versão boa, sozinho
```

## Pré-requisitos
- [ ] VPS Linux (ex.: Hetzner CX22, ~5 €/mês) com Docker + plugin compose e `git`.
- [ ] Repositório no GitHub.
- Segredos necessários: ver `.env.example` (valores ficam fora do git).

## Passos (uma vez)
1. **Criar o usuário de deploy na VPS (sem root, com chave SSH dedicada)**
   ```bash
   sudo adduser --disabled-password deploy && sudo usermod -aG docker deploy
   # no seu computador:
   ssh-keygen -t ed25519 -f ~/.ssh/supermkt_deploy -N ""
   # copiar ~/.ssh/supermkt_deploy.pub para /home/deploy/.ssh/authorized_keys na VPS
   ```
   ✅ Deu certo se: `ssh -i ~/.ssh/supermkt_deploy deploy@<VPS>` entra sem senha.
2. **Clonar o repo e criar o `.env` na VPS**
   ```bash
   cd ~ && git clone <url-do-repo> super_mkt_app && cd super_mkt_app
   cp .env.example .env   # editar: senha forte, DATABASE_URL com host "db", IMAGE=ghcr.io/<owner>/super_mkt_app
   ```
3. **Permitir a VPS puxar imagens do GHCR** (se o pacote for privado)
   ```bash
   echo <PAT com read:packages> | docker login ghcr.io -u <usuario-github> --password-stdin
   ```
4. **Secrets no GitHub** → Settings → Environments → `production`: `VPS_HOST`, `VPS_USER` (`deploy`), `VPS_SSH_KEY` (conteúdo de `~/.ssh/supermkt_deploy`), `VPS_KNOWN_HOSTS` (saída de `ssh-keyscan <VPS>`).
5. **Proteger a main** → Settings → Branches → exigir PR + status check `ci / test`.
6. **Cron diário do collector** (na VPS, `crontab -e` do usuário deploy):
   ```cron
   0 6 * * * cd ~/super_mkt_app && IMAGE_TAG=$(cat .last_good_tag) docker compose run --rm collector >> collector.log 2>&1
   ```
7. **Expor na internet com HTTPS:** o app escuta só em `127.0.0.1:3000`. Colocar um proxy reverso (ex.: Caddy, que gera o certificado sozinho) apontando para ele. Um PWA exige HTTPS.

## Se der errado
| Sintoma | O que fazer |
|---|---|
| Deploy falhou no healthcheck | O `deploy.sh` já voltou à versão anterior. Ver `docker compose logs app`. |
| Migration estragou dados | Restaurar o backup: `gunzip -c backups/pre-<tag>.sql.gz \| docker compose exec -T db psql -U app supermkt` |
| `pull` negado no GHCR | Refazer o passo 3. |
<!-- Ver também docs/learnings.md -->

## Como verificar que está tudo ok
- `curl -fsS http://127.0.0.1:3000/api/health` na VPS → `{"status":"ok"}`
- O link HTTPS abre no celular e oferece "Adicionar ao ecrã principal".
