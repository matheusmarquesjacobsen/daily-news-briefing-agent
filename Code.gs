// ============================================================
// DAILY NEWS BRIEFING — Claude Intelligence Agent v8
// Arquitetura: 1 gatilho único + continuação automática
// ============================================================

const CONFIG = {
  ANTHROPIC_API_KEY: "SUA_CHAVE_ANTHROPIC_AQUI",
  APIFY_API_KEY:     "SUA_CHAVE_APIFY_AQUI",
  EMAIL_DESTINO:     "seu@email.com",
  MODELO:            "claude-sonnet-4-20250514",
  MAX_TOKENS:        16000,
  TEMPO_LIMITE_MS:   300000, // 5 minutos em ms (limite seguro antes dos 6min do GAS)
};

const QUERIES = [
  {
    label: "Global News",
    cor:   "#1a237e",
    query: "site:reuters.com OR site:apnews.com OR site:bbc.com world news today"
  },
  {
    label: "Brazil News",
    cor:   "#1b5e20",
    query: "site:folha.uol.com.br OR site:oglobo.globo.com OR site:estadao.com.br Brazil news today"
  },
  {
    label: "Technology & AI",
    cor:   "#0d47a1",
    query: "site:technologyreview.com OR site:theverge.com OR site:wired.com technology AI news today"
  },
  {
    label: "Startups & Venture Capital",
    cor:   "#4a148c",
    query: "site:techcrunch.com OR site:news.crunchbase.com OR site:sifted.eu startup venture capital funding news today"
  },
  {
    label: "Labor Market & Future of Work",
    cor:   "#b71c1c",
    query: "site:hbr.org OR site:weforum.org OR site:mckinsey.com labor market future of work AI jobs today"
  },
];

// ============================================================
// PONTO DE ENTRADA — chamado pelo gatilho único às 7h
// ============================================================

function iniciarBriefing() {
  const props = PropertiesService.getScriptProperties();

  // Limpa dados de execuções anteriores
  props.deleteAllProperties();
  props.setProperty("progresso", "0");       // índice da próxima categoria a buscar
  props.setProperty("inicio", String(Date.now())); // marca o tempo de início

  Logger.log("=== Iniciando Daily News Briefing v8 ===");
  continuarBriefing()
  ;
}

// ============================================================
// ORQUESTRADOR — executa o máximo possível dentro do tempo
// ============================================================

function continuarBriefing() {
  // Deleta gatilhos de continuação anteriores para evitar acúmulo
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "continuarBriefing") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  const props   = PropertiesService.getScriptProperties();
  const inicio  = parseInt(props.getProperty("inicio") || String(Date.now()));
  let progresso = parseInt(props.getProperty("progresso") || "0");

  Logger.log("Continuando briefing... progresso: " + progresso);

  // ── FASE 1: Buscar categorias ──────────────────────────────
  // progresso 0–4 = buscar cada categoria
  while (progresso < QUERIES.length) {
    if (tempoEsgotado(inicio)) {
      Logger.log("Tempo esgotado na busca da categoria " + progresso + ". Agendando continuação...");
      props.setProperty("progresso", String(progresso));
      agendarContinuacao();
      return;
    }

    Logger.log("Buscando categoria " + progresso + ": " + QUERIES[progresso].label);
    try {
      const artigos = chamarApify(QUERIES[progresso].query);
      const dados = {
        label:   QUERIES[progresso].label,
        cor:     QUERIES[progresso].cor,
        artigos: artigos
      };
      props.setProperty("cat_" + progresso, JSON.stringify(dados));
      Logger.log("  Categoria " + progresso + " salva com " + artigos.length + " artigos.");
    } catch (e) {
      Logger.log("  Erro na categoria " + progresso + ": " + e.message);
      // Salva categoria vazia para não travar o fluxo
      props.setProperty("cat_" + progresso, JSON.stringify({
        label:   QUERIES[progresso].label,
        cor:     QUERIES[progresso].cor,
        artigos: []
      }));
    }

    progresso++;
    props.setProperty("progresso", String(progresso));
  }

  // ── FASE 2: Gerar HTML Parte A (categorias 0–2) ────────────
  // progresso 5 = gerar parte A
  if (progresso === QUERIES.length) {
    if (tempoEsgotado(inicio)) {
      Logger.log("Tempo esgotado antes de gerar HTML Parte A. Agendando continuação...");
      agendarContinuacao();
      return;
    }

    Logger.log("Gerando HTML Parte A (categorias 1-3)...");
    try {
      const grupoA = [0, 1, 2].map(function(i) {
        return JSON.parse(props.getProperty("cat_" + i));
      });
      const htmlA = gerarHTMLParte(grupoA, false);
      props.setProperty("htmlA", htmlA);
      progresso = 6;
      props.setProperty("progresso", String(progresso));
      Logger.log("  HTML Parte A gerado.");
    } catch (e) {
      Logger.log("Erro ao gerar HTML Parte A: " + e.message);
      enviarEmailErro("Erro ao gerar HTML Parte A: " + e.message);
      props.deleteAllProperties();
      return;
    }
  }

  // ── FASE 3: Gerar HTML Parte B (categorias 3–4 + Key Trends) ─
  // progresso 6 = gerar parte B
  if (progresso === 6) {
    if (tempoEsgotado(inicio)) {
      Logger.log("Tempo esgotado antes de gerar HTML Parte B. Agendando continuação...");
      agendarContinuacao();
      return;
    }

    Logger.log("Gerando HTML Parte B (categorias 4-5 + Key Trends)...");
    try {
      const grupoB = [3, 4].map(function(i) {
        return JSON.parse(props.getProperty("cat_" + i));
      });
      const htmlB = gerarHTMLParte(grupoB, true);
      props.setProperty("htmlB", htmlB);
      progresso = 7;
      props.setProperty("progresso", String(progresso));
      Logger.log("  HTML Parte B gerado.");
    } catch (e) {
      Logger.log("Erro ao gerar HTML Parte B: " + e.message);
      enviarEmailErro("Erro ao gerar HTML Parte B: " + e.message);
      props.deleteAllProperties();
      return;
    }
  }

  // ── FASE 4: Enviar e-mail ─────────────────────────────────
  // progresso 7 = enviar e-mail
  if (progresso === 7) {
    Logger.log("Enviando e-mail...");
    try {
      const htmlA = props.getProperty("htmlA");
      const htmlB = props.getProperty("htmlB");
      enviarEmail(htmlA + htmlB);
      Logger.log("✅ Briefing concluído! E-mail enviado para " + CONFIG.EMAIL_DESTINO);
    } catch (e) {
      Logger.log("Erro ao enviar e-mail: " + e.message);
      enviarEmailErro("Erro ao enviar e-mail: " + e.message);
    } finally {
      // Limpa todos os dados temporários
      props.deleteAllProperties();
    }
  }
}

// ============================================================
// CONTROLE DE TEMPO E CONTINUAÇÃO AUTOMÁTICA
// ============================================================

function tempoEsgotado(inicio) {
  return (Date.now() - inicio) >= CONFIG.TEMPO_LIMITE_MS;
}

function agendarContinuacao() {
  // Cria um gatilho one-time para daqui a 1 minuto
  ScriptApp.newTrigger("continuarBriefing")
    .timeBased()
    .after(60 * 1000) // 1 minuto
    .create();
  Logger.log("Gatilho de continuação agendado para daqui a 1 minuto.");
}

// ============================================================
// BUSCA VIA APIFY
// ============================================================

function chamarApify(query) {
  const startResp = UrlFetchApp.fetch(
    "https://api.apify.com/v2/acts/apify~rag-web-browser/runs",
    {
      method:             "post",
      contentType:        "application/json",
      headers:            { "Authorization": "Bearer " + CONFIG.APIFY_API_KEY },
      payload:            JSON.stringify({ query: query, maxResults: 3, outputFormats: ["markdown"] }),
      muteHttpExceptions: true
    }
  );

  if (startResp.getResponseCode() !== 201) {
    throw new Error("Apify start error: " + startResp.getContentText());
  }

  const startData = JSON.parse(startResp.getContentText());
  const runId     = startData.data.id;
  const datasetId = startData.data.defaultDatasetId;

  // Polling
  let status     = "RUNNING";
  let tentativas = 0;
  while ((status === "RUNNING" || status === "READY") && tentativas < 24) {
    Utilities.sleep(5000);
    tentativas++;
    const s = UrlFetchApp.fetch(
      "https://api.apify.com/v2/acts/apify~rag-web-browser/runs/" + runId,
      {
        method:             "get",
        headers:            { "Authorization": "Bearer " + CONFIG.APIFY_API_KEY },
        muteHttpExceptions: true
      }
    );
    status = JSON.parse(s.getContentText()).data.status;
    Logger.log("    Apify status: " + status + " (" + tentativas + ")");
  }

  const dataResp = UrlFetchApp.fetch(
    "https://api.apify.com/v2/datasets/" + datasetId + "/items?limit=3",
    {
      method:             "get",
      headers:            { "Authorization": "Bearer " + CONFIG.APIFY_API_KEY },
      muteHttpExceptions: true
    }
  );

  return JSON.parse(dataResp.getContentText()).map(function(item) {
    return {
      titulo: item.metadata && item.metadata.title ? item.metadata.title : "No title",
      url:    item.metadata && item.metadata.url   ? item.metadata.url   : "#",
      fonte:  extrairFonte(item.metadata && item.metadata.url ? item.metadata.url : ""),
      resumo: item.markdown ? item.markdown.substring(0, 4000) : ""
    };
  });
}

function extrairFonte(url) {
  const map = {
    "reuters.com":          "Reuters",
    "apnews.com":           "AP News",
    "bbc.com":              "BBC",
    "bbc.co.uk":            "BBC",
    "folha.uol":            "Folha de S.Paulo",
    "oglobo":               "O Globo",
    "estadao.com.br":       "Estadao",
    "valorinternacional":   "Valor Internacional",
    "agenciabrasil":        "Agencia Brasil",
    "technologyreview.com": "MIT Technology Review",
    "theverge.com":         "The Verge",
    "wired.com":            "Wired",
    "techcrunch.com":       "TechCrunch",
    "news.crunchbase.com":  "Crunchbase News",
    "sifted.eu":            "Sifted",
    "hbr.org":              "Harvard Business Review",
    "weforum.org":          "World Economic Forum",
    "mckinsey.com":         "McKinsey",
    "fortune.com":          "Fortune",
    "cnbc.com":             "CNBC",
    "bloomberg.com":        "Bloomberg"
  };
  for (var k in map) {
    if (url.indexOf(k) !== -1) return map[k];
  }
  try {
    var m = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
    return m ? m[1] : "Source";
  } catch(e) { return "Source"; }
}

// ============================================================
// GERAÇÃO DE HTML COM CLAUDE
// ============================================================

function gerarHTMLParte(categorias, incluirTrends) {
  const hoje = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let contexto = "Today's date: " + hoje + "\n\n";
  contexto += "Articles collected from the web:\n\n";

  categorias.forEach(function(cat) {
    contexto += "=== " + cat.label.toUpperCase() + " (color: " + cat.cor + ") ===\n";
    if (!cat.artigos || cat.artigos.length === 0) {
      contexto += "(No articles found)\n\n";
      return;
    }
    cat.artigos.forEach(function(art, i) {
      contexto += "Article " + (i + 1) + ":\n";
      contexto += "Title:   " + art.titulo + "\n";
      contexto += "URL:     " + art.url    + "\n";
      contexto += "Source:  " + art.fonte  + "\n";
      contexto += "Content:\n" + art.resumo + "\n\n";
    });
  });

  const trendsBloco = incluirTrends ? `

After the last category, add a Key Trends section:

<div style="margin-bottom:32px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">
  <div style="background:#212121;padding:16px 24px;">
    <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Analysis</div>
    <div style="color:#ffffff;font-size:20px;font-weight:800;font-family:Arial,sans-serif;">Key Trends</div>
  </div>
  <div style="background:#ffffff;padding:24px;">
    [REPEAT THIS BLOCK EXACTLY 5 TIMES:]
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td width="34" valign="top">
          <div style="width:30px;height:30px;background:#212121;color:#ffffff;font-size:14px;font-weight:700;border-radius:50%;text-align:center;line-height:30px;font-family:Arial,sans-serif;">[N]</div>
        </td>
        <td style="padding-left:14px;font-size:15px;color:#333333;line-height:1.7;font-family:Arial,sans-serif;padding-top:4px;">
          <strong>[Trend title]:</strong> [2-3 sentences connecting patterns across today's categories — specific, analytical, minimum 40 words]
        </td>
      </tr>
    </table>
  </div>
</div>` : "";

  const prompt = contexto + `
---

TASK: Generate inner HTML content for a daily news briefing email.

CRITICAL RULES:
1. Return ONLY raw HTML — no markdown, no explanation, no code fences.
2. Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags.
3. Inline styles only.
4. ALL text in ENGLISH.
5. EXACTLY 3 stories per category.
6. Font sizes: headline 18px, bullets 15px, insight 14px.
7. Story backgrounds: Story 1 = #ffffff, Story 2 = #f8f9fa, Story 3 = #ffffff.

CONTENT QUALITY — MOST IMPORTANT:
- Each bullet: full sentence, minimum 35 words, with specific facts, data, names, numbers from the article.
- No vague bullets. Example of BAD bullet: "Pentagon requests funding." Example of GOOD bullet: "The Pentagon submitted a $200+ billion supplemental funding request to Congress — the largest single military budget request since World War II — specifically earmarked for ongoing Iran war operations in the Middle East, according to senior administration officials who confirmed the unprecedented allocation to Reuters."
- Key Insight: 2-3 sentences, minimum 40 words, genuine strategic analysis of what the story signals and why it matters.
- Use ALL article content provided — extract specific quotes, numbers and facts.

HTML STRUCTURE FOR EACH CATEGORY:

<div style="margin-bottom:32px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">
  <div style="background:[CATEGORY_COLOR];padding:16px 24px;">
    <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Daily Briefing</div>
    <div style="color:#ffffff;font-size:20px;font-weight:800;font-family:Arial,sans-serif;">[CATEGORY NAME UPPERCASE]</div>
  </div>

  [FOR EACH OF 3 STORIES:]
  <div style="background:[STORY_BG];padding:22px 24px;border-bottom:1px solid #eeeeee;">
    <div style="margin-bottom:10px;">
      <span style="background:[CATEGORY_COLOR];color:#ffffff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">[SOURCE]</span>
    </div>
    <h3 style="margin:0 0 14px;font-size:18px;font-weight:700;line-height:1.4;font-family:Arial,sans-serif;">
      <a href="[URL]" style="color:#1a1a2e;text-decoration:none;">[HEADLINE]</a>
    </h3>
    <ul style="margin:0 0 14px;padding-left:20px;font-family:Arial,sans-serif;">
      <li style="margin:6px 0;font-size:15px;color:#444444;line-height:1.7;">[Bullet 1 — min 35 words, specific facts, names, numbers from the article]</li>
      <li style="margin:6px 0;font-size:15px;color:#444444;line-height:1.7;">[Bullet 2 — min 35 words, specific facts, names, numbers from the article]</li>
      <li style="margin:6px 0;font-size:15px;color:#444444;line-height:1.7;">[Bullet 3 — min 35 words, specific facts, names, numbers from the article]</li>
    </ul>
    <div style="background:#f0f4ff;border-left:4px solid [CATEGORY_COLOR];padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;color:[CATEGORY_COLOR];text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;margin-bottom:6px;">Key Insight</div>
      <div style="font-size:14px;color:#333333;line-height:1.7;font-family:Arial,sans-serif;">[Strategic analysis, 2-3 sentences, min 40 words]</div>
    </div>
    <a href="[URL]" style="display:inline-block;background:[CATEGORY_COLOR];color:#ffffff;font-size:12px;font-weight:600;padding:8px 18px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;">Read full article &rarr;</a>
  </div>
</div>
` + trendsBloco + `

Generate complete HTML using all article content provided. Be thorough and specific.`;

  return chamarClaudeAPI(prompt);
}

function chamarClaudeAPI(promptTexto) {
  const resposta = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method:      "post",
    contentType: "application/json",
    headers: {
      "x-api-key":         CONFIG.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify({
      model:      CONFIG.MODELO,
      max_tokens: CONFIG.MAX_TOKENS,
      messages:   [{ role: "user", content: promptTexto }]
    }),
    muteHttpExceptions: true
  });

  const codigo = resposta.getResponseCode();
  const corpo  = JSON.parse(resposta.getContentText());

  if (codigo !== 200) {
    throw new Error("Anthropic API error " + codigo + ": " + JSON.stringify(corpo));
  }

  let html = corpo.content[0].text;
  html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  return html;
}

// ============================================================
// ENVIO DE E-MAIL
// ============================================================

function enviarEmail(htmlConteudo) {
  const hoje = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlCompleto = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
  <tr><td align="center">
    <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">
      <tr>
        <td style="background:linear-gradient(135deg,#1a237e,#283593);padding:32px 36px;border-radius:12px 12px 0 0;">
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Claude Intelligence Agent</p>
          <h1 style="margin:0 0 8px;color:#ffffff;font-size:28px;font-weight:800;font-family:Arial,sans-serif;">Daily News Briefing</h1>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;font-family:Arial,sans-serif;">${hoje}</p>
        </td>
      </tr>
      <tr><td style="background:#3949ab;height:4px;"></td></tr>
      <tr>
        <td style="padding:28px 16px 0;">
          ${htmlConteudo}
        </td>
      </tr>
      <tr>
        <td style="background:#e8eaf6;padding:18px 24px;border-radius:0 0 12px 12px;text-align:center;">
          <p style="margin:0;color:#7986cb;font-size:11px;font-family:Arial,sans-serif;">
            Generated automatically &bull; Claude (Anthropic) + Apify &bull; Google Apps Script
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  GmailApp.sendEmail(
    CONFIG.EMAIL_DESTINO,
    "Daily News Briefing — " + hoje,
    "Open in Gmail to view the full briefing.",
    { htmlBody: htmlCompleto, name: "Claude News Agent" }
  );
}

function enviarEmailErro(mensagemErro) {
  GmailApp.sendEmail(
    CONFIG.EMAIL_DESTINO,
    "ERROR — Daily News Briefing",
    "An error occurred:\n\n" + mensagemErro,
    { name: "Claude News Agent" }
  );
}

// ============================================================
// AUTORIZAÇÃO DE PERMISSÕES
// (usar apenas uma vez se aparecer erro "Address unavailable")
// ============================================================

function autorizarPermissoes() {
  UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    muteHttpExceptions: true,
    headers: { "x-api-key": "teste" },
    payload: "{}"
  });
  GmailApp.getInboxThreads(0, 1);
  PropertiesService.getScriptProperties().setProperty("teste", "ok");
  PropertiesService.getScriptProperties().deleteProperty("teste");
  Logger.log("Permissoes concedidas com sucesso!");
}

// ============================================================
// TESTE MANUAL
// ============================================================

function testarAgora() {
  iniciarBriefing();
}
