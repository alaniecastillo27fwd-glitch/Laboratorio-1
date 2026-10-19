# Laboratorio #1: Soluciones de Negocio (POO + n8n)
## Panel de Riesgo de Proveedores con Comprobante QR
### Extensión Implementada: Reto 4 (Historial y Tendencia)

Solución completa y funcional desarrollada en JavaScript puro (ES6+) y automatizada en n8n para la evaluación fiscal de proveedores ante el Ministerio de Hacienda de Costa Rica, la emisión de comprobantes QR verificables y el análisis temporal de tendencia de riesgo.

---

## 📁 Estructura del Proyecto

```text
├── classes/
│   ├── Proveedor.js            # Entidad Proveedor (Encapsulamiento, Regla 1, Error 1)
│   ├── PagoProveedor.js        # Entidad PagoProveedor (Reglas 2, 3, 4, 5, Error 2)
│   └── HistorialTendencia.js   # Reto 4: Análisis comparativo y cálculo de tendencia temporal
├── db.json                     # Base de datos JSON Server (pagos_pendientes + historial_ejecuciones)
├── main.js                     # Prueba independiente de consola (node main.js)
├── workflow_n8n.json           # Workflow completo listo para importar en n8n con Reto 4
├── workflow.json               # Respaldo sincronizado del workflow
├── n8n_code_node.js            # Código exacto para el nodo Code (Proveedor + PagoProveedor + HistorialTendencia)
├── index.html                  # Dashboard web corporativo en JavaScript puro (Sin frameworks)
├── test-workflow-logic.js      # Simulación end-to-end con Reto 4 (GET historial + POST resultado)
├── reset-db.js                 # Utilidad para restablecer pagos pendientes e historial base
├── package.json                # Scripts npm para pruebas y ejecución
└── DOCUMENTO_LOGICA_NEGOCIO.md # Documento técnico de 2-4 páginas y guion de presentación oral
```

---

## 🚀 Inicio Rápido (Quick Start)

### 1. Ejecutar las Pruebas Unitarias de POO en Consola (Sin n8n)
Evalúa las 5 reglas de negocio base, los 2 manejos de errores y la clase `HistorialTendencia` con el análisis temporal:
```bash
npm test
# o bien:
node main.js
```

### 2. Iniciar JSON Server con el Panel Web y la API
Levanta el servidor en el puerto 3000 con soporte para archivos estáticos y endpoints de base de datos:
```bash
npm run server
```
- **Panel Web en el Navegador:** [http://localhost:3000](http://localhost:3000)
- **Endpoint de Pagos:** `http://localhost:3000/pagos_pendientes`
- **Endpoint de Historial:** `http://localhost:3000/historial_ejecuciones`

### 3. Restablecer la Base de Datos al Estado Inicial
Si deseas reiniciar todos los pagos al estado `"PENDIENTE"` y restablecer el historial base de 3 ejecuciones:
```bash
npm run reset-db
```

### 4. Simulación End-to-End por Consola
Ejecuta la simulación que replica el flujo completo de n8n:
```bash
npm run simulate
```

---

## ⚙️ Workflow de n8n con Reto 4

El workflow [workflow_n8n.json](./workflow_n8n.json) ya se encuentra sincronizado con tu n8n en el workflow [CUWXsiYAWklo8Tir](http://localhost:5678/workflow/CUWXsiYAWklo8Tir):
1. **Recuperación de Historial:** Nodo `1B. GET Historial Ejecuciones (JSON Server)` lee las ejecuciones previas.
2. **Consulta de Pagos y Hacienda:** Nodos 2 y 3 obtienen las facturas y la situación fiscal en tiempo real.
3. **Motor POO Integrado:** El nodo 4 evalúa las 3 clases (`Proveedor`, `PagoProveedor`, `HistorialTendencia`).
4. **Bifurcación IF y Comprobantes:** Nodos 5, 6A, 6B y 6C procesan pagos aprobados con QR o retienen con observaciones.
5. **Persistencia Histórica:** Nodos 7A y 7B guardan automáticamente la corrida actual en `POST /historial_ejecuciones`.
6. **Dictamen Final:** El resultado del flujo muestra la conclusión en lenguaje natural (ej. *"La situación está MEJORANDO..."*).
