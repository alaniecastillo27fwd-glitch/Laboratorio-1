/**
 * Clase HistorialTendencia
 * Extensión Reto 4: Historial y Tendencia de Proveedores
 * 
 * Responsable de almacenar, comparar y analizar el comportamiento temporal del
 * riesgo fiscal de proveedores a partir de ejecuciones pasadas registradas en JSON Server.
 */
export class HistorialTendencia {
  #historialPrevio;
  #resultadosActuales;
  #metricasActuales;
  #analisisTendencia;

  /**
   * @param {Array<Object>} [historialPrevio=[]] - Registros históricos leídos desde JSON Server (/historial_ejecuciones)
   * @param {Array<Object>} [resultadosActuales=[]] - Resultados procesados por PagoProveedor en la corrida actual
   */
  constructor(historialPrevio = [], resultadosActuales = []) {
    this.#historialPrevio = Array.isArray(historialPrevio) ? historialPrevio : [];
    this.#resultadosActuales = Array.isArray(resultadosActuales) ? resultadosActuales : [];
    this.#metricasActuales = this.calcularMetricasEjecucionActual();
    this.#analisisTendencia = this.determinarTendencia();
  }

  // --- Getters ---
  get historialPrevio() { return [...this.#historialPrevio]; }
  get resultadosActuales() { return [...this.#resultadosActuales]; }
  get metricasActuales() { return { ...this.#metricasActuales }; }
  get analisisTendencia() { return { ...this.#analisisTendencia }; }

  /**
   * Calcula las métricas globales del lote procesado actual:
   * - Total de proveedores evaluados
   * - Cantidad de pagos aprobados
   * - Cantidad de pagos retenidos o con error
   * - Porcentaje de riesgo actual: (retenidos / total) * 100
   * - Monto total en riesgo acumulado
   * 
   * @returns {{
   *   totalProveedoresEvaluados: number,
   *   pagosAprobados: number,
   *   pagosRetenidosOError: number,
   *   porcentajeRiesgoActual: number,
   *   montoTotalEnRiesgo: number
   * }}
   */
  calcularMetricasEjecucionActual() {
    const total = this.#resultadosActuales.length;
    if (total === 0) {
      return {
        totalProveedoresEvaluados: 0,
        pagosAprobados: 0,
        pagosRetenidosOError: 0,
        porcentajeRiesgoActual: 0,
        montoTotalEnRiesgo: 0
      };
    }

    let aprobados = 0;
    let retenidosOError = 0;
    let montoEnRiesgo = 0;

    for (const item of this.#resultadosActuales) {
      const estado = String(item.estadoPago || '').toUpperCase();
      const esAprobado = estado === 'APROBADO' ||
                         estado.includes('APROBADO_CON_FIRMA') ||
                         estado.includes('APROBADO_CON_AUDITORIA') ||
                         item.aprobadoParaQR === true;

      if (esAprobado) {
        aprobados++;
      } else {
        retenidosOError++;
        const monto = Number(item.montoBruto) || 0;
        if (monto > 0) {
          montoEnRiesgo += monto;
        }
      }
    }

    const porcentajeRiesgo = Number(((retenidosOError / total) * 100).toFixed(1));
    const montoTotalEnRiesgo = Number(montoEnRiesgo.toFixed(2));

    return {
      totalProveedoresEvaluados: total,
      pagosAprobados: aprobados,
      pagosRetenidosOError: retenidosOError,
      porcentajeRiesgoActual: porcentajeRiesgo,
      montoTotalEnRiesgo
    };
  }

  /**
   * Compara el porcentaje de riesgo actual contra el último corte histórico disponible.
   * Reglas de tendencia:
   *  - MEJORANDO: El porcentaje de riesgo disminuyó respecto al corte anterior (diferencia < 0).
   *  - EMPEORANDO: El porcentaje de riesgo aumentó respecto al corte anterior (diferencia > 0).
   *  - ESTABLE: El porcentaje se mantuvo igual o no existe historial previo para comparar.
   * 
   * @returns {{
   *   estadoTendencia: 'MEJORANDO'|'EMPEORANDO'|'ESTABLE',
   *   porcentajeRiesgoActual: number,
   *   porcentajeRiesgoAnterior: number|null,
   *   diferenciaPuntos: number,
   *   corteAnteriorId: string|null
   * }}
   */
  determinarTendencia() {
    const { porcentajeRiesgoActual } = this.#metricasActuales;

    if (this.#historialPrevio.length === 0) {
      return {
        estadoTendencia: 'ESTABLE',
        porcentajeRiesgoActual,
        porcentajeRiesgoAnterior: null,
        diferenciaPuntos: 0,
        corteAnteriorId: null
      };
    }

    // Tomar la ejecución más reciente registrada en el historial
    const ultimaEjecucion = this.#historialPrevio[this.#historialPrevio.length - 1];
    const porcentajeRiesgoAnterior = Number(ultimaEjecucion.porcentajeRiesgo ?? ultimaEjecucion.porcentajeRiesgoActual ?? 0);
    const diferenciaPuntos = Number((porcentajeRiesgoActual - porcentajeRiesgoAnterior).toFixed(1));

    let estadoTendencia = 'ESTABLE';
    if (diferenciaPuntos < 0) {
      estadoTendencia = 'MEJORANDO';
    } else if (diferenciaPuntos > 0) {
      estadoTendencia = 'EMPEORANDO';
    }

    return {
      estadoTendencia,
      porcentajeRiesgoActual,
      porcentajeRiesgoAnterior,
      diferenciaPuntos,
      corteAnteriorId: ultimaEjecucion.id || 'ANTERIOR'
    };
  }

  /**
   * Genera el registro estructurado de la ejecución actual y redacta la conclusión ejecutiva.
   * Listo para persistirse mediante POST /historial_ejecuciones en JSON Server.
   * 
   * @returns {{
   *   registroHistorialActual: Object,
   *   conclusionTendencia: string,
   *   estadoTendencia: string,
   *   porcentajeRiesgoActual: number,
   *   porcentajeRiesgoHistorico: number|null
   * }}
   */
  generarReporteYConclusion() {
    const { totalProveedoresEvaluados, pagosAprobados, pagosRetenidosOError, porcentajeRiesgoActual, montoTotalEnRiesgo } = this.#metricasActuales;
    const { estadoTendencia, porcentajeRiesgoAnterior, diferenciaPuntos, corteAnteriorId } = this.#analisisTendencia;

    const fechaISO = new Date().toISOString();
    const idGenerado = `HIST-${String(this.#historialPrevio.length + 1).padStart(3, '0')}`;

    let conclusionTendencia = '';
    if (porcentajeRiesgoAnterior === null) {
      conclusionTendencia = `TENDENCIA ESTABLE: Primera ejecución registrada con un ${porcentajeRiesgoActual}% de pagos en riesgo (${pagosRetenidosOError} de ${totalProveedoresEvaluados}). Se establece línea base para futuras mediciones.`;
    } else if (estadoTendencia === 'MEJORANDO') {
      conclusionTendencia = `La situación está MEJORANDO: el porcentaje de pagos en riesgo bajó de ${porcentajeRiesgoAnterior}% a ${porcentajeRiesgoActual}% (${diferenciaPuntos} pts) respecto al corte anterior (${corteAnteriorId}).`;
    } else if (estadoTendencia === 'EMPEORANDO') {
      conclusionTendencia = `La situación está EMPEORANDO: el porcentaje de pagos en riesgo aumentó de ${porcentajeRiesgoAnterior}% a ${porcentajeRiesgoActual}% (+${diferenciaPuntos} pts) respecto al corte anterior (${corteAnteriorId}).`;
    } else {
      conclusionTendencia = `La situación se mantiene ESTABLE: el porcentaje de riesgo se mantuvo exactamente en ${porcentajeRiesgoActual}% respecto al corte anterior (${corteAnteriorId}).`;
    }

    const registroHistorialActual = {
      id: idGenerado,
      fechaEjecucion: fechaISO,
      totalProveedoresEvaluados,
      pagosAprobados,
      pagosRetenidosOError,
      porcentajeRiesgo: porcentajeRiesgoActual,
      montoTotalEnRiesgo,
      estadoTendencia,
      conclusionTendencia
    };

    return {
      registroHistorialActual,
      conclusionTendencia,
      estadoTendencia,
      porcentajeRiesgoActual,
      porcentajeRiesgoHistorico: porcentajeRiesgoAnterior
    };
  }
}
