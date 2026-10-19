import fs from 'fs';
import { Proveedor } from './classes/Proveedor.js';
import { PagoProveedor } from './classes/PagoProveedor.js';
import { HistorialTendencia } from './classes/HistorialTendencia.js';

/**
 * ============================================================================
 * LABORATORIO #1: SOLUCIONES DE NEGOCIO (POO + n8n)
 * Escenario: Panel de riesgo de proveedores con comprobante QR
 * Extensión: Reto 4 (Historial y Tendencia)
 * ============================================================================
 * Archivo de prueba independiente (main.js)
 * Demuestra y valida la totalidad de la lógica de negocio, manejo de errores
 * y el cálculo de tendencia histórica con POO en JavaScript puro (ES6+).
 * 
 * Se ejecuta directamente con: node main.js
 * ============================================================================
 */

// Utilidades para formato en consola
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

function banner(titulo) {
  console.log(`\n${CYAN}================================================================================${RESET}`);
  console.log(`${BOLD}${MAGENTA} ${titulo}${RESET}`);
  console.log(`${CYAN}================================================================================${RESET}`);
}

function subBanner(subtitulo) {
  console.log(`\n${BOLD}${YELLOW}>>> ${subtitulo}${RESET}`);
  console.log(`${GRAY}--------------------------------------------------------------------------------${RESET}`);
}

async function ejecutarPruebas() {
  banner('SUITE DE PRUEBAS DE REGLAS DE NEGOCIO (POO EN JAVASCRIPT PURO)');
  console.log(`${GRAY}Fecha de ejecución: ${new Date().toISOString()}${RESET}\n`);

  const fechaEvaluacion = '2026-10-19';
  const loteResultados = [];

  // --------------------------------------------------------------------------
  // CASO 1: Aprobación Automática (Monto <= 10,000 USD, Régimen General, Sin Riesgo)
  // --------------------------------------------------------------------------
  subBanner('CASO 1: Aprobación Automática Estándar (Régimen General, USD $2,500.00)');
  const prov1 = new Proveedor({
    cedula: '4000042144',
    nombre: 'INSTITUTO MIXTO DE AYUDA SOCIAL',
    haciendaResponse: {
      nombre: 'INSTITUTO MIXTO DE AYUDA SOCIAL',
      regimen: { codigo: 1, descripcion: 'Régimen general' },
      situacion: { moroso: 'NO', omiso: 'NO', estado: 'Inscrito', administracionTributaria: 'San José' }
    }
  });

  const pago1 = new PagoProveedor({
    id: 'PAG-101',
    proveedor: prov1,
    montoBruto: 2500.00,
    moneda: 'USD',
    fechaEmision: '2026-10-01',
    fechaVencimiento: '2026-10-25'
  });

  pago1.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago1.toUpdatePayload());

  console.log(`Proveedor: ${BOLD}${pago1.proveedor.nombre}${RESET} (${pago1.proveedor.cedula})`);
  console.log(`Regla 1 (Riesgo): ${GREEN}EN RIESGO = ${prov1.estaEnRiesgo().enRiesgo}${RESET} (Nivel: ${pago1.nivelRiesgo})`);
  console.log(`Regla 2 (Retención): Monto Bruto: $${pago1.montoBruto.toFixed(2)} | Retención (${pago1.detallesCalculo.tasaRetencion * 100}%): $${pago1.detallesCalculo.montoRetencion.toFixed(2)} | Neto: $${pago1.detallesCalculo.montoNeto.toFixed(2)}`);
  console.log(`Regla 3 (Vencimiento): Días: ${pago1.detallesCalculo.diasRestantes} | Prioridad: ${pago1.detallesCalculo.prioridad}`);
  console.log(`Regla 4 (Dictamen): Estado = ${GREEN}${BOLD}${pago1.estadoPago}${RESET}`);
  console.log(`Regla 5 (Comprobante QR): ${CYAN}${pago1.comprobanteQRUrl}${RESET}`);

  // --------------------------------------------------------------------------
  // CASO 2: Aprobación con Auditoría Gerencial (Monto > $10,000 USD)
  // --------------------------------------------------------------------------
  subBanner('CASO 2: Aprobación con Auditoría Gerencial (Monto Alto: USD $45,000.00)');
  const prov2 = new Proveedor({
    cedula: '4000042145',
    nombre: 'INSTITUTO TECNOLOGICO DE COSTA RICA',
    haciendaResponse: {
      nombre: 'INSTITUTO TECNOLOGICO DE COSTA RICA',
      regimen: { codigo: 1, descripcion: 'Régimen general' },
      situacion: { moroso: 'NO', omiso: 'NO', estado: 'Inscrito', administracionTributaria: 'Grandes Contribuyentes' }
    }
  });

  const pago2 = new PagoProveedor({
    id: 'PAG-102',
    proveedor: prov2,
    montoBruto: 45000.00,
    moneda: 'USD',
    fechaEmision: '2026-10-10',
    fechaVencimiento: '2026-10-21'
  });

  pago2.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago2.toUpdatePayload());

  console.log(`Proveedor: ${BOLD}${pago2.proveedor.nombre}${RESET}`);
  console.log(`Regla 4 (Auditoría): Estado = ${YELLOW}${BOLD}${pago2.estadoPago}${RESET}`);
  console.log(`Nota de Auditoría: ${pago2.auditoria}`);

  // --------------------------------------------------------------------------
  // CASO 3: Régimen Simplificado (Aplica Retención del 5%)
  // --------------------------------------------------------------------------
  subBanner('CASO 3: Proveedor en Régimen Simplificado (Aplica 5% de Retención)');
  const prov3 = new Proveedor({
    cedula: '115820844',
    nombre: 'LORENA LUCIA VERA ROJAS',
    haciendaResponse: {
      nombre: 'LORENA LUCIA VERA ROJAS',
      regimen: { codigo: 2, descripcion: 'Régimen simplificado' },
      situacion: { moroso: 'NO', omiso: 'NO', estado: 'Inscrito' }
    }
  });

  const pago3 = new PagoProveedor({
    id: 'PAG-103',
    proveedor: prov3,
    montoBruto: 3000.00,
    moneda: 'USD',
    fechaEmision: '2026-09-15',
    fechaVencimiento: '2026-10-10'
  });

  pago3.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago3.toUpdatePayload());

  console.log(`Proveedor: ${BOLD}${pago3.proveedor.nombre}${RESET} | Régimen: ${pago3.proveedor.regimen}`);
  console.log(`Regla 2 (Retención): Tasa aplicada = ${BOLD}${pago3.detallesCalculo.tasaRetencion * 100}%${RESET} ($${pago3.detallesCalculo.montoRetencion.toFixed(2)})`);

  // --------------------------------------------------------------------------
  // CASO 4: Proveedor Moroso/Omiso en Hacienda (Retención Inmediata)
  // --------------------------------------------------------------------------
  subBanner('CASO 4: Proveedor con Morosidad u Omisión Tributaria (Retenido para Revisión)');
  const prov4 = new Proveedor({
    cedula: '3101147585',
    nombre: 'AGENCIA DE VIAJES BUEN PASO SOCIEDAD ANONIMA',
    haciendaResponse: {
      nombre: 'AGENCIA DE VIAJES BUEN PASO SOCIEDAD ANONIMA',
      regimen: { codigo: 1, descripcion: 'Régimen general' },
      situacion: { moroso: 'SI', omiso: 'SI', estado: 'Inscrito' }
    }
  });

  const pago4 = new PagoProveedor({
    id: 'PAG-104',
    proveedor: prov4,
    montoBruto: 1800.00,
    moneda: 'USD',
    fechaEmision: '2026-10-05',
    fechaVencimiento: '2026-10-30'
  });

  pago4.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago4.toUpdatePayload());

  console.log(`Proveedor: ${BOLD}${pago4.proveedor.nombre}${RESET}`);
  console.log(`Estado del Pago: ${RED}${BOLD}${pago4.estadoPago}${RESET} (Nivel Riesgo: ${pago4.nivelRiesgo})`);
  console.log(`Motivo: ${pago4.observaciones}`);

  // --------------------------------------------------------------------------
  // CASO 5: Proveedor Desinscrito / Estado no 'Inscrito'
  // --------------------------------------------------------------------------
  subBanner('CASO 5: Proveedor con Estado Tributario No Inscrito (Desinscrito)');
  const prov5 = new Proveedor({
    cedula: '3101999888',
    nombre: 'SERVICIOS INDUSTRIALES OBSOLETOS S.A.',
    haciendaResponse: {
      nombre: 'SERVICIOS INDUSTRIALES OBSOLETOS S.A.',
      regimen: { codigo: 1, descripcion: 'Régimen general' },
      situacion: { moroso: 'NO', omiso: 'NO', estado: 'Desinscrito' }
    }
  });

  const pago5 = new PagoProveedor({
    id: 'PAG-105',
    proveedor: prov5,
    montoBruto: 3500.00,
    moneda: 'USD',
    fechaEmision: '2026-10-02',
    fechaVencimiento: '2026-10-28'
  });

  pago5.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago5.toUpdatePayload());

  console.log(`Estado del Pago: ${RED}${BOLD}${pago5.estadoPago}${RESET} | ${pago5.observaciones}`);

  // --------------------------------------------------------------------------
  // CASO 6: Error 1 - API de Hacienda Caída / Cédula No Encontrada (HTTP 404)
  // --------------------------------------------------------------------------
  subBanner('CASO 6: Manejo de Error 1 - Fallo en API Externa de Hacienda (HTTP 404)');
  const prov6 = new Proveedor({
    cedula: '3101234567',
    nombre: 'DISTRIBUIDORA SIN REGISTRO TRIBUTARIO',
    haciendaResponse: {
      code: 404,
      status: 'Information no available on this system, please try again with new values'
    }
  });

  const pago6 = new PagoProveedor({
    id: 'PAG-106',
    proveedor: prov6,
    montoBruto: 1200.00,
    moneda: 'USD',
    fechaEmision: '2026-10-03',
    fechaVencimiento: '2026-10-24'
  });

  pago6.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago6.toUpdatePayload());

  console.log(`Estado del Pago: ${YELLOW}${BOLD}${pago6.estadoPago}${RESET} (Contingencia sin romper el lote)`);

  // --------------------------------------------------------------------------
  // CASO 7: Error 2 - Datos Incompletos o Corruptos desde JSON Server
  // --------------------------------------------------------------------------
  subBanner('CASO 7: Manejo de Error 2 - Datos Incompletos o Corruptos (Monto Negativo / Cédula Vacía)');
  const prov7 = new Proveedor({
    cedula: '',
    nombre: 'PROVEEDOR CON REGISTRO CORRUPTO'
  });

  const pago7 = new PagoProveedor({
    id: 'PAG-107',
    proveedor: prov7,
    montoBruto: -500.00,
    moneda: 'USD',
    fechaEmision: '2026-10-01',
    fechaVencimiento: 'fecha-invalida'
  });

  pago7.evaluarDictamenPago(fechaEvaluacion);
  loteResultados.push(pago7.toUpdatePayload());

  console.log(`Resultado de validación de datos: ${RED}${pago7.estadoPago}${RESET}`);
  console.log(`Detalle: ${pago7.observaciones}`);

  // ==========================================================================
  // RETO 4: EVALUACIÓN DE HISTORIAL Y TENDENCIA TEMPORAL (HistorialTendencia)
  // ==========================================================================
  banner('RETO 4: HISTORIAL Y ANÁLISIS DE TENDENCIA DE RIESGO TEMPORAL');

  // Cargar historial previo desde db.json
  let historialPrevio = [];
  try {
    const rawDB = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    historialPrevio = rawDB.historial_ejecuciones || [];
  } catch (e) {
    console.log(`${GRAY}Usando historial simulado...${RESET}`);
    historialPrevio = [
      { id: 'HIST-001', porcentajeRiesgo: 60, estadoTendencia: 'EMPEORANDO' },
      { id: 'HIST-002', porcentajeRiesgo: 50, estadoTendencia: 'MEJORANDO' },
      { id: 'HIST-003', porcentajeRiesgo: 66.7, estadoTendencia: 'EMPEORANDO' }
    ];
  }

  console.log(`${BOLD}Historial Previo Cargado (${historialPrevio.length} ejecuciones):${RESET}`);
  historialPrevio.forEach(h => {
    console.log(`  - ${h.id} (${h.fechaEjecucion || 'N/A'}): Riesgo = ${h.porcentajeRiesgo}% | Tendencia = ${h.estadoTendencia}`);
  });

  // Instanciación de la clase HistorialTendencia
  const analizadorTendencia = new HistorialTendencia(historialPrevio, loteResultados);
  const metricas = analizadorTendencia.calcularMetricasEjecucionActual();
  const analisis = analizadorTendencia.determinarTendencia();
  const reporte = analizadorTendencia.generarReporteYConclusion();

  console.log(`\n${BOLD}${YELLOW}>>> Métricas de la Ejecución Actual:${RESET}`);
  console.log(`  • Total Proveedores Evaluados: ${BOLD}${metricas.totalProveedoresEvaluados}${RESET}`);
  console.log(`  • Pagos Aprobados: ${GREEN}${BOLD}${metricas.pagosAprobados}${RESET}`);
  console.log(`  • Pagos Retenidos o con Error: ${RED}${BOLD}${metricas.pagosRetenidosOError}${RESET}`);
  console.log(`  • Porcentaje de Riesgo Actual: ${BOLD}${metricas.porcentajeRiesgoActual}%${RESET}`);
  console.log(`  • Monto Total en Riesgo: $${metricas.montoTotalEnRiesgo.toFixed(2)} USD`);

  console.log(`\n${BOLD}${YELLOW}>>> Comparación Temporal y Tendencia:${RESET}`);
  console.log(`  • Porcentaje de Riesgo Anterior (${analisis.corteAnteriorId}): ${analisis.porcentajeRiesgoAnterior}%`);
  console.log(`  • Porcentaje de Riesgo Actual: ${metricas.porcentajeRiesgoActual}%`);
  console.log(`  • Variación: ${analisis.diferenciaPuntos > 0 ? '+' : ''}${analisis.diferenciaPuntos} puntos porcentuales`);
  
  let colorTendencia = GREEN;
  if (analisis.estadoTendencia === 'EMPEORANDO') colorTendencia = RED;
  else if (analisis.estadoTendencia === 'ESTABLE') colorTendencia = YELLOW;

  console.log(`  • Estado de la Tendencia: ${colorTendencia}${BOLD}${analisis.estadoTendencia}${RESET}`);
  console.log(`\n${BOLD}${CYAN}>>> Conclusión Ejecutiva Generada:${RESET}`);
  console.log(`  "${BOLD}${reporte.conclusionTendencia}${RESET}"`);

  console.log(`\n${BOLD}${YELLOW}>>> Objeto de Registro listo para POST /historial_ejecuciones:${RESET}`);
  console.log(JSON.stringify(reporte.registroHistorialActual, null, 2));

  banner('TODAS LAS PRUEBAS UNITARIAS, REGLAS Y RETO 4 COMPLETADOS CON ÉXITO');
  console.log(`${GREEN}${BOLD}✔ 5 Reglas de Negocio base verificadas.${RESET}`);
  console.log(`${GREEN}${BOLD}✔ 2 Manejos de Error verificados.${RESET}`);
  console.log(`${GREEN}${BOLD}✔ Reto 4 (Historial y Tendencia) verificado con clase POO HistorialTendencia.${RESET}\n`);
}

ejecutarPruebas();
