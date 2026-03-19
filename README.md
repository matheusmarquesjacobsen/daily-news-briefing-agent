# 🤖 Daily News Briefing Agent

Agente autônomo de inteligência de notícias que roda automaticamente todo dia às 7h, coleta artigos em tempo real da web, analisa com IA e entrega um briefing diário formatado direto no Gmail.

## Stack

- **Google Apps Script** — orquestrador e agendamento
- **Apify** (`apify/rag-web-browser`) — busca de artigos em tempo real
- **Anthropic API** (Claude Sonnet) — análise e geração do HTML
- **Gmail API** — entrega do e-mail
- **PropertiesService** — persistência de dados entre execuções

## Arquitetura
```
Google Apps Script (Orquestrador)
        ↓
Apify RAG Web Browser (Busca de artigos)
        ↓
Anthropic API — Claude Sonnet (Análise e geração de HTML)
        ↓
Gmail API (Entrega do e-mail)
```

## Categorias

| Categoria | Fontes |
|---|---|
| Global News | Reuters, AP News, BBC |
| Brazil News | Folha de S.Paulo, O Globo, Estadão |
| Technology & AI | MIT Technology Review, The Verge, Wired |
| Startups & Venture Capital | TechCrunch, Crunchbase News, Sifted |
| Labor Market & Future of Work | Harvard Business Review, WEF, McKinsey |

## Como funciona

O agente usa **1 gatilho único** (`iniciarBriefing`) às 7h com continuação automática caso o tempo de execução esgotar:

1. Busca artigos das 5 categorias via Apify (3 artigos cada)
2. Gera HTML com Claude em 2 chamadas (categorias 1–3 e 4–5 + Key Trends)
3. Envia o e-mail formatado via Gmail

Se o tempo de execução do Google Apps Script (6 min) esgotar em qualquer fase, o script salva o progresso e agenda automaticamente uma continuação para 1 minuto depois.

## Configuração

### 1. Credenciais necessárias

| Serviço | Onde obter |
|---|---|
| Anthropic API Key | console.anthropic.com/settings/apikeys |
| Apify API Token | console.apify.com/account/integrations |

### 2. Google Apps Script

1. Acesse [script.google.com](https://script.google.com)
2. Crie um novo projeto chamado `Daily News Briefing`
3. Cole o conteúdo de `Code.gs`
4. Substitua as chaves em `CONFIG`:
```javascript
const CONFIG = {
  ANTHROPIC_API_KEY: "SUA_CHAVE_ANTHROPIC_AQUI",
  APIFY_API_KEY:     "SUA_CHAVE_APIFY_AQUI",
  EMAIL_DESTINO:     "seu@email.com",
};
```

### 3. Gatilho

No Google Apps Script → Gatilhos → Adicionar gatilho:

| Campo | Valor |
|---|---|
| Função | `iniciarBriefing` |
| Tipo | Contador de dias |
| Hora | 7h – 8h |

### 4. Autorizar permissões (primeira vez)

Execute a função `autorizarPermissoes` e clique em "Permitir" na janela que aparecer.

## Troubleshooting

| Erro | Causa | Solução |
|---|---|---|
| 401 Invalid credentials | API Key expirada | Gerar nova em console.anthropic.com |
| 400 Credit balance too low | Saldo esgotado | Adicionar créditos em console.anthropic.com/settings/billing |
| Address unavailable | Permissões revogadas | Executar `autorizarPermissoes` novamente |
| E-mail não chegou | Erro em alguma etapa | Verificar logs em script.google.com → Execuções |

## Custo estimado

| Serviço | Por dia | Por mês |
|---|---|---|
| Anthropic API | ~$0.08–0.12 | ~$2.50–3.50 |
| Apify | ~$0.10–0.20 | ~$3.00–6.00 |
| Google Apps Script | Gratuito | $0 |
| **Total** | **~$0.18–0.32** | **~$5.50–9.50** |

## Histórico de versões

| Versão | Data | Mudanças |
|---|---|---|
| v1 | 18/03/2026 | Script inicial sem busca web |
| v2 | 18/03/2026 | Integração com Apify |
| v3 | 18/03/2026 | Layout HTML melhorado |
| v4 | 18/03/2026 | Claude gera HTML diretamente |
| v5 | 18/03/2026 | Fontes atualizadas, 3 artigos por categoria |
| v6 | 18/03/2026 | Conteúdo expandido de 1.200 para 4.000 chars |
| v7 | 19/03/2026 | Execução em 3 etapas, bullets mínimo 35 palavras |
| v8 | 19/03/2026 | Gatilho único com continuação automática |

## Autor

Matheus Marques Jacobsen — criado com auxílio de Claude (Anthropic)
```
