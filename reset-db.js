import fs from 'fs';

const initialDB = {
  "pagos_pendientes": [
    {
      "id": "PAG-101",
      "proveedorNombre": "INSTITUTO MIXTO DE AYUDA SOCIAL",
      "cedulaJuridica": "4000042144",
      "montoBruto": 2500,
      "moneda": "USD",
      "fechaEmision": "2026-10-01",
      "fechaVencimiento": "2026-10-25",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-102",
      "proveedorNombre": "INSTITUTO TECNOLOGICO DE COSTA RICA",
      "cedulaJuridica": "4000042145",
      "montoBruto": 45000,
      "moneda": "USD",
      "fechaEmision": "2026-10-10",
      "fechaVencimiento": "2026-10-21",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-103",
      "proveedorNombre": "LORENA LUCIA VERA ROJAS",
      "cedulaJuridica": "115820844",
      "montoBruto": 3000,
      "moneda": "USD",
      "fechaEmision": "2026-09-15",
      "fechaVencimiento": "2026-10-10",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-104",
      "proveedorNombre": "AGENCIA DE VIAJES BUEN PASO SOCIEDAD ANONIMA",
      "cedulaJuridica": "3101147585",
      "montoBruto": 1800,
      "moneda": "USD",
      "fechaEmision": "2026-10-05",
      "fechaVencimiento": "2026-10-30",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-105",
      "proveedorNombre": "SOCIEDAD AGRICOLA HUERTAS Y JIRON SOCIEDAD ANONIMA",
      "cedulaJuridica": "3101123456",
      "montoBruto": 3500,
      "moneda": "USD",
      "fechaEmision": "2026-10-02",
      "fechaVencimiento": "2026-10-28",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-106",
      "proveedorNombre": "DISTRIBUIDORA SIN REGISTRO EN HACIENDA",
      "cedulaJuridica": "3101234567",
      "montoBruto": 1200,
      "moneda": "USD",
      "fechaEmision": "2026-10-03",
      "fechaVencimiento": "2026-10-24",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    },
    {
      "id": "PAG-107",
      "proveedorNombre": "REGISTRO CON DATOS CORRUPTOS",
      "cedulaJuridica": "",
      "montoBruto": -500,
      "moneda": "USD",
      "fechaEmision": "2026-10-01",
      "fechaVencimiento": "fecha-invalida",
      "estadoPago": "PENDIENTE",
      "nivelRiesgo": null,
      "comprobanteQRUrl": null,
      "observaciones": null
    }
  ],
  "historial_ejecuciones": [
    {
      "id": "HIST-001",
      "fechaEjecucion": "2026-10-17T10:00:00.000Z",
      "totalProveedoresEvaluados": 5,
      "pagosAprobados": 2,
      "pagosRetenidosOError": 3,
      "porcentajeRiesgo": 60,
      "montoTotalEnRiesgo": 2750,
      "estadoTendencia": "EMPEORANDO",
      "conclusionTendencia": "La situación está EMPEORANDO: el porcentaje de pagos en riesgo aumentó de 40% a 60% (+20%) respecto al corte anterior."
    },
    {
      "id": "HIST-002",
      "fechaEjecucion": "2026-10-18T11:30:00.000Z",
      "totalProveedoresEvaluados": 6,
      "pagosAprobados": 3,
      "pagosRetenidosOError": 3,
      "porcentajeRiesgo": 50,
      "montoTotalEnRiesgo": 3100,
      "estadoTendencia": "MEJORANDO",
      "conclusionTendencia": "La situación está MEJORANDO: el porcentaje de pagos en riesgo bajó de 60% a 50% (-10%) respecto al corte anterior."
    },
    {
      "id": "HIST-003",
      "fechaEjecucion": "2026-10-19T09:00:00.000Z",
      "totalProveedoresEvaluados": 6,
      "pagosAprobados": 2,
      "pagosRetenidosOError": 4,
      "porcentajeRiesgo": 66.7,
      "montoTotalEnRiesgo": 5300,
      "estadoTendencia": "EMPEORANDO",
      "conclusionTendencia": "La situación está EMPEORANDO: el porcentaje de pagos en riesgo aumentó de 50% a 66.7% (+16.7%) respecto al corte anterior."
    }
  ],
  "$schema": "./node_modules/json-server/schema.json"
};

fs.writeFileSync('./db.json', JSON.stringify(initialDB, null, 2), 'utf8');
console.log('✔ Base de datos db.json restablecida al estado inicial con historial de ejecuciones.');
