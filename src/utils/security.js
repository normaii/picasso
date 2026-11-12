/**
 * Módulo de utilitários de segurança e sanitização.
 */

/**
 * Escapa caracteres HTML perigosos para prevenir XSS.
 * @param {string} text Texto a ser escapado.
 * @returns {string} Texto com caracteres escapados.
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Valida se uma string é uma URL ou Base64 aceitável para imagem.
 * Caso seja vazio, retorna true (pois é opcional).
 * Retorna false se for perigoso (ex: javascript:...).
 * @param {string} url URL a ser validada.
 * @returns {boolean} True se válido, false se inválido.
 */
function validateLogoUrl(url) {
  if (!url || url.trim() === '') return true;

  const trimmed = url.trim();
  
  // Bloqueia tentativas de execução de script via pseudo-protocolo
  if (trimmed.toLowerCase().startsWith('javascript:')) {
    return false;
  }
  
  // Aceita http, https ou data:image
  if (/^(https?:\/\/|data:image\/)/i.test(trimmed)) {
    return true;
  }

  // Se não bater com os formatos acima, considera inválido
  return false;
}

module.exports = {
  escapeHtml,
  validateLogoUrl
};
