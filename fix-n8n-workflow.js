import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const home = process.env.USERPROFILE || process.env.HOME;
const dbPath = path.join(home, '.n8n', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const row = db.prepare('SELECT nodes, connections FROM workflow_entity WHERE id = ?').get('CUWXsiYAWklo8Tir');
if (!row) {
  console.error('Workflow CUWXsiYAWklo8Tir no encontrado en database.sqlite');
  process.exit(1);
}

const nodes = JSON.parse(row.nodes);
const connections = JSON.parse(row.connections);

// 1. Corregir URL del Nodo 2 para consultar JSON Server local
const node2 = nodes.find(n => n.name.includes('2. GET'));
if (node2) {
  console.log('Antigua URL Nodo 2:', node2.parameters.url);
  node2.parameters.url = 'http://localhost:3000/pagos_pendientes';
  console.log('Nueva URL Nodo 2:', node2.parameters.url);
}

// 2. Proteger el Nodo 6C contra fallos y nulos
const node6C = nodes.find(n => n.name.includes('6C'));
if (node6C) {
  node6C.continueOnFail = true;
  node6C.onError = 'continueRegularOutput';
  console.log('Nodo 6C configurado con continueOnFail y onError: continueRegularOutput');
}

// 3. Proteger el Nodo 6B contra fallos
const node6B = nodes.find(n => n.name.includes('6B'));
if (node6B) {
  node6B.continueOnFail = true;
  node6B.onError = 'continueRegularOutput';
  console.log('Nodo 6B configurado con continueOnFail y onError: continueRegularOutput');
}

// 4. Agregar Manual Trigger si no existe para poder ejecutarlo con el botón "Execute workflow"
const hasManualTrigger = nodes.some(n => n.type === 'n8n-nodes-base.manualTrigger');
if (!hasManualTrigger) {
  const manualTriggerNode = {
    parameters: {},
    id: 'manual-trigger-btn',
    name: '0. Manual Trigger - Ejecutar Ahora',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [-1300, 144]
  };
  nodes.push(manualTriggerNode);

  if (!connections['0. Manual Trigger - Ejecutar Ahora']) {
    connections['0. Manual Trigger - Ejecutar Ahora'] = {
      main: [
        [
          {
            node: '2. GET Pagos Pendientes (JSON Server)',
            type: 'main',
            index: 0
          }
        ]
      ]
    };
  }
  console.log('Manual Trigger agregado para fácil ejecución manual en n8n');
}

// Guardar en SQLite
db.prepare('UPDATE workflow_entity SET nodes = ?, connections = ?, updatedAt = datetime(?) WHERE id = ?')
  .run(JSON.stringify(nodes), JSON.stringify(connections), new Date().toISOString(), 'CUWXsiYAWklo8Tir');

console.log('✔ Workflow CUWXsiYAWklo8Tir actualizado y corregido exitosamente en la base de datos de n8n.');
