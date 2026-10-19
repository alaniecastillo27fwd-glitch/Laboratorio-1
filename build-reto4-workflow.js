import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const jsCodeNode = fs.readFileSync('./n8n_code_node.js', 'utf8');

const consolidarCode = `
// Consolidar registro de historial y conclusión final (Reto 4)
const itemReferencia = $('4. Code POO - Evaluar Riesgo y Reglas').first();
const registroHistorial = itemReferencia.json.registroHistorialActual;
const conclusion = itemReferencia.json.conclusionTendencia;

return [{
  json: {
    ...registroHistorial,
    resumenLote: {
      totalEvaluados: registroHistorial.totalProveedoresEvaluados,
      aprobados: registroHistorial.pagosAprobados,
      retenidosOError: registroHistorial.pagosRetenidosOError,
      tasaRiesgo: registroHistorial.porcentajeRiesgo + '%',
      montoTotalEnRiesgoUSD: registroHistorial.montoTotalEnRiesgo
    },
    dictamenTendencia: registroHistorial.estadoTendencia,
    conclusionEjecutiva: conclusion
  }
}];
`.trim();

const workflow = {
  name: "Laboratorio 1 - Panel de Riesgo de Proveedores con Comprobante QR (POO + n8n)",
  nodes: [
    {
      parameters: {},
      id: "node-manual-trigger",
      name: "0. Manual Trigger - Ejecutar Ahora",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [-1300, 144]
    },
    {
      parameters: {
        rule: {
          interval: [
            {
              field: "hours",
              hoursInterval: 1
            }
          ]
        }
      },
      id: "869e51a9-abb0-423d-b1d9-c73c2652bcb9",
      name: "1. Schedule Trigger - Verificar Pagos",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [-1300, 320]
    },
    {
      parameters: {
        url: "http://localhost:3000/historial_ejecuciones",
        options: {
          timeout: 10000
        }
      },
      id: "node-get-historial",
      name: "1B. GET Historial Ejecuciones (JSON Server)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-1060, 240],
      onError: "continueRegularOutput"
    },
    {
      parameters: {
        url: "http://localhost:3000/pagos_pendientes",
        options: {
          timeout: 10000
        }
      },
      id: "9e925b17-5cba-4077-86f3-c34ef2c86304",
      name: "2. GET Pagos Pendientes (JSON Server)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-820, 240]
    },
    {
      parameters: {
        url: "=https://api.hacienda.go.cr/fe/ae?identificacion={{ $json.cedulaJuridica }}",
        options: {
          timeout: 10000
        }
      },
      id: "b8ed2b19-01c1-4dcc-ac81-653ee6b77cc7",
      name: "3. GET Situacion Tributaria (API Hacienda)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-580, 240],
      continueOnFail: true,
      onError: "continueRegularOutput"
    },
    {
      parameters: {
        jsCode: jsCodeNode
      },
      id: "4cf72aef-87bc-4c05-9bf1-3ae825cf0893",
      name: "4. Code POO - Evaluar Riesgo y Reglas",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-320, 240]
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
              id: "cond-aprobado-qr-01",
              leftValue: "={{ $json.aprobadoParaQR }}",
              rightValue: true,
              operator: {
                type: "boolean",
                operation: "true",
                singleValue: true
              }
            }
          ],
          combinator: "and"
        },
        options: {}
      },
      id: "f5eb520a-21bc-47e1-92c0-2f1dc2a0fbf1",
      name: "5. IF - ¿Pago Aprobado para QR?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [-60, 240]
    },
    {
      parameters: {
        url: "=https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={{ encodeURIComponent($json.qrPayloadTexto || $json.comprobanteQRUrl) }}",
        options: {
          timeout: 10000
        }
      },
      id: "26765b9f-22db-43e7-a174-7a512238aced",
      name: "6A. GET Generar Comprobante QR (api.qrserver.com)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [200, 120]
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/pagos_pendientes/{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estadoPago\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.estadoPago }}\",\n  \"nivelRiesgo\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.nivelRiesgo }}\",\n  \"retencion\": {{ $('5. IF - ¿Pago Aprobado para QR?').item.json.retencion }},\n  \"montoNeto\": {{ $('5. IF - ¿Pago Aprobado para QR?').item.json.montoNeto }},\n  \"prioridad\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.prioridad }}\",\n  \"codigoComprobante\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.codigoComprobante }}\",\n  \"comprobanteQRUrl\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.comprobanteQRUrl }}\",\n  \"observaciones\": \"{{ $('5. IF - ¿Pago Aprobado para QR?').item.json.observaciones }}\",\n  \"detallesFiscales\": {{ JSON.stringify($('5. IF - ¿Pago Aprobado para QR?').item.json.detallesFiscales) }}\n}",
        options: {}
      },
      id: "cbb9a2b9-141b-48a1-bec7-08e07b26508a",
      name: "6B. PATCH Actualizar Pago Aprobado (JSON Server)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [460, 120],
      continueOnFail: true,
      onError: "continueRegularOutput"
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/pagos_pendientes/{{ $json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estadoPago\": \"{{ $json.estadoPago }}\",\n  \"nivelRiesgo\": \"{{ $json.nivelRiesgo }}\",\n  \"retencion\": {{ $json.retencion }},\n  \"montoNeto\": {{ $json.montoNeto }},\n  \"prioridad\": \"{{ $json.prioridad }}\",\n  \"codigoComprobante\": null,\n  \"comprobanteQRUrl\": null,\n  \"observaciones\": \"{{ $json.observaciones }}\",\n  \"detallesFiscales\": {{ JSON.stringify($json.detallesFiscales) }}\n}",
        options: {}
      },
      id: "dd6ee51e-ecdd-4043-8ac5-4e56f18cbb70",
      name: "6C. PATCH Retener o Registrar Error (JSON Server)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [460, 360],
      continueOnFail: true,
      onError: "continueRegularOutput"
    },
    {
      parameters: {
        jsCode: consolidarCode
      },
      id: "node-consolidar-resumen",
      name: "7A. Consolidar Resumen de Tendencia",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [740, 240]
    },
    {
      parameters: {
        method: "POST",
        url: "http://localhost:3000/historial_ejecuciones",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"id\": \"{{ $json.id }}\",\n  \"fechaEjecucion\": \"{{ $json.fechaEjecucion }}\",\n  \"totalProveedoresEvaluados\": {{ $json.totalProveedoresEvaluados }},\n  \"pagosAprobados\": {{ $json.pagosAprobados }},\n  \"pagosRetenidosOError\": {{ $json.pagosRetenidosOError }},\n  \"porcentajeRiesgo\": {{ $json.porcentajeRiesgo }},\n  \"montoTotalEnRiesgo\": {{ $json.montoTotalEnRiesgo }},\n  \"estadoTendencia\": \"{{ $json.estadoTendencia }}\",\n  \"conclusionTendencia\": \"{{ $json.conclusionTendencia }}\"\n}",
        options: {}
      },
      id: "node-post-historial",
      name: "7B. POST Guardar Historial (JSON Server)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [980, 240],
      continueOnFail: true,
      onError: "continueRegularOutput"
    }
  ],
  connections: {
    "0. Manual Trigger - Ejecutar Ahora": {
      main: [
        [
          {
            node: "1B. GET Historial Ejecuciones (JSON Server)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "1. Schedule Trigger - Verificar Pagos": {
      main: [
        [
          {
            node: "1B. GET Historial Ejecuciones (JSON Server)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "1B. GET Historial Ejecuciones (JSON Server)": {
      main: [
        [
          {
            node: "2. GET Pagos Pendientes (JSON Server)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "2. GET Pagos Pendientes (JSON Server)": {
      main: [
        [
          {
            node: "3. GET Situacion Tributaria (API Hacienda)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "3. GET Situacion Tributaria (API Hacienda)": {
      main: [
        [
          {
            node: "4. Code POO - Evaluar Riesgo y Reglas",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "4. Code POO - Evaluar Riesgo y Reglas": {
      main: [
        [
          {
            node: "5. IF - ¿Pago Aprobado para QR?",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "5. IF - ¿Pago Aprobado para QR?": {
      main: [
        [
          {
            node: "6A. GET Generar Comprobante QR (api.qrserver.com)",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "6C. PATCH Retener o Registrar Error (JSON Server)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "6A. GET Generar Comprobante QR (api.qrserver.com)": {
      main: [
        [
          {
            node: "6B. PATCH Actualizar Pago Aprobado (JSON Server)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "6B. PATCH Actualizar Pago Aprobado (JSON Server)": {
      main: [
        [
          {
            node: "7A. Consolidar Resumen de Tendencia",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "6C. PATCH Retener o Registrar Error (JSON Server)": {
      main: [
        [
          {
            node: "7A. Consolidar Resumen de Tendencia",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "7A. Consolidar Resumen de Tendencia": {
      main: [
        [
          {
            node: "7B. POST Guardar Historial (JSON Server)",
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
  id: "CUWXsiYAWklo8Tir"
};

// 1. Guardar archivos de workflow
fs.writeFileSync('./workflow_n8n.json', JSON.stringify(workflow, null, 2), 'utf8');
fs.writeFileSync('./workflow.json', JSON.stringify(workflow, null, 2), 'utf8');
fs.writeFileSync('./workflow-CUWXsiYAWklo8Tir.json', JSON.stringify(workflow, null, 2), 'utf8');
console.log('✔ workflow_n8n.json generado exitosamente.');

// 2. Actualizar directamente en la base de datos de n8n
try {
  const home = process.env.USERPROFILE || process.env.HOME;
  const dbPath = path.join(home, '.n8n', 'database.sqlite');
  const db = new DatabaseSync(dbPath);

  db.prepare('UPDATE workflow_entity SET nodes = ?, connections = ?, updatedAt = datetime(?) WHERE id = ?')
    .run(JSON.stringify(workflow.nodes), JSON.stringify(workflow.connections), new Date().toISOString(), 'CUWXsiYAWklo8Tir');

  console.log('✔ Workflow CUWXsiYAWklo8Tir actualizado en database.sqlite de n8n.');
} catch (err) {
  console.error('Error al actualizar database.sqlite:', err.message);
}
