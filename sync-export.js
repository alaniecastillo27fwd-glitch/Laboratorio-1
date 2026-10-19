import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const home = process.env.USERPROFILE || process.env.HOME;
const dbPath = path.join(home, '.n8n', 'database.sqlite');
const db = new DatabaseSync(dbPath);

const row = db.prepare('SELECT * FROM workflow_entity WHERE id = ?').get('CUWXsiYAWklo8Tir');
if (row) {
  const exportData = {
    name: row.name,
    nodes: JSON.parse(row.nodes),
    connections: JSON.parse(row.connections),
    active: false,
    settings: JSON.parse(row.settings || '{}'),
    id: row.id
  };
  fs.writeFileSync('./workflow.json', JSON.stringify(exportData, null, 2), 'utf8');
  fs.writeFileSync('./workflow-CUWXsiYAWklo8Tir.json', JSON.stringify(exportData, null, 2), 'utf8');
  console.log('✔ workflow.json y workflow-CUWXsiYAWklo8Tir.json sincronizados con el workflow oficial de n8n.');
}
