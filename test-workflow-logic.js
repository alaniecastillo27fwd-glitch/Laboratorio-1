import { Proveedor } from './classes/Proveedor.js';
import { PagoProveedor } from './classes/PagoProveedor.js';
import { HistorialTendencia } from './classes/HistorialTendencia.js';

/**
 * Script de validación end-to-end con Reto 4:
 * Simula la ejecución completa del flujo n8n:
 *  1. Obtiene historial previo de ejecuciones (/historial_ejecuciones)
 *  2. Obtiene pagos pendientes (/pagos_pendientes)
 *  3. Consulta la API de Hacienda para cada proveedor
 *  4. Ejecuta lógica POO (Proveedor + PagoProveedor)
 *  5. Instancia HistorialTendencia y determina la tendencia (MEJORANDO/EMPEORANDO/ESTABLE)
 *  6. Actualiza cada pago en JSON Server
 *  7. Guarda el nuevo registro histórico mediante POST /historial_ejecuciones
 */
async function validarFlujoCompletoConReto4() {
  console.log('1. Consultando historial previo (http://localhost:3000/historial_ejecuciones)...');
  const resHistorial = await fetch('http://localhost:3000/historial_ejecuciones');
  const historialPrevio = await resHistorial.json();
  console.log(`-> Se recuperaron ${historialPrevio.length} ejecuciones históricas previas.`);
  const ultimoCorte = historialPrevio[historialPrevio.length - 1];
  console.log(`   Último corte (${ultimoCorte?.id}): Riesgo = ${ultimoCorte?.porcentajeRiesgo}%\n`);

  console.log('2. Consultando pagos pendientes (http://localhost:3000/pagos_pendientes)...');
  const resPagos = await fetch('http://localhost:3000/pagos_pendientes');
  const pagos = await resPagos.json();
  console.log(`-> Se obtuvieron ${pagos.length} pagos para evaluar.\n`);

  console.log('3. Evaluando pagos con clases Proveedor y PagoProveedor...');
  const itemsActualizados = [];

  for (const pagoItem of pagos) {
    let haciendaRes = null;
    if (pagoItem.cedulaJuridica && pagoItem.cedulaJuridica.length >= 9) {
      try {
        const hRes = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${pagoItem.cedulaJuridica}`);
        if (hRes.ok) haciendaRes = await hRes.json();
        else haciendaRes = { code: hRes.status, status: await hRes.text() };
      } catch (err) {
        haciendaRes = { error: err.message };
      }
    } else {
      haciendaRes = { error: 'Cédula no proporcionada' };
    }

    const proveedor = new Proveedor({
      cedula: pagoItem.cedulaJuridica,
      nombre: pagoItem.proveedorNombre,
      haciendaResponse: haciendaRes
    });

    const pago = new PagoProveedor({
      id: pagoItem.id,
      proveedor: proveedor,
      montoBruto: pagoItem.montoBruto,
      moneda: pagoItem.moneda,
      fechaEmision: pagoItem.fechaEmision,
      fechaVencimiento: pagoItem.fechaVencimiento,
      estadoPago: pagoItem.estadoPago
    });

    pago.evaluarDictamenPago();
    const updatePayload = pago.toUpdatePayload();
    itemsActualizados.push(updatePayload);

    // Actualizar pago en JSON Server
    await fetch(`http://localhost:3000/pagos_pendientes/${pagoItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });
  }

  console.log('\n4. Ejecutando análisis de tendencia con HistorialTendencia (Reto 4)...');
  const evaluadorTendencia = new HistorialTendencia(historialPrevio, itemsActualizados);
  const reporte = evaluadorTendencia.generarReporteYConclusion();

  console.log(` -> Total Evaluados: ${reporte.registroHistorialActual.totalProveedoresEvaluados}`);
  console.log(` -> Pagos Aprobados: ${reporte.registroHistorialActual.pagosAprobados}`);
  console.log(` -> Pagos Retenidos/Error: ${reporte.registroHistorialActual.pagosRetenidosOError}`);
  console.log(` -> Tasa de Riesgo Actual: ${reporte.registroHistorialActual.porcentajeRiesgo}%`);
  console.log(` -> Tasa de Riesgo Anterior: ${reporte.porcentajeRiesgoHistorico}%`);
  console.log(` -> Estado Tendencia: [${reporte.estadoTendencia}]`);
  console.log(` -> Conclusión Ejecutiva:\n    "${reporte.conclusionTendencia}"\n`);

  console.log('5. Guardando nueva ejecución en JSON Server (POST /historial_ejecuciones)...');
  const postRes = await fetch('http://localhost:3000/historial_ejecuciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reporte.registroHistorialActual)
  });

  if (postRes.ok) {
    const nuevoRegistro = await postRes.json();
    console.log(`✔ Registro ${nuevoRegistro.id} guardado con éxito en el historial de JSON Server.\n`);
  } else {
    console.error(`Error al guardar historial: ${postRes.statusText}`);
  }

  // Verificación final
  const resHistorialFinal = await fetch('http://localhost:3000/historial_ejecuciones');
  const historialFinal = await resHistorialFinal.json();
  console.log('Historial actualizado en JSON Server:');
  console.table(historialFinal.map(h => ({
    ID: h.id,
    Fecha: h.fechaEjecucion?.substring(0, 19),
    Total: h.totalProveedoresEvaluados,
    Aprobados: h.pagosAprobados,
    Retenidos: h.pagosRetenidosOError,
    'Riesgo %': h.porcentajeRiesgo + '%',
    Tendencia: h.estadoTendencia
  })));

  console.log('\n✔ Simulación completa con Reto 4 ejecutada con éxito.');
}

validarFlujoCompletoConReto4();
