import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl;
let isMeasuring = false;
// Declaração de xeokitContainer como variável de escopo mais alto
let xeokitContainer; 

// ✅ LISTA DE ARQUIVOS IFC 
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

// 🔥 CONTROLE DE VISIBILIDADE
let loadedModels = new Map(); // Map<modelID, { visible: boolean, name: string, url: string }>

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
    const syncCameras = (threeJSCamera, orbitControls, xeokitViewer) => {
        if (!xeokitViewer || !xeokitViewer.camera) return;

        const threePos = threeJSCamera.position;
        const threeTarget = orbitControls.target;

        xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
        xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
        xeokitViewer.camera.up = [threeJSCamera.up.x, threeJSCamera.up.y, threeJSCamera.up.z];
        
        xeokitViewer.camera.projection = "perspective";
        xeokitViewer.camera.near = threeJSCamera.near;
        xeokitViewer.camera.far = threeJSCamera.far;
        xeokitViewer.camera.fovy = threeJSCamera.fov;

        xeokitViewer.scene.redraw();
    };

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES
    function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");

            // 1. CRIAÇÃO E ANEXAÇÃO DO CONTÊINER XEOKIT
            // O xeokitContainer é criado aqui, garantindo que ele exista antes de tentar inicializar o Viewer
            xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-container';
            xeokitContainer.style.position = 'absolute';
            xeokitContainer.style.top = '0';
            xeokitContainer.style.left = '0';
            xeokitContainer.style.width = '100%';
            xeokitContainer.style.height = '100%';
            xeokitContainer.style.pointerEvents = 'none'; // Inicialmente desativado
            
            // O container Three.js/IFC Viewer é o pai
            document.getElementById('viewer-container').appendChild(xeokitContainer);

            // CORREÇÃO 1: Usa a variável global 'xeokitSDK' (importada no index.html)
            if (typeof window.xeokitSDK === 'undefined') {
                 throw new Error("xeokit SDK not found on window.xeokitSDK. Check index.html import.");
            }
            const xeokitSDK = window.xeokitSDK;

            // 2. Inicializa o xeokit Viewer, usando o ID do elemento agora garantido no DOM
            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: xeokitContainer.id, 
                transparent: true, 
                sRGBOutput: true
            });
            
            // 3. Configura a sincronização da câmera do Three.js para o Xeokit
            const threeJSCamera = viewer.context.camera;
            const orbitControls = viewer.context.controls;

            orbitControls.addEventListener('change', () => syncCameras(threeJSCamera, orbitControls, xeokitViewer));
            
            syncCameras(threeJSCamera, orbitControls, xeokitViewer);

            // 4. Inicializa o plugin de medições
            distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                fontFamily: "sans-serif",
                fontSize: "14px",
                scale: [1, 1, 1],
                labelColor: "black",
                labelBackgroundColor: "rgba(255, 255, 255, 0.7)" 
            });

            // 5. Adiciona o controle de mouse para medições de distância
            distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements);

            console.log("✅ Plugin de medições xeokit inicializado com sucesso");
            
        } catch (error) {
            console.error("❌ Erro ao inicializar xeokit viewer:", error.message || error);
            const startBtn = document.getElementById('start-measurement');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'Erro de Medição';
            }
        }
    }


    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO
    const toggleMeasurement = () => {
        if (!distanceMeasurementsControl || !xeokitContainer) return;

        isMeasuring = !isMeasuring;
        const startBtn = document.getElementById('start-measurement');
        
        if (isMeasuring) {
            startBtn.textContent = 'Parar Medição';
            startBtn.classList.add('active');
            
            viewer.context.controls.enabled = false;
            xeokitContainer.style.pointerEvents = 'auto'; 
            distanceMeasurementsControl.setActive(true);
            
            console.log("📏 Modo medição ativado");
        } else {
            startBtn.textContent = 'Iniciar Medição';
            startBtn.classList.remove('active');
            
            viewer.context.controls.enabled = true;
            xeokitContainer.style.pointerEvents = 'none'; 
            distanceMeasurementsControl.setActive(false);
            
            console.log("🚫 Modo medição desativado");
        }
        
        if (xeokitViewer) xeokitViewer.scene.redraw();
    };

    // 🔥 FUNÇÃO PARA LIMPAR AS MEDIÇÕES
    const clearMeasurements = () => {
        if (distanceMeasurements) {
            distanceMeasurements.clear();
            if (xeokitViewer) xeokitViewer.scene.redraw();
        }
    };

    // -----------------------------------------------------------
    // FUNÇÕES DE SUPORTE
    // -----------------------------------------------------------
    
    // 🔥 CORREÇÃO 2: Garante que estamos passando o objeto de configuração **apenas com a URL**
    const loadMultipleIfcs = async (ifcUrls) => {
        if (viewer && ifcUrls && ifcUrls.length > 0) {
            console.log(`🔄 Iniciando carregamento de ${ifcUrls.length} modelo(s)...`);
            
            // Limpa modelos existentes (se houver, e não for um carregamento local)
            if (loadedModels.size > 0 && ifcUrls.some(url => url.startsWith('models/'))) {
                 viewer.IFC.loader.ifcManager.dispose();
                 loadedModels.clear();
                 document.getElementById('visibility-controls').innerHTML = '';
            }

            let successfulLoads = 0;

            for (const ifcUrl of ifcUrls) {
                console.log(`📦 Tentando carregar: ${ifcUrl}`);
                try {
                    // Prepara o objeto de configuração: SOMENTE a URL é garantida
                    // Os paths WASM são definidos globalmente na inicialização do viewer.
                    const loadConfig = {
                        url: ifcUrl,
                        // Removida a configuração redundante de paths WASM que poderia causar problemas
                    };
                    
                    const model = await viewer.IFC.loadIfcUrl(loadConfig);
                    
                    if (model && model.modelID !== undefined) { 
                        // Verifica se o modelo já existe (para evitar duplicidade em uploads locais)
                        if (!loadedModels.has(model.modelID)) {
                            loadedModels.set(model.modelID, {
                                visible: true,
                                name: ifcUrl.split('/').pop().split('\\').pop(), // Manipulação de paths
                                url: ifcUrl
                            });
                            successfulLoads++;
                            
                            console.log(`✅ Sucesso: ${loadedModels.get(model.modelID).name} (ID: ${model.modelID})`);
                            
                            // Popula o cache
                            await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                            console.log(`✅ Cache populado para o modelo: ${loadedModels.get(model.modelID).name}`);
                        }
                    }
                } catch (error) {
                    // O erro de fetch 404/ [object Object] é capturado aqui
                    console.error(`❌ Erro fatal ao carregar o modelo ${ifcUrl}:`, error.message || error);
                }
            }
            console.log(`🎉 ${successfulLoads}/${ifcUrls.length} modelo(s) carregados!`);
            updateVisibilityControls();
            
            if (successfulLoads > 0) {
                viewer.context.fitToFrame(Array.from(loadedModels.keys())); 
            }
        }
    };


    function updateVisibilityControls() {
        const controlsDiv = document.getElementById('visibility-controls');
        controlsDiv.style.display = 'block';
        controlsDiv.innerHTML = '<h4>👁️ Visibilidade dos Modelos</h4>';

        loadedModels.forEach((model, modelID) => {
            const container = document.createElement('div');
            container.className = 'model-control-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `model-toggle-${modelID}`;
            checkbox.checked = model.visible;
            checkbox.onchange = () => toggleModelVisibility(modelID, checkbox.checked);

            const label = document.createElement('label');
            label.htmlFor = `model-toggle-${modelID}`;
            label.textContent = model.name;

            container.appendChild(checkbox);
            container.appendChild(label);
            controlsDiv.appendChild(container);
        });
    }

    function toggleModelVisibility(modelID, visible) {
        const modelData = loadedModels.get(modelID);
        if (!modelData) return;

        modelData.visible = visible;
        loadedModels.set(modelID, modelData);

        viewer.IFC.loader.ifcManager.setVisibility(modelID, visible);
    }

    function showProperties(props, id) {
        const panel = document.getElementById('properties-panel');
        const details = document.getElementById('element-details');
        
        document.getElementById('element-title').textContent = `ID ${id}: ${props.type || 'Elemento'}`;
        details.innerHTML = ''; 

        const createPropertyTable = (properties, container) => {
            const table = document.createElement('table');
            table.className = 'props-table';
            
            for (const key in properties) {
                if (key === 'expressID' || key === 'type') continue;
                
                const value = properties[key];
                const tr = document.createElement('tr');
                
                const th = document.createElement('th');
                th.textContent = key;
                tr.appendChild(th);
                
                const td = document.createElement('td');
                
                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        td.textContent = `[${value.length} Itens]`;
                        
                        value.forEach(item => {
                            if (item.Name) {
                                const subSection = document.createElement('details');
                                const summary = document.createElement('summary');
                                summary.textContent = item.Name;
                                subSection.appendChild(summary);
                                if (item.properties) {
                                    createPropertyTable(item.properties, subSection);
                                }
                                container.appendChild(subSection);
                            }
                        });
                        
                        tr.remove(); 
                    } else if (value.value !== undefined) {
                        td.textContent = value.value;
                    } else {
                        const subSection = document.createElement('details');
                        const summary = document.createElement('summary');
                        summary.textContent = value.Name || key;
                        subSection.appendChild(summary);
                         if (value.properties) {
                            createPropertyTable(value.properties, subSection);
                        } else {
                             createPropertyTable(value, subSection);
                        }
                        container.appendChild(subSection);
                        
                        tr.remove(); 
                    }
                } else {
                    td.textContent = value;
                }
                
                if (tr.parentElement) {
                    tr.appendChild(td);
                    table.appendChild(tr);
                }
            }
            if (table.rows.length > 0) {
                container.appendChild(table);
            }
        };

        createPropertyTable(props, details);
        panel.style.display = 'block';
    }


    // -----------------------------------------------------------
    // INICIALIZAÇÃO
    // -----------------------------------------------------------
    viewer = CreateViewer(container);

    // CRUCIAL: Inicializa o xeokit *imediatamente* para garantir que o elemento exista
    initializeXeokitViewer();
    
    // Vincula eventos dos botões de medição
    document.getElementById('start-measurement').onclick = toggleMeasurement;
    document.getElementById('clear-measurements').onclick = clearMeasurements;

    // Inicia o carregamento dos modelos de servidor
    loadMultipleIfcs(IFC_MODELS_TO_LOAD).then(() => {
        console.log("🎉 Aplicação inicializada com sucesso!");
    });
    
    // CLIQUE PARA SELEÇÃO DE PROPRIEDADES (apenas se a medição estiver desativada)
    window.ondblclick = async () => {
        if (isMeasuring) return; 

        const result = await viewer.IFC.selector.pickIfcItem(true);
        if (!result) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.object, false);
        
        const props = await viewer.IFC.getProperties(result.modelID, result.id, true);
        
        lastProps = props; 
        console.log("🟩 Item selecionado:", lastProps);
        
        showProperties(props, result.id);
    };

    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
             // Se estiver no modo de medição, a primeira tecla ESC deve desativá-lo
            if (isMeasuring) {
                toggleMeasurement();
                return;
            }
             // Se não estiver medindo, limpa a seleção
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
                 // Limpa modelos existentes, pois o loadIfc fará isso internamente
                viewer.IFC.loader.ifcManager.dispose();
                loadedModels.clear(); 
                document.getElementById('visibility-controls').innerHTML = ''; // Limpa os controles
                
                try {
                    // Carrega arquivo local
                    const model = await viewer.IFC.loadIfc(file); 
                    
                    if (model && model.modelID !== undefined) {
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        updateVisibilityControls();
                        viewer.context.fitToFrame(Array.from(loadedModels.keys()));
                    }
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
                document.getElementById('properties-panel').style.display = 'none';
            }
        });
    }

});
