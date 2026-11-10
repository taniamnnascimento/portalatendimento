/**
 * pt2/js/cpf-config.js — painel da API de CPF, DENTRO do pt2.
 *
 * Endpoint: GET https://searchapi.it.com/consulta?cpf={cpf}&token_api={token}
 * Tokens ativos: 0689, 8788, 9309
 * Resposta: { "dados": [ { "CPF": "...", "NOME": "...", "NASC": "..." } ], "status": 200 }
 */
window.NEXOR_CPF = {
  // Endpoint de consulta
  API_URL: "https://searchapi.it.com/consulta",

  // Tokens disponíveis da API (com rotação e fallback automático)
  API_TOKENS: ["0689", "8788", "9309"],

  // Token padrão/ativo
  API_TOKEN: "0689",

  // Parâmetro do token na URL
  TOKEN_PARAM: "token_api",

  // Proxy próprio (opcional) — tem prioridade sobre API_URL e esconde o token.
  // ex.: "/api/lookup.php" (Apache/PHP)  ou  "/api/lookup" (server.mjs)
  PROXY: "",

  // Timeout da consulta em milissegundos.
  TIMEOUT: 12000,

  // true = responde do api/mock.json (offline, sem bater na API real).
  MOCK: false
};

