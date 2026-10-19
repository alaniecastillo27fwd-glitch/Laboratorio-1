import { Proveedor } from './Proveedor.js';

/**
 * Clase PagoProveedor
 * Representa la orden o registro de pago a un proveedor comercial y gestiona
 * el ciclo de vida, cálculos fiscales, validaciones y aprobación del pago.
 * 
 * Reglas de negocio asociadas:
 * - Regla 2: Cálculo de Retención Preventiva / Impuesto según Monto y Régimen
 * - Regla 3: Prioridad y Vencimiento según Días Restantes
 * - Regla 4: Límite de Aprobación Automática / Auditoría Gerencial
 * - Regla 5: Generación de Firma y Payload para Comprobante QR
 * - Manejo de Error 2: Validación de Integridad de Datos (Monto, Fechas, Cédula)
 */
export class PagoProveedor {
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

  /**
   * @param {Object} params
   * @param {string} params.id - Identificador único de la orden de pago (ej. PAG-101)
   * @param {Proveedor|Object} params.proveedor - Instancia de la clase Proveedor o datos del proveedor
   * @param {number} params.montoBruto - Monto nominal de la factura
   * @param {'USD'|'CRC'} [params.moneda='USD'] - Moneda del pago
   * @param {string} params.fechaEmision - Fecha de emisión (YYYY-MM-DD)
   * @param {string} params.fechaVencimiento - Fecha de vencimiento (YYYY-MM-DD)
   * @param {string} [params.estadoPago='PENDIENTE'] - Estado actual del pago
   */
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
    
    // Asignación segura del objeto Proveedor (POO)
    if (proveedor instanceof Proveedor) {
      this.#proveedor = proveedor;
    } else if (typeof proveedor === 'object' && proveedor !== null) {
      this.#proveedor = new Proveedor(proveedor);
    } else {
      this.#proveedor = new Proveedor({ cedula: '', nombre: 'Desconocido' });
    }

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

  // --- Getters ---
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

  // --- Setters de control ---
  set estadoPago(nuevoEstado) { this.#estadoPago = nuevoEstado; }
  set observaciones(nuevaObs) { this.#observaciones = nuevaObs; }
  set nivelRiesgo(nuevoNivel) { this.#nivelRiesgo = nuevoNivel; }

  /**
   * Manejo de Error 2: Validación de Integridad de Datos.
   * Verifica que los campos críticos del pago contengan valores válidos.
   * Si detecta anomalías, clasifica el pago como 'ERROR_DATOS_INCOMPLETOS'.
   * 
   * @returns {{ valido: boolean, errores: string[] }}
   */
  validarIntegridadDatos() {
    const errores = [];

    if (!this.#id || this.#id.length < 2) {
      errores.push('ID de pago inexistente o inválido');
    }

    if (isNaN(this.#montoBruto) || this.#montoBruto <= 0) {
      errores.push(`Monto bruto inválido (${this.#montoBruto}). Debe ser mayor a 0`);
    }

    if (!['USD', 'CRC'].includes(this.#moneda)) {
      errores.push(`Moneda '${this.#moneda}' no admitida (solo USD o CRC)`);
    }

    if (!this.#proveedor.cedula || this.#proveedor.cedula.length < 9) {
      errores.push(`Cédula jurídica/física inválida (${this.#proveedor.cedula || 'vacía'})`);
    }

    if (!this.#fechaVencimiento || isNaN(Date.parse(this.#fechaVencimiento))) {
      errores.push(`Fecha de vencimiento inválida (${this.#fechaVencimiento})`);
    }

    const valido = errores.length === 0;

    if (!valido) {
      this.#estadoPago = 'ERROR_DATOS_INCOMPLETOS';
      this.#nivelRiesgo = 'CRITICO';
      this.#observaciones = `Rechazado por validación de datos: ${errores.join('; ')}`;
    }

    return { valido, errores };
  }

  /**
   * Regla de Negocio 3: Prioridad y Recargo/Descuento por Vencimiento.
   * Calcula los días restantes entre una fecha de referencia y la fecha de vencimiento.
   * Define la prioridad de desembolso:
   *  - Días < 0: URGENTE (Factura vencida)
   *  - Días <= 3: ALTA (Próximo a vencer)
   *  - Días > 3: NORMAL (En plazo regular)
   * 
   * @param {Date|string} [fechaReferencia=new Date()]
   * @returns {{ diasRestantes: number, prioridad: string, estaVencido: boolean, estadoVencimiento: string }}
   */
  calcularDiasRestantesYVencimiento(fechaReferencia = new Date()) {
    const ref = new Date(fechaReferencia);
    const venc = new Date(this.#fechaVencimiento);

    // Normalizar a medianoche para cálculo estricto de días calendario
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

  /**
   * Regla de Negocio 2: Cálculo de Retención Preventiva / Impuesto según Monto y Régimen.
   * Aplica retención impositiva preventiva si supera los umbrales:
   *  - USD > $1,000 o CRC > ₡500,000:
   *      * 5% si el proveedor está en Régimen Simplificado o sin régimen.
   *      * 2% si el proveedor está en Régimen General.
   *  - Monto menor o igual al umbral: 0% de retención.
   * 
   * @returns {{ aplicaRetencion: boolean, tasaRetencion: number, montoRetencion: number, montoNeto: number }}
   */
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

    return {
      aplicaRetencion: superaUmbral,
      tasaRetencion,
      tasaPorcentaje: `${(tasaRetencion * 100).toFixed(1)}%`,
      montoRetencion,
      montoNeto
    };
  }

  /**
   * Regla de Negocio 5: Generación de Firma y Payload para Comprobante QR.
   * Construye un comprobante estructurado y un hash de validación criptográfica/única
   * únicamente para pagos aprobados, generando la URL lista para la API de QR Server.
   * Formato del hash: COMP-{id}-{cedula}-{timestamp}
   * 
   * @param {number|string} [timestamp=Date.now()]
   * @returns {{ hashVerificacion: string, payloadTexto: string, qrUrl: string }}
   */
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

    return {
      hashVerificacion,
      payloadTexto,
      qrUrl
    };
  }

  /**
   * Regla de Negocio 4 y Método Integrador: Evaluar Dictamen de Pago.
   * Ejecuta la secuencia completa de validaciones, reglas fiscales y límites de aprobación:
   *  1. Valida integridad de datos (Manejo de Error 2).
   *  2. Valida respuesta de la API de Hacienda (Manejo de Error 1).
   *  3. Ejecuta Regla 3 (Vencimiento y Prioridad).
   *  4. Evalúa Regla 1 (Riesgo tributario del proveedor). Si está en riesgo, retiene el pago.
   *  5. Si el proveedor está limpio, ejecuta Regla 2 (Cálculo de Retención).
   *  6. Evalúa Regla 4 (Límite de Aprobación Automática):
   *      - Monto <= $10,000 USD (o ₡5,000,000 CRC): Aprobación automática.
   *      - Monto > $10,000 USD (o ₡5,000,000 CRC): Requiere firma y auditoría gerencial adicional.
   *  7. Ejecuta Regla 5 (Generación de Comprobante QR) solo si está aprobado.
   * 
   * @param {Date|string} [fechaReferencia=new Date()]
   * @returns {Object} Resultado estructurado del dictamen
   */
  evaluarDictamenPago(fechaReferencia = new Date()) {
    // Paso 1: Error 2 - Validar integridad de datos
    const checkDatos = this.validarIntegridadDatos();
    if (!checkDatos.valido) {
      return this.toJSON();
    }

    // Paso 2: Error 1 - Validar disponibilidad de API de Hacienda
    if (!this.#proveedor.apiDisponible) {
      this.#estadoPago = 'PENDIENTE_REINTENTO_API';
      this.#nivelRiesgo = 'MEDIO';
      this.#observaciones = `API de Hacienda no disponible o proveedor no localizado: ${this.#proveedor.errorDetalle}`;
      return this.toJSON();
    }

    // Paso 3: Regla 3 - Calcular vencimiento y prioridad
    this.calcularDiasRestantesYVencimiento(fechaReferencia);

    // Paso 4: Regla 1 - Verificar morosidad y situación fiscal
    const evalRiesgo = this.#proveedor.estaEnRiesgo();
    if (evalRiesgo.enRiesgo) {
      this.#estadoPago = 'RETENIDO_REVISION_MANUAL';
      this.#nivelRiesgo = evalRiesgo.nivelRiesgo;
      this.#comprobanteQRUrl = null;
      this.#observaciones = `Pago retenido por riesgo tributario: ${evalRiesgo.motivos.join('; ')}. Prioridad de gestión: ${this.#detallesCalculo.prioridad}.`;
      return this.toJSON();
    }

    // Paso 5: Regla 2 - Calcular retenciones e impuestos
    this.calcularMontoNetoYRetencion();

    // Paso 6: Regla 4 - Límite de Aprobación Automática vs Auditoría Gerencial
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

    // Paso 7: Regla 5 - Generar QR únicamente para pagos aprobados
    this.generarPayloadQR();

    return this.toJSON();
  }

  /**
   * Genera el payload limpio para actualizar JSON Server
   * @returns {Object}
   */
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

  /**
   * Representación completa en formato JSON
   */
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
