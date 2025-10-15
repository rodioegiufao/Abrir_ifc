import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS XEOKIT
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl = null;
let isMeasuring = false;
let xeokitContainer;
let pointerLens;

// ✅ LISTA DE ARQUIVOS IFC 
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

// 🔥 CONTROLE DE VISIBILIDADE
let loadedModels = new Map();

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // 🔥 SINCRONIZAÇÃO DE CÂMERAS
    function syncCamerasToXeokit() {
        if (!viewer || !xeokitViewer || !xeokitViewer.camera) return;
        try {
            const scene = viewer.context.getScene();
            if (!scene || !scene.camera) return;
            const threeCamera = scene.camera;
            const threeControls = viewer.context.ifcCamera?.controls;
            if (!threeCamera || !threeControls) return;
            const threePos = threeCamera.position;
            const threeTarget = threeControls.target;
            if (!threePos || !threeTarget) return;

            xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
            xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
            if (threeCamera.fov) xeokitViewer.camera.perspective.fov = threeCamera.fov;
        } catch (err) {
            console.warn("⚠️ Erro na sincronização de câmera:", err);
        }
    }

    async function ensureCanvasReady() {
        const canvas = document.getElementById('xeokit-canvas');
        if (!canvas) return false;
        if (canvas.width === 0 || canvas.height === 0) {
            const container = document.getElementById('viewer-container');
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                console.log("✅ Canvas redimensionado para:", canvas.width, "x", canvas.height);
            }
        }
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            if (canvas.width > 0 && canvas.height > 0) return true;
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        return false;
    }

    // 🔥 INICIALIZA XEOKIT
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            const xeokitSDK = window.xeokitSDK;
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                console.error("❌ xeokitSDK não disponível");
                return;
            }

            const viewerContainer = document.getElementById('viewer-container');
            if (!viewerContainer) return;

            xeokitContainer = document.getElementById('xeokit-container');
            if (!xeokitContainer) {
                xeokitContainer = document.createElement('div');
                xeokitContainer.id = 'xeokit-container';
                xeokitContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                    pointer-events: none;
                    display: block;
                    visibility: visible;
                    opacity: 1;
                    background: transparent;
                `;
                viewerContainer.appendChild(xeokitContainer);
                console.log("✅ xeokit-container criado e anexado.");
            }

            let xeokitCanvas = document.getElementById('xeokit-canvas');
            if (!xeokitCanvas) {
                xeokitCanvas = document.createElement('canvas');
                xeokitCanvas.id = 'xeokit-canvas';
                const containerWidth = viewerContainer.clientWidth;
                const containerHeight = viewerContainer.clientHeight;
                xeokitCanvas.width = containerWidth;
                xeokitCanvas.height = containerHeight;
                xeokitCanvas.style.cssText = `
                    width: ${containerWidth}px;
                    height: ${containerHeight}px;
                    display: block;
                    position: absolute;
                    top: 0;
                    left: 0;
                    visibility: visible;
                    opacity: 1;
                    background: transparent;
                    pointer-events: none;
                `;
                xeokitContainer.appendChild(xeokitCanvas);
                console.log("✅ Canvas criado com dimensões:", xeokitCanvas.width, "x", xeokitCanvas.height);
            }

            const canvasReady = await ensureCanvasReady();
            if (!canvasReady) throw new Error("Canvas não ficou pronto");

            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: "xeokit-canvas",
                transparent: true,
                alpha: true,
                premultipliedAlpha: false
            });

            // ✅ Inicializa pausado
            xeokitViewer.scene.active = false;
            xeokitViewer.scene.input.enabled = false;
            xeokitContainer.style.pointerEvents = 'none';
            console.log("✅ Viewer xeokit inicializado e inativo");

            distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                pointSize: 8,
                lineWidth: 3,
                fontColor: "#FFFFFF",
                labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
                lineColor: "#FF0000"
            });
            console.log("✅ DistanceMeasurementsPlugin inicializado");

            if (viewer && viewer.context) setInterval(syncCamerasToXeokit, 150);

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }

    // 🔥 POINTER LENS
    function initializePointerLens() {
        if (!xeokitViewer) return null;
        const xeokitSDK = window.xeokitSDK;
        try {
            const lens = new xeokitSDK.PointerLens(xeokitViewer, {
                active: false,
                zoomFactor: 2
            });
            console.log("✅ PointerLens inicializado");
            return lens;
        } catch (err) {
            console.error("❌ Erro ao inicializar PointerLens:", err);
            return null;
        }
    }

    // 🔥 CONTROLE DE MEDIÇÃO
    function initializeMeasurementsControl() {
        if (!distanceMeasurements || !xeokitViewer) return null;
        const xeokitSDK = window.xeokitSDK;
        if (!pointerLens) pointerLens = initializePointerLens();
        try {
            const control = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements, {
                pointerLens: pointerLens
            });
            control.snapToVertex = true;
            control.snapToEdge = true;
            console.log("✅ DistanceMeasurementsMouseControl inicializado");
            return control;
        } catch (err) {
            console.error("❌ Erro ao inicializar controle de medições:", err);
            return null;
        }
    }

    // 🔥 MODO DE MEDIÇÃO (AGORA CONTROLADO CORRETAMENTE)
    function toggleMeasurement() {
        if (!xeokitViewer || !distanceMeasurements) {
            alert("Sistema de medições não está pronto.");
            return;
        }

        if (!distanceMeasurementsControl) {
            distanceMeasurementsControl = initializeMeasurementsControl();
            if (!distanceMeasurementsControl) {
                alert("Erro ao iniciar controle de medições.");
                return;
            }
        }

        isMeasuring = !isMeasuring;
        const button = document.getElementById('start-measurement');

        if (isMeasuring) {
            button.textContent = 'Parar Medição';
            button.classList.add('active');

            // ✅ Ativa renderização e eventos do xeokit
            xeokitViewer.scene.active = true;
            xeokitViewer.scene.input.enabled = true;
            xeokitContainer.style.pointerEvents = 'auto';

            if (distanceMeasurementsControl.activate)
                distanceMeasurementsControl.activate();

            if (pointerLens) {
                pointerLens.active = true;
                pointerLens.visible = true;
            }

            setupMeasurementEvents();
            console.log("✅ Modo de medição ATIVADO");
        } else {
            button.textContent = 'Iniciar Medição';
            button.classList.remove('active');

            if (pointerLens) {
                pointerLens.active = false;
                pointerLens.visible = false;
            }
            if (distanceMeasurementsControl.deactivate)
                distanceMeasurementsControl.deactivate();

            xeokitContainer.style.pointerEvents = 'none';
            xeokitViewer.scene.active = false;
            xeokitViewer.scene.input.enabled = false;
            removeMeasurementEvents();

            console.log("✅ Modo de medição DESATIVADO");
        }
    }


    // 🔥 EVENTOS DE MEDIÇÃO
    function setupMeasurementEvents() {
        if (!distanceMeasurements) return;
        distanceMeasurements.on("created", (e) => {
            console.log("📏 Medição criada:", e.measurement.id);
        });
        distanceMeasurements.on("destroyed", (e) => {
            console.log("🗑️ Medição destruída:", e.measurement.id);
        });
    }

    function removeMeasurementEvents() {
        if (!distanceMeasurements) return;
        distanceMeasurements.off("created");
        distanceMeasurements.off("destroyed");
    }

    // ----------------------------------
    // CONFIGURAÇÃO INICIAL
    // ----------------------------------

    viewer = CreateViewer(container);
    viewer.IFC.setWasmPath('wasm/');
    viewer.IFC.loader.ifcManager.applyWebIfcConfig({
        COORDINATE_TO_ORIGIN: true,
        USE_FAST_BOOLS: true
    });

    setTimeout(() => {
        console.log("🔄 Iniciando inicialização do xeokit...");
        initializeXeokitViewer();
    }, 3000);

    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    // BOTÕES
    document.getElementById('start-measurement').addEventListener('click', toggleMeasurement);
    document.getElementById('clear-measurements').addEventListener('click', () => {
        if (distanceMeasurements?.clear) {
            distanceMeasurements.clear();
            console.log("🗑️ Todas as medições foram limpas.");
        }
    });

    container.ondblclick = async (event) => {
        if (isMeasuring) return;
        const result = await viewer.IFC.selector.pick(true);
        if (!result) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.modelID, result.id, false);
        const props = await viewer.IFC.getProperties(result.modelID, result.id, true);
        lastProps = props;
        console.log("🟩 Item selecionado:", lastProps);
        showProperties(props, result.id);
    };

    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
            if (isMeasuring) {
                toggleMeasurement();
                return;
            }
            if (viewer?.IFC?.selector) {
                viewer.IFC.selector.unpickIfcItems();
                viewer.IFC.selector.unHighlightIfcItems();
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        }
    };

    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                try {
                    const model = await viewer.IFC.loadIfc(file, true);
                    loadedModels.clear();
                    loadedModels.set(model.modelID, { visible: true, name: file.name });
                    console.log(`✅ Sucesso no carregamento local: ${file.name}`);
                    viewer.context.fitToFrame([model.modelID]);
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
            }
        });
    }
});

// ----------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------

async function loadMultipleIfcs(urls) {
    console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);
    loadedModels.clear();
    const loadPromises = urls.map(async (url) => {
        try {
            const model = await viewer.IFC.loadIfcUrl(url, false);
            if (model?.modelID !== undefined) {
                loadedModels.set(model.modelID, { visible: true, name: url.split('/').pop() });
                console.log(`✅ Sucesso no carregamento: ${url}`);
                return model.modelID;
            }
            return null;
        } catch (e) {
            console.error(`❌ Erro ao carregar ${url}:`, e);
            return null;
        }
    });
    const loadedIDs = (await Promise.all(loadPromises)).filter(Boolean);
    if (loadedIDs.length > 0) {
        console.log(`🎉 ${loadedIDs.length}/${urls.length} modelo(s) carregados!`);
        viewer.context.fitToFrame(loadedIDs);
        updateVisibilityControls();
    } else console.warn("⚠️ Nenhum modelo IFC foi carregado.");
}

function showProperties(props, id) {
    const panel = document.getElementById('properties-panel');
    const details = document.getElementById('element-details');
    const title = document.getElementById('element-title');
    title.textContent = props.type ? `${props.type.value} [ID: ${id}]` : `Elemento [ID: ${id}]`;
    details.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'properties-table';
    if (props.GlobalId) addRow(table, 'GlobalId', props.GlobalId.value);
    if (props.Name) addRow(table, 'Name', props.Name.value);
    addHeader(table, 'Propriedades IFC');
    for (const key in props) {
        if (!['expressID', 'type', 'GlobalId', 'Name', 'properties'].includes(key)) {
            const prop = props[key];
            addRow(table, key, formatValue(prop));
        }
    }
    if (props.properties) {
        addHeader(table, 'Conjuntos de Propriedades (Psets)', true);
        for (const psetName in props.properties) {
            const pset = props.properties[psetName];
            addPsetHeader(table, psetName);
            for (const propName in pset) {
                const prop = pset[propName];
                addRow(table, propName, formatValue(prop));
            }
        }
    }
    details.appendChild(table);
    panel.style.display = 'block';
}

function formatValue(prop) {
    if (prop === undefined || prop === null) return 'N/A';
    if (prop.value !== undefined) return prop.value;
    if (prop.map) return `[${prop.map(p => formatValue(p)).join(', ')}]`;
    return prop.toString();
}

function addRow(table, key, value) {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
}

function addHeader(table, text, isSubHeader = false) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = isSubHeader ? '#ddd' : '#bbb';
    cell.style.paddingTop = '8px';
    cell.style.paddingBottom = '8px';
}

function addPsetHeader(table, text) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = '#ccc';
    cell.style.padding = '5px';
}

function createIfcTreeItem(modelID, name, isVisible) {
    const item = document.createElement('div');
    item.className = 'ifc-tree-item';
    item.dataset.modelId = modelID;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isVisible;
    checkbox.addEventListener('change', () => toggleModelVisibility(modelID, checkbox.checked));
    const label = document.createElement('label');
    label.textContent = name;
    item.appendChild(checkbox);
    item.appendChild(label);
    return item;
}

async function toggleModelVisibility(modelID, visible) {
    if (!viewer || modelID === undefined) return;
    const mesh = viewer.context.getScene().getMesh(modelID);
    if (mesh) mesh.visible = visible;
    const modelData = loadedModels.get(modelID);
    if (modelData) {
        modelData.visible = visible;
        loadedModels.set(modelID, modelData);
    }
}

function updateVisibilityControls() {
    const controlPanel = document.getElementById('visibility-controls');
    controlPanel.innerHTML = '';
    if (loadedModels.size === 0) {
        controlPanel.style.display = 'none';
        return;
    }
    const title = document.createElement('h4');
    title.textContent = '👁️ Modelos Carregados';
    controlPanel.appendChild(title);
    loadedModels.forEach((data, id) => {
        const item = createIfcTreeItem(id, data.name, data.visible);
        controlPanel.appendChild(item);
    });
    controlPanel.style.display = 'block';
}
