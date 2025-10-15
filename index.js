import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES XEOKIT
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl = null;
let isMeasuring = false;
let xeokitContainer;

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

    // 🔥 FUNÇÃO PARA SINCRONIZAR CÂMERAS
    function syncCamerasToXeokit() {
        if (!viewer || !xeokitViewer || !xeokitViewer.camera) {
            return;
        }
        
        try {
            const scene = viewer.context.getScene();
            if (!scene || !scene.camera) {
                return;
            }

            const threeCamera = scene.camera;
            const threeControls = viewer.context.ifcCamera?.controls;
            
            if (!threeCamera || !threeControls) {
                return;
            }

            const threePos = threeCamera.position;
            const threeTarget = threeControls.target;

            if (!threePos || !threeTarget) {
                return;
            }

            // Sincroniza posição e lookAt
            xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
            xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
            
            // Sincroniza FOV
            if (threeCamera.fov) {
                xeokitViewer.camera.perspective.fov = threeCamera.fov;
            }
            
        } catch (syncError) {
            console.warn("⚠️ Erro na sincronização de câmera:", syncError);
        }
    }

    // 🔥 INICIALIZAR XEOKIT VIEWER (SEGUINDO A DOCUMENTAÇÃO OFICIAL)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            
            const xeokitSDK = window.xeokitSDK;
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                console.error("❌ xeokitSDK não disponível");
                return;
            }

            const viewerContainer = document.getElementById('viewer-container');
            if (!viewerContainer) {
                console.error("❌ Container principal não encontrado");
                return;
            }

            // ✅ CORREÇÃO: Cria o container do xeokit
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
                    z-index: 10;
                    pointer-events: none;
                    display: none;
                `;
                viewerContainer.appendChild(xeokitContainer);
                console.log("✅ xeokit-container criado e anexado.");
            }

            // ✅ CORREÇÃO: Cria o canvas
            let xeokitCanvas = document.getElementById('xeokit-canvas');
            if (!xeokitCanvas) {
                xeokitCanvas = document.createElement('canvas');
                xeokitCanvas.id = 'xeokit-canvas';
                
                xeokitCanvas.width = viewerContainer.clientWidth;
                xeokitCanvas.height = viewerContainer.clientHeight;
                
                xeokitCanvas.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: block;
                `;
                
                xeokitContainer.appendChild(xeokitCanvas);
                console.log("✅ Canvas criado com ID:", xeokitCanvas.id);
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const canvasElement = document.getElementById('xeokit-canvas');
            if (!canvasElement) {
                throw new Error("Canvas não foi encontrado no DOM após criação");
            }

            console.log("🎯 Canvas encontrado no DOM");

            // ✅ INICIALIZAÇÃO DO VIEWER XEOKIT (SEGUINDO A DOCUMENTAÇÃO)
            try {
                xeokitViewer = new xeokitSDK.Viewer({
                    canvasId: "xeokit-canvas",
                    transparent: true,
                    alpha: true,
                    premultipliedAlpha: false
                });
                console.log("✅ Viewer xeokit inicializado com sucesso");
            } catch (error) {
                console.error("❌ Erro ao inicializar viewer xeokit:", error);
                return;
            }

            // ✅ INICIALIZAÇÃO DO PLUGIN DE MEDIÇÕES (SEGUINDO EXEMPLO 2 DA DOC)
            try {
                const xeokitSDK = window.xeokitSDK;
                
                if (xeokitSDK.DistanceMeasurementsPlugin) {
                    // ✅ CORREÇÃO: Inicializa o plugin conforme documentação
                    distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                        pointSize: 8,
                        lineWidth: 3,
                        fontColor: "#FFFFFF",
                        labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
                        lineColor: "#FF0000"
                    });
                    console.log("✅ DistanceMeasurementsPlugin inicializado");
                    
                } else {
                    console.error("❌ DistanceMeasurementsPlugin não disponível no SDK");
                    distanceMeasurements = null;
                }
                
            } catch (pluginError) {
                console.error("❌ Erro no plugin de medições:", pluginError);
                distanceMeasurements = null;
            }

            // ✅ CONFIGURA SINCRONIZAÇÃO DE CÂMERA
            if (viewer && viewer.context) {
                // Sincronização contínua
                setInterval(() => {
                    syncCamerasToXeokit();
                }, 100);
                
                console.log("✅ Sincronização de câmera configurada.");
            }

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }

    // 🔥 FUNÇÃO PARA INICIALIZAR O CONTROLE DE MEDIÇÕES (SEGUINDO EXEMPLO 2)
    function initializeMeasurementsControl() {
        if (!distanceMeasurements || !xeokitViewer) {
            console.error("❌ Plugin ou viewer não disponível para inicializar controle");
            return null;
        }

        const xeokitSDK = window.xeokitSDK;
        
        try {
            // ✅ ABORDAGEM 1: Tenta DistanceMeasurementsMouseControl (EXEMPLO 2 DA DOC)
            if (xeokitSDK.DistanceMeasurementsMouseControl) {
                console.log("🔄 Inicializando DistanceMeasurementsMouseControl...");
                
                const control = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements, {
                    pointerLens: new xeokitSDK.PointerLens(xeokitViewer, {
                        active: true,
                        zoomFactor: 2
                    })
                });
                
                // ✅ CONFIGURAÇÕES RECOMENDADAS (EXEMPLO 2)
                control.snapToVertex = true;
                control.snapToEdge = true;
                
                console.log("✅ DistanceMeasurementsMouseControl inicializado com sucesso");
                return control;
            }
            
            // ✅ ABORDAGEM 2: Tenta DistanceMeasurementsControl (fallback)
            else if (xeokitSDK.DistanceMeasurementsControl) {
                console.log("🔄 Inicializando DistanceMeasurementsControl (fallback)...");
                
                const control = new xeokitSDK.DistanceMeasurementsControl(distanceMeasurements, {
                    pointerLens: new xeokitSDK.PointerLens(xeokitViewer, {
                        active: true,
                        zoomFactor: 2
                    })
                });
                
                console.log("✅ DistanceMeasurementsControl inicializado com sucesso");
                return control;
            }
            else {
                console.error("❌ Nenhum controle de medições disponível no SDK");
                return null;
            }
            
        } catch (controlError) {
            console.error("❌ Erro ao inicializar controle de medições:", controlError);
            return null;
        }
    }

    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO (SEGUINDO EXEMPLO 2)
    function toggleMeasurement() {
        isMeasuring = !isMeasuring;
        const button = document.getElementById('start-measurement');
        
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não inicializado.");
            isMeasuring = false;
            return;
        }

        if (!distanceMeasurements) {
            console.error("❌ distanceMeasurements não inicializado.");
            isMeasuring = false;
            return;
        }

        // ✅ INICIALIZA O CONTROLE SE NECESSÁRIO
        if (!distanceMeasurementsControl) {
            distanceMeasurementsControl = initializeMeasurementsControl();
            
            if (!distanceMeasurementsControl) {
                console.error("❌ Não foi possível inicializar o controle de medições");
                isMeasuring = false;
                return;
            }
        }

        if (isMeasuring) {
            button.textContent = 'Parar Medição';
            button.classList.add('active');
            
            // Torna o xeokit visível e interativo
            xeokitContainer.style.pointerEvents = 'all';
            xeokitContainer.style.display = 'block';
            
            try {
                // ✅ ATIVA O CONTROLE (SEGUINDO EXEMPLO 2)
                if (typeof distanceMeasurementsControl.activate === 'function') {
                    distanceMeasurementsControl.activate();
                    console.log("▶️ DistanceMeasurementsMouseControl ATIVADO");
                    
                    // ✅ ADICIONA EVENT LISTENERS (EXEMPLO 4 DA DOC)
                    setupMeasurementEvents();
                    
                } else {
                    console.error("❌ Método activate não disponível no controle");
                    throw new Error("Controle não suporta ativação");
                }
                
            } catch (activateError) {
                console.error("❌ Erro ao ativar medições:", activateError);
                isMeasuring = false;
                button.textContent = 'Iniciar Medição';
                button.classList.remove('active');
                xeokitContainer.style.pointerEvents = 'none';
                xeokitContainer.style.display = 'none';
            }

        } else {
            button.textContent = 'Iniciar Medição';
            button.classList.remove('active');
            
            // Torna o xeokit invisível e não interativo
            xeokitContainer.style.pointerEvents = 'none';
            xeokitContainer.style.display = 'none';

            try {
                // ✅ DESATIVA O CONTROLE
                if (typeof distanceMeasurementsControl.deactivate === 'function') {
                    distanceMeasurementsControl.deactivate();
                    console.log("⏸️ DistanceMeasurementsMouseControl DESATIVADO");
                }
                
                // Remove event listeners
                removeMeasurementEvents();
                
            } catch (deactivateError) {
                console.error("❌ Erro ao desativar medições:", deactivateError);
            }
        }
    }

    // 🔥 CONFIGURA EVENTOS DAS MEDIÇÕES (SEGUINDO EXEMPLO 4 DA DOC)
    function setupMeasurementEvents() {
        if (!distanceMeasurements) return;

        // Evento quando o mouse passa sobre uma medição
        distanceMeasurements.on("mouseOver", (e) => {
            console.log("🖱️ Mouse sobre medição:", e.measurement.id);
            if (e.measurement && typeof e.measurement.setHighlighted === 'function') {
                e.measurement.setHighlighted(true);
            }
        });

        // Evento quando o mouse sai de uma medição
        distanceMeasurements.on("mouseLeave", (e) => {
            console.log("🖱️ Mouse saiu da medição:", e.measurement.id);
            if (e.measurement && typeof e.measurement.setHighlighted === 'function') {
                e.measurement.setHighlighted(false);
            }
        });

        // Evento de clique com botão direito na medição
        distanceMeasurements.on("contextMenu", (e) => {
            console.log("📋 Context menu na medição:", e.measurement.id);
            e.event.preventDefault();
            // Aqui você pode mostrar um menu contextual personalizado
        });

        // Evento quando uma medição é criada
        distanceMeasurements.on("created", (e) => {
            console.log("📏 Medição criada:", e.measurement.id);
        });

        // Evento quando uma medição é destruída
        distanceMeasurements.on("destroyed", (e) => {
            console.log("🗑️ Medição destruída:", e.measurement.id);
        });

        console.log("✅ Event listeners de medições configurados");
    }

    // 🔥 REMOVE EVENT LISTENERS
    function removeMeasurementEvents() {
        if (!distanceMeasurements) return;
        
        // Remove todos os event listeners
        distanceMeasurements.off("mouseOver");
        distanceMeasurements.off("mouseLeave");
        distanceMeasurements.off("contextMenu");
        distanceMeasurements.off("created");
        distanceMeasurements.off("destroyed");
        
        console.log("✅ Event listeners de medições removidos");
    }

    // ----------------------------------
    // CONFIGURAÇÃO INICIAL
    // ----------------------------------
    
    // 1. Cria o Viewer (web-ifc-viewer)
    viewer = CreateViewer(container);
    
    // 2. Inicializa o Viewer (web-ifc-viewer)
    viewer.IFC.setWasmPath('wasm/');
    viewer.IFC.loader.ifcManager.applyWebIfcConfig({
        COORDINATE_TO_ORIGIN: true,
        USE_FAST_BOOLS: true
    });
    
    // 3. Inicializa o xeokit viewer (para medições)
    initializeXeokitViewer();

    // 4. Carrega os modelos IFC
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    // 5. Configura Listeners de eventos
    
    // Listener de clique para Medição
    document.getElementById('start-measurement').addEventListener('click', () => {
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não está disponível");
            alert("Sistema de medições não está disponível. Recarregue a página.");
            return;
        }
        
        if (!distanceMeasurements) {
            console.error("❌ Plugin de medições não está disponível");
            alert("Plugin de medições não carregado.");
            return;
        }
        
        toggleMeasurement();
    });

    // Listener de clique para Limpar Medições
    document.getElementById('clear-measurements').addEventListener('click', () => {
        if (distanceMeasurements && typeof distanceMeasurements.clear === 'function') {
            distanceMeasurements.clear();
            console.log("🗑️ Todas as medições foram limpas.");
        } else {
            console.error("❌ Método clear não disponível no plugin");
        }
    });

    // Listener de clique para Seleção (web-ifc-viewer) - DESABILITADO NO MODO MEDIÇÃO
    container.ondblclick = async (event) => {
        // Se estiver no modo de medição, ignora a seleção do web-ifc-viewer
        if (isMeasuring) {
            console.log("📏 Modo de medição ativo - seleção do IFC ignorada");
            return;
        }

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
    
    // UPLOAD DE ARQUIVO LOCAL
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                try {
                    const model = await viewer.IFC.loadIfc(file, true);
                    
                    if (model && model.modelID !== undefined) {
                        loadedModels.clear(); 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        
                        if (viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                            await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        }
                        
                        updateVisibilityControls();
                        viewer.context.fitToFrame([model.modelID]);
                    }
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
                document.getElementById('properties-panel').style.display = 'none';
            }
        });
    }

});

// ----------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------

// 🔥 Carrega múltiplos arquivos IFC de URLs
async function loadMultipleIfcs(urls) {
    console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);
    
    loadedModels.clear();

    const loadPromises = urls.map(async (url, index) => {
        console.log(`📦 Tentando carregar: ${url}`);
        try {
            const model = await viewer.IFC.loadIfcUrl(url, false);
            
            if (model && model.modelID !== undefined) {
                loadedModels.set(model.modelID, {
                    visible: true,
                    name: url.split('/').pop(),
                    url: url
                });
                console.log(`✅ Sucesso no carregamento: ${url} (ID: ${model.modelID})`);
                return model.modelID;
            }
            return null;

        } catch (e) {
            console.error(`❌ Erro ao carregar ${url}:`, e);
            return null;
        }
    });

    const loadedIDs = (await Promise.all(loadPromises)).filter(id => id !== null);

    if (loadedIDs.length > 0) {
        console.log(`🎉 ${loadedIDs.length}/${urls.length} modelo(s) carregados!`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            if (viewer.IFC && typeof viewer.IFC.loader.ifcManager.getSpatialStructure === 'function') {
                console.log("🔄 Construindo estrutura espacial via getSpatialStructure...");
                for (const modelID of loadedIDs) {
                    await viewer.IFC.loader.ifcManager.getSpatialStructure(modelID);
                }
                console.log("✅ Estrutura espacial construída via getSpatialStructure.");
            }
            else if (viewer.IFC && viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                console.log("🔄 Construindo estrutura espacial via spatialStructure.build...");
                const structurePromises = loadedIDs.map(id => 
                    viewer.IFC.loader.ifcManager.get.spatialStructure.build(id)
                );
                await Promise.all(structurePromises);
                console.log("✅ Estrutura espacial construída via spatialStructure.build.");
            }
        } catch (error) {
            console.warn("⚠️ Estrutura espacial não pôde ser construída:", error.message);
        }

        viewer.context.fitToFrame(loadedIDs); 
        updateVisibilityControls();

    } else {
        console.warn("⚠️ Nenhum modelo IFC foi carregado com sucesso.");
    }
}

// 🔥 Mostra as propriedades de um elemento
function showProperties(props, id) {
    const propertiesPanel = document.getElementById('properties-panel');
    const detailsContainer = document.getElementById('element-details');
    const titleElement = document.getElementById('element-title');

    titleElement.textContent = props.type ? `${props.type.value} [ID: ${id}]` : `Elemento [ID: ${id}]`;
    detailsContainer.innerHTML = '';
    
    const propTable = document.createElement('table');
    propTable.className = 'properties-table';

    if (props.GlobalId) addRow(propTable, 'GlobalId', props.GlobalId.value);
    if (props.Name) addRow(propTable, 'Name', props.Name.value);
    
    addHeader(propTable, 'Propriedades IFC');
    
    for (const key in props) {
        if (key !== 'expressID' && key !== 'type' && key !== 'GlobalId' && key !== 'Name' && key !== 'properties') {
            const prop = props[key];
            const value = formatValue(prop);
            addRow(propTable, key, value);
        }
    }
    
    if (props.properties) {
        addHeader(propTable, 'Conjuntos de Propriedades (Psets)', true);
        
        for (const psetName in props.properties) {
            const pset = props.properties[psetName];
            addPsetHeader(propTable, psetName);
            
            for (const propName in pset) {
                const prop = pset[propName];
                const value = formatValue(prop);
                addRow(propTable, propName, value);
            }
        }
    }

    detailsContainer.appendChild(propTable);
    propertiesPanel.style.display = 'block';
}

// 🔥 Helper para formatar o valor da propriedade
function formatValue(prop) {
    if (prop === undefined || prop === null) return 'N/A';
    if (prop.value !== undefined) {
        return prop.value;
    }
    if (prop.map) {
        return `[${prop.map(p => formatValue(p)).join(', ')}]`;
    }
    return prop.toString();
}

// 🔥 Helper para adicionar linha na tabela de propriedades
function addRow(table, key, value) {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
}

// 🔥 Helper para adicionar cabeçalho na tabela de propriedades
function addHeader(table, text, isSubHeader = false) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = isSubHeader ? '#ddd' : '#bbb';
    cell.style.marginTop = isSubHeader ? '10px' : '0';
    cell.style.paddingTop = '8px';
    cell.style.paddingBottom = '8px';
}

// 🔥 Helper para adicionar cabeçalho Pset
function addPsetHeader(table, text) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = '#ccc';
    cell.style.padding = '5px';
    cell.style.marginTop = '5px';
}

// 🔥 Cria o item de controle de visibilidade
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

// 🔥 Alterna a visibilidade do modelo
async function toggleModelVisibility(modelID, visible) {
    if (!viewer || modelID === undefined) return;

    if (visible) {
        viewer.context.getScene().getMesh(modelID).visible = true;
    } else {
        viewer.context.getScene().getMesh(modelID).visible = false;
    }
    
    const modelData = loadedModels.get(modelID);
    if (modelData) {
        modelData.visible = visible;
        loadedModels.set(modelID, modelData);
    }
}

// 🔥 Atualiza o painel de controle de visibilidade
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