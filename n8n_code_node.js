/**
 * ============================================================================
 * CÓDIGO EXACTO PARA EL NODO CODE DE N8N (RETO 4 INCLUIDO)
 * Nombre del nodo: "4. Code POO - Evaluar Riesgo y Reglas"
 * Modo del nodo: "Run Once for All Items"
 * ============================================================================
 * Integra las 3 clases en JavaScript puro:
 *  - Proveedor (Regla 1 y Error 1)
 *  - PagoProveedor (Reglas 2, 3, 4, 5 y Error 2)
 *  - HistorialTendencia (Reto 4: Cálculo de tendencia temporal de riesgo)
 * ============================================================================
 */

class Proveedor {
  #cedula;
  #nombre;
  #estadoTributario;
  #esMoroso;
  #esOmiso;
  #regimen;
  #administracionTributaria;
  #apiDisponible;
  #errorDetalle;

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

  #sanitizarCedula(cedula) {
    if (!cedula) return '';
    return String(cedula).replace(/[^0-9]/g, '').trim();
  }

  get cedula() { return this.#cedula; }
  get nombre() { return this.#nombre; }
  get estadoTributario() { return this.#estadoTributario; }
  get esMoroso() { return this.#esMoroso; }
  get esOmiso() { return this.#esOmiso; }
  get regimen() { return this.#regimen; }
  get administracionTributaria() { return this.#administracionTributaria; }
  get apiDisponible() { return this.#apiDisponible; }
  get errorDetalle() { return this.#errorDetalle; }

  procesarRespuestaHacienda(res) {
    if (!res || res.error || res.code === 404 || res.status?.includes?.('no available') || res.statusCode >= 400) {
      this.#apiDisponible = false;
      this.#estadoTributario = 'ERROR_CONSULTA_HACIENDA';
      this.#errorDetalle = res?.message || res?.status || res?.error || 'Proveedor no encontrado o API no disponible';
      return false;
    }

    try {
      if (res.nombre) this.#nombre = res.nombre;
      if (res.regimen && typeof res.regimen === 'object') {
        this.#regimen = res.regimen.descripcion || 'Régimen general';
      } else if (typeof res.regimen === 'string') {
        this.#regimen = res.regimen;
      }

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

  estaEnRiesgo() {
    if (!this.#apiDisponible) {
      return {
        enRiesgo: true,
        motivos: [`Fallo de comunicación con Hacienda: ${this.#errorDetalle || 'API inaccesible'}`],
        nivelRiesgo: 'MEDIO'
      };
    }

    const motivos = [];
    if (this.#esMoroso) motivos.push('El proveedor figura como MOROSO ante el Ministerio de Hacienda');
    if (this.#esOmiso) motivos.push('El proveedor figura como OMISO en declaraciones tributarias');
    if (this.#estadoTributario.toLowerCase() !== 'inscrito') {
      motivos.push(`Estado tributario irregular: "${this.#estadoTributario}" (Debe ser "Inscrito")`);
    }

    const enRiesgo = motivos.length > 0;
    let nivelRiesgo = 'BAJO';
    if (enRiesgo) {
      nivelRiesgo = (this.#esMoroso || this.#estadoTributario.toLowerCase() !== 'inscrito') ? 'CRITICO' : 'ALTO';
    }

    return { enRiesgo, motivos, nivelRiesgo };
  }

  obtenerTasaRetencionBase() {
    const reg = (this.#regimen || '').toLowerCase();
    if (reg.includes('simplificado') || reg.includes('no registrado') || reg === '') {
      return 0.05;
    }
    return 0.02;
  }

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

class PagoProveedor {
  #id;
  #proveedor;
  #montoBruto;
  #moneda;
  #fechaEmision;
  #fechaVencimiento;
  #estadoPago;
  #nivelRiesgo;
  #comprobanteQRUrl;
  #observaciones;
  #auditoria;
  #detallesCalculo;

  constructor({
    id,
    proveedor,
    montoBruto,
    moneda = 'USD',
    fechaEmision,
    fechaVencimiento,
    estadoPago = 'PENDIENTE',
    nivelRiesgo = null,
    comprobanteQRUrl = null,
    observaciones = null
  } = {}) {
    this.#id = id ? String(id).trim() : '';
    this.#proveedor = proveedor instanceof Proveedor ? proveedor : new Proveedor(proveedor);
    this.#montoBruto = Number(montoBruto);
    this.#moneda = (moneda || 'USD').toUpperCase();
    this.#fechaEmision = fechaEmision;
    this.#fechaVencimiento = fechaVencimiento;
    this.#estadoPago = estadoPago;
    this.#nivelRiesgo = nivelRiesgo || 'DESCONOCIDO';
    this.#comprobanteQRUrl = comprobanteQRUrl || null;
    this.#observaciones = observaciones || '';
    this.#auditoria = null;
    this.#detallesCalculo = {};
  }

  get id() { return this.#id; }
  get proveedor() { return this.#proveedor; }
  get montoBruto() { return this.#montoBruto; }
  get moneda() { return this.#moneda; }
  get fechaEmision() { return this.#fechaEmision; }
  get fechaVencimiento() { return this.#fechaVencimiento; }
  get estadoPago() { return this.#estadoPago; }
  get nivelRiesgo() { return this.#nivelRiesgo; }
  get comprobanteQRUrl() { return this.#comprobanteQRUrl; }
  get observaciones() { return this.#observaciones; }
  get auditoria() { return this.#auditoria; }
  get detallesCalculo() { return { ...this.#detallesCalculo }; }

  validarIntegridadDatos() {
    const errores = [];
    if (!this.#id || this.#id.length < 2) errores.push('ID de pago inexistente o inválido');
    if (isNaN(this.#montoBruto) || this.#montoBruto <= 0) errores.push(`Monto bruto inválido (${this.#montoBruto}). Debe ser mayor a 0`);
    if (!['USD', 'CRC'].includes(this.#moneda)) errores.push(`Moneda '${this.#moneda}' no admitida`);
    if (!this.#proveedor.cedula || this.#proveedor.cedula.length < 9) errores.push(`Cédula jurídica/física inválida (${this.#proveedor.cedula || 'vacía'})`);
    if (!this.#fechaVencimiento || isNaN(Date.parse(this.#fechaVencimiento))) errores.push(`Fecha de vencimiento inválida (${this.#fechaVencimiento})`);

    const valido = errores.length === 0;
    if (!valido) {
      this.#estadoPago = 'ERROR_DATOS_INCOMPLETOS';
      this.#nivelRiesgo = 'CRITICO';
      this.#observaciones = `Rechazado por validación de datos: ${errores.join('; ')}`;
    }
    return { valido, errores };
  }

  calcularDiasRestantesYVencimiento(fechaReferencia = new Date()) {
    const ref = new Date(fechaReferencia);
    const venc = new Date(this.#fechaVencimiento);
    ref.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);

    const diferenciaMs = venc.getTime() - ref.getTime();
    const diasRestantes = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));

    let prioridad = 'NORMAL';
    let estaVencido = false;
    let estadoVencimiento = 'EN_PLAZO';

    if (diasRestantes < 0) {
      prioridad = 'URGENTE';
      estaVencido = true;
      estadoVencimiento = 'VENCIDO';
    } else if (diasRestantes <= 3) {
      prioridad = 'ALTA';
      estaVencido = false;
      estadoVencimiento = 'PROXIMO_A_VENCER';
    }

    this.#detallesCalculo.diasRestantes = diasRestantes;
    this.#detallesCalculo.prioridad = prioridad;
    this.#detallesCalculo.estaVencido = estaVencido;
    this.#detallesCalculo.estadoVencimiento = estadoVencimiento;
    return { diasRestantes, prioridad, estaVencido, estadoVencimiento };
  }

  calcularMontoNetoYRetencion() {
    const umbralRetencion = this.#moneda === 'CRC' ? 500000 : 1000;
    const superaUmbral = this.#montoBruto > umbralRetencion;

    let tasaRetencion = 0;
    if (superaUmbral) {
      tasaRetencion = this.#proveedor.obtenerTasaRetencionBase();
    }

    const montoRetencion = Math.round((this.#montoBruto * tasaRetencion) * 100) / 100;
    const montoNeto = Math.round((this.#montoBruto - montoRetencion) * 100) / 100;

    this.#detallesCalculo.aplicaRetencion = superaUmbral;
    this.#detallesCalculo.tasaRetencion = tasaRetencion;
    this.#detallesCalculo.montoRetencion = montoRetencion;
    this.#detallesCalculo.montoNeto = montoNeto;

    return { aplicaRetencion: superaUmbral, tasaRetencion, montoRetencion, montoNeto };
  }

  generarPayloadQR(timestamp = Date.now()) {
    const hashVerificacion = `COMP-${this.#id}-${this.#proveedor.cedula}-${timestamp}`;
    const fechaActual = new Date().toISOString().split('T')[0];

    const payloadTexto = [
      `=== COMPROBANTE DE PAGO VALIDADO ===`,
      `ID PAGO: ${this.#id}`,
      `PROVEEDOR: ${this.#proveedor.nombre}`,
      `CEDULA: ${this.#proveedor.cedula}`,
      `REGIMEN: ${this.#proveedor.regimen}`,
      `MONTO BRUTO: ${this.#moneda} ${this.#montoBruto.toFixed(2)}`,
      `RETENCION APLICADA: ${this.#moneda} ${(this.#detallesCalculo.montoRetencion || 0).toFixed(2)} (${this.#detallesCalculo.tasaRetencion ? (this.#detallesCalculo.tasaRetencion * 100).toFixed(0) + '%' : '0%'})`,
      `MONTO NETO A PAGAR: ${this.#moneda} ${(this.#detallesCalculo.montoNeto || this.#montoBruto).toFixed(2)}`,
      `ESTADO: ${this.#estadoPago}`,
      `AUDITORIA: ${this.#auditoria || 'ESTANDAR'}`,
      `FECHA VALIDACION: ${fechaActual}`,
      `FIRMA DIGITAL: ${hashVerificacion}`
    ].join('\n');

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payloadTexto)}`;
    this.#comprobanteQRUrl = qrUrl;
    this.#detallesCalculo.hashVerificacion = hashVerificacion;
    this.#detallesCalculo.payloadQR = payloadTexto;
    return { hashVerificacion, payloadTexto, qrUrl };
  }

  evaluarDictamenPago(fechaReferencia = new Date()) {
    const checkDatos = this.validarIntegridadDatos();
    if (!checkDatos.valido) return this.toJSON();

    if (!this.#proveedor.apiDisponible) {
      this.#estadoPago = 'PENDIENTE_REINTENTO_API';
      this.#nivelRiesgo = 'MEDIO';
      this.#observaciones = `API de Hacienda no disponible o proveedor no localizado: ${this.#proveedor.errorDetalle}`;
      return this.toJSON();
    }

    this.calcularDiasRestantesYVencimiento(fechaReferencia);

    const evalRiesgo = this.#proveedor.estaEnRiesgo();
    if (evalRiesgo.enRiesgo) {
      this.#estadoPago = 'RETENIDO_REVISION_MANUAL';
      this.#nivelRiesgo = evalRiesgo.nivelRiesgo;
      this.#comprobanteQRUrl = null;
      this.#observaciones = `Pago retenido por riesgo tributario: ${evalRiesgo.motivos.join('; ')}. Prioridad: ${this.#detallesCalculo.prioridad}.`;
      return this.toJSON();
    }

    this.calcularMontoNetoYRetencion();

    const limiteAprobacionAutomatica = this.#moneda === 'CRC' ? 5000000 : 10000;
    const requiereAuditoria = this.#montoBruto > limiteAprobacionAutomatica;

    if (requiereAuditoria) {
      this.#estadoPago = 'APROBADO_CON_AUDITORIA';
      this.#auditoria = `REQUIERE_FIRMA_GERENCIAL_POR_MONTO_SUPERIOR_${limiteAprobacionAutomatica}`;
      this.#observaciones = `Pago aprobado condicionado a doble firma gerencial por superar límite de $10,000 USD (Monto: ${this.#moneda} ${this.#montoBruto.toFixed(2)}). Prioridad: ${this.#detallesCalculo.prioridad}.`;
    } else {
      this.#estadoPago = 'APROBADO';
      this.#auditoria = 'APROBACION_AUTOMATICA';
      this.#observaciones = `Pago aprobado automáticamente. Proveedor solvente ante Hacienda. Prioridad: ${this.#detallesCalculo.prioridad}.`;
    }

    this.#nivelRiesgo = 'BAJO';
    this.generarPayloadQR();
    return this.toJSON();
  }

  toUpdatePayload() {
    return {
      id: this.#id,
      proveedorNombre: this.#proveedor.nombre,
      cedulaJuridica: this.#proveedor.cedula,
      montoBruto: this.#montoBruto,
      moneda: this.#moneda,
      fechaEmision: this.#fechaEmision,
      fechaVencimiento: this.#fechaVencimiento,
      estadoPago: this.#estadoPago,
      nivelRiesgo: this.#nivelRiesgo,
      comprobanteQRUrl: this.#comprobanteQRUrl,
      observaciones: this.#observaciones,
      detallesFiscales: {
        regimen: this.#proveedor.regimen,
        estadoTributario: this.#proveedor.estadoTributario,
        retencionAplicada: this.#detallesCalculo.montoRetencion || 0,
        montoNeto: this.#detallesCalculo.montoNeto || this.#montoBruto,
        prioridad: this.#detallesCalculo.prioridad || 'NORMAL',
        auditoria: this.#auditoria || 'ESTANDAR'
      }
    };
  }

  toJSON() {
    return {
      id: this.#id,
      proveedor: this.#proveedor.toJSON(),
      montoBruto: this.#montoBruto,
      moneda: this.#moneda,
      fechaEmision: this.#fechaEmision,
      fechaVencimiento: this.#fechaVencimiento,
      estadoPago: this.#estadoPago,
      nivelRiesgo: this.#nivelRiesgo,
      comprobanteQRUrl: this.#comprobanteQRUrl,
      observaciones: this.#observaciones,
      auditoria: this.#auditoria,
      detallesCalculo: this.#detallesCalculo
    };
  }
}

class HistorialTendencia {
  #historialPrevio;
  #resultadosActuales;
  #metricasActuales;
  #analisisTendencia;

  constructor(historialPrevio = [], resultadosActuales = []) {
    this.#historialPrevio = Array.isArray(historialPrevio) ? historialPrevio : [];
    this.#resultadosActuales = Array.isArray(resultadosActuales) ? resultadosActuales : [];
    this.#metricasActuales = this.calcularMetricasEjecucionActual();
    this.#analisisTendencia = this.determinarTendencia();
  }

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

// ============================================================================
// INTEGRACIÓN DEL NODO CODE CON EL FLUJO DE N8N
// ============================================================================

// 1. Obtener historial previo desde el nodo GET Historial Ejecuciones (si existe)
let historialPrevio = [];
try {
  historialPrevio = $('1B. GET Historial Ejecuciones (JSON Server)').all().map(item => item.json);
} catch (e) {
  try {
    historialPrevio = $('GET Historial Ejecuciones').all().map(item => item.json);
  } catch (e2) {
    historialPrevio = [];
  }
}

// 2. Obtener pagos de origen y respuestas de Hacienda
const itemsHacienda = $input.all();
let itemsPagosOrigen = [];

try {
  itemsPagosOrigen = $('2. GET Pagos Pendientes (JSON Server)').all();
} catch (e) {
  try {
    itemsPagosOrigen = $('Consultar Pagos Pendientes').all();
  } catch (e2) {
    itemsPagosOrigen = itemsHacienda;
  }
}

// 3. Procesar individualmente cada pago mediante las clases Proveedor y PagoProveedor
const resultadosLote = [];

for (let i = 0; i < itemsPagosOrigen.length; i++) {
  const pagoItem = itemsPagosOrigen[i]?.json || {};
  const haciendaItem = itemsHacienda[i]?.json || null;

  const proveedor = new Proveedor({
    cedula: pagoItem.cedulaJuridica,
    nombre: pagoItem.proveedorNombre,
    haciendaResponse: haciendaItem
  });

  const pago = new PagoProveedor({
    id: pagoItem.id,
    proveedor: proveedor,
    montoBruto: pagoItem.montoBruto,
    moneda: pagoItem.moneda,
    fechaEmision: pagoItem.fechaEmision,
    fechaVencimiento: pagoItem.fechaVencimiento,
    estadoPago: pagoItem.estadoPago,
    nivelRiesgo: pagoItem.nivelRiesgo,
    comprobanteQRUrl: pagoItem.comprobanteQRUrl,
    observaciones: pagoItem.observaciones
  });

  pago.evaluarDictamenPago();
  resultadosLote.push(pago.toUpdatePayload());
}

// 4. Instanciar HistorialTendencia para analizar la evolución temporal del riesgo
const evaluadorTendencia = new HistorialTendencia(historialPrevio, resultadosLote);
const reporteTendencia = evaluadorTendencia.generarReporteYConclusion();

// 5. Adjuntar los datos de tendencia a cada ítem emitido para n8n
const resultadosFinales = resultadosLote.map((item, idx) => {
  return {
    json: {
      ...item,
      // Campos requeridos por el Reto 4:
      estadoTendencia: reporteTendencia.estadoTendencia,
      porcentajeRiesgoActual: reporteTendencia.porcentajeRiesgoActual,
      porcentajeRiesgoHistorico: reporteTendencia.porcentajeRiesgoHistorico,
      conclusionTendencia: reporteTendencia.conclusionTendencia,
      registroHistorialActual: reporteTendencia.registroHistorialActual,
      // Indicador booleano para el nodo IF
      aprobadoParaQR: item.estadoPago.startsWith('APROBADO')
    }
  };
});

return resultadosFinales;
