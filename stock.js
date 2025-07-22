const axios = require('axios');

const CONFIG = {
  BASE_URL: 'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO: 'nyapura',
  PASSWORD: '1234',
};

// Función para obtener el sessionId de autenticación
async function obtenerSessionId() {
  const response = await axios.post(
    `${CONFIG.BASE_URL}/auth/login`,
    { usuario: CONFIG.USUARIO, password: CONFIG.PASSWORD },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data;
  const headers = response.headers;

  // Intentar obtener sessionId desde el body o la cookie
  let sid = data.sessionId?.replace('JSESSIONID=', '');

  if (!sid && headers['set-cookie']) {
    const match = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
    if (match) sid = match[1];
  }

  if (!sid) throw new Error('❌ No se pudo obtener sessionId');
  return sid;
}

/**
 * Obtener stock físico desde el sistema
 * @param {string|Date} fecha - Fecha en formato 'DD-MM-AAAA' o Date. Opcional.
 * @param {string|number} idDeposito - ID del depósito (obligatorio).
 * @returns {Promise<Array>} - Array con datos de stock físico.
 */
async function obtenerStock(fecha, idDeposito) {
  if (!idDeposito) throw new Error('idDeposito es obligatorio');

  const depositoId = String(idDeposito).trim();
  if (depositoId === '') throw new Error('idDeposito inválido');

  // Frescura siempre en true como pediste
  const frescura = true;

  // Obtener sesión
  const sid = await obtenerSessionId();

  // Formatear fecha a DD-MM-AAAA
  let fechaStr = '';
  if (fecha instanceof Date && !isNaN(fecha)) {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const yyyy = fecha.getFullYear();
    fechaStr = `${dd}-${mm}-${yyyy}`;
  } else if (typeof fecha === 'string' && fecha.trim() !== '') {
    fechaStr = fecha.trim();
  }

  // Preparar parámetros
  const params = {
    idDeposito: depositoId,
    frescura,
  };

  if (fechaStr) {
    params['DD-MM-AAAA'] = fechaStr;
  }

  // Llamar al endpoint
  const response = await axios.get(`${CONFIG.BASE_URL}/stock/`, {
    headers: {
      Accept: 'application/json',
      Cookie: `JSESSIONID=${sid}`,
    },
    params,
  });

  if (response.status !== 200) {
    throw new Error(`Error consultando stock: status ${response.status}`);
  }

  return response.data;
}

module.exports = { obtenerStock };
