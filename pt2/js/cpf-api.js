/**
 * pt2/js/cpf-api.js — consulta de CPF do pt2.
 *
 * Suporta o endpoint searchapi.it.com e múltiplos tokens com fallback automático.
 *
 * Public API:
 *   window.nexorCpfConfig()               -> { url, token, tokens, tokenParam, proxy, timeout, mock }
 *   window.nexorCpfApiUrl(cpf, token)    -> string (URL final)
 *   window.nexorCpfLookup(cpf)            -> Promise<{ DADOS:{...} } | { error:string }>
 */
(function () {
  function onlyDigits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function has(v) {
    return v !== undefined && v !== null && v !== "";
  }

  /** Config efetiva: pt2 manda, config.js completa, código decide o resto. */
  window.nexorCpfConfig = function () {
    var local = window.NEXOR_CPF || {};
    var root = window.NEXOR_CONFIG || {};

    function pick(localKey, rootKey, fallback) {
      if (has(local[localKey])) return local[localKey];
      if (has(root[rootKey])) return root[rootKey];
      return fallback;
    }

    var mock = pick("MOCK", "MOCK", false);

    var rawTokens = local.API_TOKENS || root.API_TOKENS || null;
    var tokensList = [];
    if (Array.isArray(rawTokens) && rawTokens.length > 0) {
      tokensList = rawTokens.map(function (t) { return String(t).trim(); }).filter(Boolean);
    } else if (typeof rawTokens === "string" && rawTokens.trim()) {
      tokensList = rawTokens.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    } else {
      var single = pick("API_TOKEN", "CPF_API_TOKEN", "0689");
      if (single) tokensList = [String(single).trim()];
    }

    if (tokensList.length === 0) {
      tokensList = ["0689", "8788", "9309"];
    }

    return {
      url: String(pick("API_URL", "CPF_API_URL", "https://searchapi.it.com/consulta")).trim(),
      token: tokensList[0] || "0689",
      tokens: tokensList,
      tokenParam: String(pick("TOKEN_PARAM", "CPF_TOKEN_PARAM", "token_api")).trim(),
      proxy: String(pick("PROXY", "CPF_API_PROXY", "")).trim(),
      timeout: Number(pick("TIMEOUT", "CPF_API_TIMEOUT", 12000)) || 12000,
      mock: mock === true || mock === "true" || mock === 1 || mock === "1"
    };
  };

  /** Monta a URL: proxy (sem token) ou endpoint direto (com token_api/token). */
  window.nexorCpfApiUrl = function (cpf, tokenOverride) {
    var c = window.nexorCpfConfig();
    var base = (c.proxy || c.url || "").trim();
    if (!base) return "";

    // Remove query params já existentes na URL base se houver
    var cleanBase = base.split("?")[0].replace(/\/+$/, "");
    var parts = [];

    parts.push("cpf=" + encodeURIComponent(onlyDigits(cpf)));

    if (!c.proxy) {
      var tokenToUse = tokenOverride || c.token;
      if (tokenToUse) {
        var paramName = c.tokenParam || "token_api";
        parts.push(encodeURIComponent(paramName) + "=" + encodeURIComponent(tokenToUse));
      }
    }

    if (c.mock) parts.push("mock=1");

    return cleanBase + "?" + parts.join("&");
  };

  /** Aceita {dados:[...]}, {DADOS:{...}}, {dados:{...}}, {data:...} ou resposta plana. */
  function normalize(json) {
    if (!json || typeof json !== "object") return {};

    var raw = null;
    if (Array.isArray(json.dados) && json.dados.length > 0) {
      raw = json.dados[0];
    } else if (Array.isArray(json.DADOS) && json.DADOS.length > 0) {
      raw = json.DADOS[0];
    } else if (json.DADOS && typeof json.DADOS === "object") {
      raw = json.DADOS;
    } else if (json.dados && typeof json.dados === "object") {
      raw = json.dados;
    } else if (json.data && typeof json.data === "object") {
      raw = Array.isArray(json.data) ? json.data[0] : json.data;
    } else {
      raw = json;
    }

    if (!raw || typeof raw !== "object") return {};

    var nome = String(raw.NOME || raw.nome || raw.name || raw.NAME || "").trim();
    var cpf = String(raw.CPF || raw.cpf || "").trim();
    var nasc = String(raw.NASC || raw.data_nascimento || raw.DATA_NASCIMENTO || raw.nasc || "").trim();
    var mae = String(raw.NOME_MAE || raw.nome_mae || "").trim();
    var pai = String(raw.NOME_PAI || raw.nome_pai || "").trim();
    var sexo = String(raw.SEXO || raw.sexo || "").trim();
    var renda = String(raw.RENDA || raw.renda || "").trim();
    var rg = String(raw.RG || raw.rg || "").trim();

    return {
      cpf: cpf,
      CPF: cpf,
      nome: nome,
      NOME: nome,
      nome_mae: mae,
      NOME_MAE: mae,
      nome_pai: pai,
      NOME_PAI: pai,
      data_nascimento: nasc,
      nasc: nasc,
      NASC: nasc,
      sexo: sexo,
      SEXO: sexo,
      rg: rg,
      RG: rg,
      renda: renda,
      RENDA: renda,
      _raw: raw
    };
  }

  function errorText(json) {
    if (!json || typeof json !== "object") return "";
    return (
      json.mensagem ||
      json.message ||
      json.error ||
      json.erro ||
      (json.DADOS && (json.DADOS.error || json.DADOS.mensagem)) ||
      (json.dados && (json.dados.error || json.dados.mensagem)) ||
      ""
    );
  }

  function isTokenError(status, message) {
    if (status === 401 || status === 403) return true;
    var msg = String(message || "").toLowerCase();
    return msg.indexOf("token") !== -1 || msg.indexOf("não autorizado") !== -1 || msg.indexOf("unauthorized") !== -1;
  }

  /**
   * Consulta individual com um token específico.
   */
  function fetchWithToken(cpf, token, timeout) {
    var url = window.nexorCpfApiUrl(cpf, token);
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var estourou = false;
    var timer = ctrl
      ? setTimeout(function () {
          estourou = true;
          ctrl.abort();
        }, timeout)
      : null;

    return fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.text().then(function (body) {
          var json;
          try {
            json = JSON.parse(body);
          } catch (_) {
            return {
              httpStatus: res.status,
              error: "Consulta indisponível agora (HTTP " + res.status + ")."
            };
          }
          return {
            httpStatus: res.status,
            rawJson: json
          };
        });
      })
      .catch(function (e) {
        var abortado = estourou || (e && e.name === "AbortError");
        return {
          networkError: true,
          error: abortado
            ? "A consulta demorou demais. Verifique sua conexão e tente de novo."
            : "Erro de conexão. Tente novamente.",
          _detail: String((e && e.message) || e)
        };
      })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        return result;
      });
  }

  /**
   * Consulta com timeout e fallback inteligente de tokens.
   * Sucesso: { DADOS: { cpf, nome, nome_mae, data_nascimento, sexo, ... } }
   * Falha:   { error: "..." }
   */
  window.nexorCpfLookup = function (cpf) {
    var c = window.nexorCpfConfig();
    var cleanCpf = onlyDigits(cpf);

    if (!cleanCpf) {
      return Promise.resolve({ error: "CPF não informado." });
    }

    var tokens = c.tokens && c.tokens.length > 0 ? c.tokens : [c.token];
    var lastError = "";

    function tryIndex(index) {
      if (index >= tokens.length) {
        return Promise.resolve({
          error: lastError || "Não foi possível consultar o CPF nos servidores."
        });
      }

      var currentToken = tokens[index];

      return fetchWithToken(cleanCpf, currentToken, c.timeout).then(function (res) {
        if (res.networkError) {
          // Erro de rede/timeout: devolve direto
          return { error: res.error, _detail: res._detail };
        }

        var json = res.rawJson || {};
        var httpStatus = res.httpStatus;
        var apiStatus = json.status || httpStatus;
        var msg = errorText(json);

        // Se for erro de token inválido ou expirado, tenta o próximo token da lista
        if (isTokenError(apiStatus, msg) || isTokenError(httpStatus, msg)) {
          lastError = msg || "Token inválido";
          return tryIndex(index + 1);
        }

        // Se for 404 / não encontrado
        if (apiStatus === 404 || msg.indexOf("Nenhum registro") !== -1) {
          return { error: "CPF não encontrado na base de dados." };
        }

        var dados = normalize(json);
        if (dados && dados.nome) {
          return { DADOS: dados };
        }

        if (msg) {
          return { error: msg };
        }

        return { error: "CPF não encontrado na base de dados." };
      });
    }

    return tryIndex(0);
  };
})();
