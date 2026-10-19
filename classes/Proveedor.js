/**
 * Clase Proveedor
 * Representa la entidad de un proveedor comercial y su situación tributaria
 * consultada ante el Ministerio de Hacienda (Costa Rica).
 * 
 * Reglas de negocio asociadas:
 * - Regla 1: Verificación de Morosidad y Estado Tributario (estaEnRiesgo)
 * - Manejo de Error 1: Validación y contingencia ante fallas de la API de Hacienda
 */
export class Proveedor {
  #cedula;
  #nombre;
  #estadoTributario;
  #esMoroso;
  #esOmiso;
  #regimen;
  #administracionTributaria;
  #apiDisponible;
  #errorDetalle;

  /**
   * @param {Object} params
   * @param {string} params.cedula - Cédula física o jurídica del proveedor
   * @param {string} [params.nombre] - Nombre o razón social
   * @param {Object} [params.haciendaResponse] - Respuesta cruda proveniente de la API de Hacienda
   */
  constructor({ cedula, nombre = 'No especificado', haciendaResponse = null } = {}) {
    this.#cedula = this.#sanitizarCedula(cedula);
    this.#nombre = (nombre || 'No especificado').trim();
    this.#estadoTributario = 'DESCONOCIDO';
    this.#esMoroso = false;
    this.#esOmiso = false;
    this.#regimen = 'No registrado';
    this.#administracionTributaria = 'No asignada';
    this.#apiDisponible = true;
    this.#errorDetalle = null;

    if (haciendaResponse) {
      this.procesarRespuestaHacienda(haciendaResponse);
    }
  }

  /**
   * Sanitiza y limpia el formato de la identificación
   * @private
   */
  #sanitizarCedula(cedula) {
    if (!cedula) return '';
    return String(cedula).replace(/[^0-9]/g, '').trim();
  }

  // --- Getters ---
  get cedula() { return this.#cedula; }
  get nombre() { return this.#nombre; }
  get estadoTributario() { return this.#estadoTributario; }
  get esMoroso() { return this.#esMoroso; }
  get esOmiso() { return this.#esOmiso; }
  get regimen() { return this.#regimen; }
  get administracionTributaria() { return this.#administracionTributaria; }
  get apiDisponible() { return this.#apiDisponible; }
  get errorDetalle() { return this.#errorDetalle; }

  /**
   * Valida y procesa la respuesta devuelta por la API del Ministerio de Hacienda.
   * Maneja códigos 404, errores de red, respuestas vacías o datos incompletos.
   * (Error 1: Manejo de contingencia de API externa)
   * 
   * @param {Object} res - Objeto devuelto por el servicio externo
   * @returns {boolean} true si la respuesta fue válida y procesada; false si hubo error
   */
  procesarRespuestaHacienda(res) {
    // Si la respuesta es nula, indefinida o contiene error explícito (ej. HTTP 404, 500 o n8n error output)
    if (!res || res.error || res.code === 404 || res.status?.includes?.('no available') || res.statusCode >= 400) {
      this.#apiDisponible = false;
      this.#estadoTributario = 'ERROR_CONSULTA_HACIENDA';
      this.#errorDetalle = res?.message || res?.status || res?.error || 'Proveedor no encontrado o API de Hacienda no disponible';
      return false;
    }

    try {
      // Si la API devuelve el nombre oficial, actualizarlo
      if (res.nombre) {
        this.#nombre = res.nombre;
      }

      // Procesar régimen tributario
      if (res.regimen && typeof res.regimen === 'object') {
        this.#regimen = res.regimen.descripcion || 'Régimen general';
      } else if (typeof res.regimen === 'string') {
        this.#regimen = res.regimen;
      }

      // Procesar situación tributaria
      const situacion = res.situacion || {};
      this.#esMoroso = String(situacion.moroso || '').toUpperCase() === 'SI';
      this.#esOmiso = String(situacion.omiso || '').toUpperCase() === 'SI';
      this.#estadoTributario = situacion.estado || 'Desconocido';
      this.#administracionTributaria = situacion.administracionTributaria || 'No asignada';
      this.#apiDisponible = true;
      this.#errorDetalle = null;
      return true;
    } catch (err) {
      this.#apiDisponible = false;
      this.#estadoTributario = 'ERROR_PARSEO_DATOS';
      this.#errorDetalle = `Error al interpretar la respuesta de Hacienda: ${err.message}`;
      return false;
    }
  }

  /**
   * Regla de Negocio 1: Verificación de Morosidad y Estado Tributario.
   * Determina si el proveedor representa un riesgo legal/fiscal para la empresa.
   * Un proveedor está en riesgo si:
   *  1. Está moroso (moroso === 'SI')
   *  2. Está omiso (omiso === 'SI')
   *  3. Su estado tributario no es 'Inscrito' (ej. Desinscrito, Suspendido, No Registrado)
   * 
   * @returns {{ enRiesgo: boolean, motivos: string[], nivelRiesgo: 'BAJO'|'MEDIO'|'ALTO'|'CRITICO' }}
   */
  estaEnRiesgo() {
    if (!this.#apiDisponible) {
      return {
        enRiesgo: true,
        motivos: [`Fallo de comunicación con Hacienda: ${this.#errorDetalle || 'API inaccesible'}`],
        nivelRiesgo: 'MEDIO'
      };
    }

    const motivos = [];

    if (this.#esMoroso) {
      motivos.push('El proveedor figura como MOROSO ante el Ministerio de Hacienda');
    }
    if (this.#esOmiso) {
      motivos.push('El proveedor figura como OMISO en declaraciones tributarias');
    }
    if (this.#estadoTributario.toLowerCase() !== 'inscrito') {
      motivos.push(`Estado tributario irregular: "${this.#estadoTributario}" (Debe ser "Inscrito")`);
    }

    const enRiesgo = motivos.length > 0;
    let nivelRiesgo = 'BAJO';

    if (enRiesgo) {
      nivelRiesgo = (this.#esMoroso || this.#estadoTributario.toLowerCase() !== 'inscrito') ? 'CRITICO' : 'ALTO';
    }

    return {
      enRiesgo,
      motivos,
      nivelRiesgo
    };
  }

  /**
   * Determina la tasa de retención preventiva sugerida según el régimen tributario del proveedor.
   * Simplificado / No registrado -> 5% (0.05)
   * General / Otros -> 2% (0.02)
   * 
   * @returns {number} Tasa decimal (0.02 o 0.05)
   */
  obtenerTasaRetencionBase() {
    const reg = (this.#regimen || '').toLowerCase();
    if (reg.includes('simplificado') || reg.includes('no registrado') || reg === '') {
      return 0.05;
    }
    return 0.02;
  }

  /**
   * Devuelve un objeto plano con la información pública del proveedor
   */
  toJSON() {
    return {
      cedula: this.#cedula,
      nombre: this.#nombre,
      estadoTributario: this.#estadoTributario,
      esMoroso: this.#esMoroso,
      esOmiso: this.#esOmiso,
      regimen: this.#regimen,
      administracionTributaria: this.#administracionTributaria,
      apiDisponible: this.#apiDisponible,
      errorDetalle: this.#errorDetalle
    };
  }
}
