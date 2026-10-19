import fs from 'fs';

const codeNodeContent = fs.readFileSync('./n8n-code-node.js', 'utf8');

const summaryCode = `
// Genera resumen ejecutivo consolidado del lote de pagos procesados
const items = $input.all();
let aprobados = 0;
let conAuditoria = 0;
let retenidos = 0;
let reintentosApi = 0;
let erroresDatos = 0;
let montoTotalAprobado = 0;
let retencionTotal = 0;

for (const item of items) {
  const d = item.json;
  const estado = d.estadoPago || '';
  if (estado === 'APROBADO') {
    aprobados++;
    montoTotalAprobado += (d.detallesFiscales?.montoNeto || d.montoBruto || 0);
    retencionTotal += (d.detallesFiscales?.retencionAplicada || 0);
  } else if (estado === 'APROBADO_CON_AUDITORIA') {
    aprobados++;
    conAuditoria++;
    montoTotalAprobado += (d.detallesFiscales?.montoNeto || d.montoBruto || 0);
    retencionTotal += (d.detallesFiscales?.retencionAplicada || 0);
  } else if (estado === 'RETENIDO_REVISION_MANUAL') {
    retenidos++;
  } else if (estado === 'PENDIENTE_REINTENTO_API') {
    reintentosApi++;
  } else if (estado === 'ERROR_DATOS_INCOMPLETOS') {
    erroresDatos++;
  }
}

return [{
  json: {
    timestamp: new Date().toISOString(),
    totalPagosProcesados: items.length,
    resumenDictamenes: {
      aprobadosTotales: aprobados,
      aprobadosDirectos: aprobados - conAuditoria,
      aprobadosConAuditoriaGerencial: conAuditoria,
      retenidosPorRiesgoTributario: retenidos,
      pendientesReintentoApiHacienda: reintentosApi,
      rechazadosPorDatosCorruptos: erroresDatos
    },
    totalesFinancierosUSD: {
      montoNetoDesembolsable: Math.round(montoTotalAprobado * 100) / 100,
      totalRetencionesFiscales: Math.round(retencionTotal * 100) / 100
    },
    estadoEjecucion: 'EXITO_AUDITADO',
    mensaje: 'Lote de pagos evaluado bajo reglas POO y persistido en JSON Server con comprobantes QR'
  }
}];
`.trim();

const workflow = {
  name: "Panel de Riesgo de Proveedores con Comprobante QR (POO + n8n)",
  nodes: [
    {
      parameters: {},
      id: "node-manual-trigger",
      name: "Iniciar Evaluación Manual",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [200, 300]
    },
    {
      parameters: {
        url: "http://localhost:3000/pagos_pendientes",
        options: {}
      },
      id: "node-http-json-server-get",
      name: "Consultar Pagos Pendientes",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, 300]
    },
    {
      parameters: {
        url: "=https://api.hacienda.go.cr/fe/ae?identificacion={{ $json.cedulaJuridica }}",
        options: {
          response: {
            response: {
              neverError: true
            }
          }
        }
      },
      onError: "continueRegularOutput",
      id: "node-http-hacienda-get",
      name: "Consultar Situacion Tributaria Hacienda",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [680, 300]
    },
    {
      parameters: {
        jsCode: codeNodeContent
      },
      id: "node-code-motor-poo",
      name: "Motor POO: Evaluar Reglas de Negocio",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [920, 300]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2
          },
          conditions: [
            {
              id: "cond-aprobado",
              leftValue: "={{ $json.estadoPago }}",
              rightValue: "APROBADO",
              operator: {
                type: "string",
                operation: "startsWith"
              }
            }
          ],
          combinator: "and"
        }
      },
      id: "node-if-aprobado",
      name: "Bifurcacion: ¿Pago Aprobado?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1180, 300]
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/pagos_pendientes/{{ $json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estadoPago\": \"{{ $json.estadoPago }}\",\n  \"nivelRiesgo\": \"{{ $json.nivelRiesgo }}\",\n  \"comprobanteQRUrl\": \"{{ $json.comprobanteQRUrl }}\",\n  \"observaciones\": \"{{ $json.observaciones }}\",\n  \"detallesFiscales\": {{ JSON.stringify($json.detallesFiscales) }}\n}",
        options: {}
      },
      id: "node-http-update-aprobado",
      name: "Actualizar Pago Aprobado con QR",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1440, 200]
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/pagos_pendientes/{{ $json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estadoPago\": \"{{ $json.estadoPago }}\",\n  \"nivelRiesgo\": \"{{ $json.nivelRiesgo }}\",\n  \"comprobanteQRUrl\": null,\n  \"observaciones\": \"{{ $json.observaciones }}\",\n  \"detallesFiscales\": {{ JSON.stringify($json.detallesFiscales) }}\n}",
        options: {}
      },
      id: "node-http-update-retenido",
      name: "Actualizar Pago Retenido o Error",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1440, 420]
    },
    {
      parameters: {
        jsCode: summaryCode
      },
      id: "node-code-resumen-ejecutivo",
      name: "Resumen Ejecutivo de Auditoria",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1720, 310]
    }
  ],
  connections: {
    "Iniciar Evaluación Manual": {
      main: [
        [
          {
            node: "Consultar Pagos Pendientes",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Consultar Pagos Pendientes": {
      main: [
        [
          {
            node: "Consultar Situacion Tributaria Hacienda",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Consultar Situacion Tributaria Hacienda": {
      main: [
        [
          {
            node: "Motor POO: Evaluar Reglas de Negocio",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Motor POO: Evaluar Reglas de Negocio": {
      main: [
        [
          {
            node: "Bifurcacion: ¿Pago Aprobado?",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Bifurcacion: ¿Pago Aprobado?": {
      main: [
        [
          {
            node: "Actualizar Pago Aprobado con QR",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Actualizar Pago Retenido o Error",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Actualizar Pago Aprobado con QR": {
      main: [
        [
          {
            node: "Resumen Ejecutivo de Auditoria",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Actualizar Pago Retenido o Error": {
      main: [
        [
          {
            node: "Resumen Ejecutivo de Auditoria",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  active: false,
  settings: {
    executionOrder: "v1"
  },
  meta: {
    instanceId: "laboratorio-poo-n8n"
  }
};

fs.writeFileSync('./workflow.json', JSON.stringify(workflow, null, 2), 'utf8');
console.log('✔ Archivo workflow.json generado con éxito.');
