import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl;
let isMeasuring = false;
let xeokitContainer; // Definido para fácil acesso aos estilos e DOM

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

        // 1. Sincroniza posição e orientação
        xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
        xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
        xeokitViewer.camera.up = [threeJSCamera.up.x, threeJSCamera.up.y, threeJSCamera.up.z];
        
        // 2. Sincroniza parâmetros de projeção
        xeokitViewer.camera.projection = "perspective";
        xeokitViewer.camera.near = threeJSCamera.near;
        xeokitViewer.camera.far = threeJSCamera.far;
        xeokitViewer.camera.fovy = threeJSCamera.fov;

        // 3. Garante que o xeokit redesenhe
        xeokitViewer.scene.redraw();
    };

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");

            // ✅ SOLUÇÃO: Importa dinamicamente o módulo xeokit
            const xeokitSDK = await import('./wasm/xeokit-sdk.es.js');
            
            console.log("✅ xeokit SDK importado:", Object.keys(xeokitSDK).slice(0, 10).concat('...'));

            // 1. Cria o contêiner do Xeokit (se não existir, o que não deve acontecer)
            xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-container';
            xeokitContainer.style.position = 'absolute';
            xeokitContainer.style.top = '0';
            xeokitContainer.style.left = '0';
            xeokitContainer.style.width = '100%';
            xeokitContainer.style.height = '100%';
            xeokitContainer.style.pointerEvents = 'none'; 
            
            // 2. CORREÇÃO 1: Garante que o contêiner está anexado *antes* de inicializar o Viewer
            document.getElementById('viewer-container').appendChild(xeokitContainer);

            // 3. Inicializa o xeokit Viewer, passando o ID do elemento
            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: xeokitContainer.id, // O ID agora é garantidamente válido no DOM
                transparent: true, 
                sRGBOutput: true
            });

            // 4. Configura a sincronização da câmera do Three.js para o Xeokit
            const threeJSCamera = viewer.context.camera;
            const orbitControls = viewer.context.controls;

            // CRUCIAL: Sincroniza a câmera sempre que o controle (rotação, pan, zoom) for alterado.
            orbitControls.addEventListener('change', () => syncCameras(threeJSCamera, orbitControls, xeokitViewer));
            
            // Sincroniza a câmera na inicialização
            syncCameras(threeJSCamera, orbitControls, xeokitViewer);

            // 5. Inicializa o plugin de medições
            distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                fontFamily: "sans-serif",
                fontSize: "14px",
                scale: [1, 1, 1],
                labelColor: "black",
                labelBackgroundColor: "rgba(255, 255, 255, 0.7)" 
            });

            // 6. Adiciona o controle de mouse para medições de distância
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
            
            // 1. Desativa os controles padrão do three.js para que o xeokit possa capturar os cliques
            viewer.context.controls.enabled = false;
            
            // 2. Permite que o xeokit capture os eventos do mouse/toque
            xeokitContainer.style.pointerEvents = 'auto'; 

            // 3. Ativa o controle de medição do xeokit
            distanceMeasurementsControl.setActive(true);
            console.log("📏 Modo medição ativado");
        } else {
            startBtn.textContent = 'Iniciar Medição';
            startBtn.classList.remove('active');
            
            // 1. Reativa os controles padrão do three.js
            viewer.context.controls.enabled = true;
            
            // 2. Permite que o Three.js/IFC Viewer capture os eventos novamente
            xeokitContainer.style.pointerEvents = 'none'; 

            // 3. Desativa o controle de medição do xeokit
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
    
    // 🔥 CORREÇÃO 2: Garante que estamos passando o objeto de configuração correto
    const loadMultipleIfcs = async (ifcUrls) => {
        if (viewer && ifcUrls && ifcUrls.length > 0) {
            console.log(`🔄 Iniciando carregamento de ${ifcUrls.length} modelo(s)...`);
            
            for (const ifcUrl of ifcUrls) {
                console.log(`📦 Tentando carregar: ${ifcUrl}`);
                try {
                    // Prepara o objeto de configuração para o loadIfcUrl
                    const loadConfig = {
                        url: ifcUrl, 
                        wasmsPath: 'wasm/', 
                        caching: true, 
                        autoSetWasm: true 
                    };
                    
                    const model = await viewer.IFC.loadIfcUrl(loadConfig);
                    
                    if (model && model.modelID !== undefined) { 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: ifcUrl.split('/').pop(),
                            url: ifcUrl
                        });
                        console.log(`✅ Sucesso: ${ifcUrl.split('/').pop()} (ID: ${model.modelID})`);
                        
                        await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        console.log(`✅ Cache populado para o modelo: ${ifcUrl.split('/').pop()}`);
                    } else {
                        // Se model for null ou inválido, apenas emite o aviso.
                        console.warn(`⚠️ Aviso: O carregamento de ${ifcUrl} falhou, ignorando o modelo.`);
                    }
                } catch (error) {
                    // O erro de fetch 404 é capturado aqui
                    console.error(`❌ Erro fatal ao carregar o modelo ${ifcUrl}:`, error.message || error);
                }
            }
            console.log(`🎉 ${loadedModels.size}/${ifcUrls.length} modelo(s) carregados!`);
            updateVisibilityControls();
            
            if (loadedModels.size > 0) {
                viewer.context.fitToFrame(loadedModels.keys()); 
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
    
    // Inicializa o xeokit *após* o viewer principal
    initializeXeokitViewer().then(() => {
        // Vincula eventos dos botões de medição
        document.getElementById('start-measurement').onclick = toggleMeasurement;
        document.getElementById('clear-measurements').onclick = clearMeasurements;

        if (isMeasuring) {
             viewer.context.controls.enabled = false;
        }

        // Continua o carregamento dos modelos
        loadMultipleIfcs(IFC_MODELS_TO_LOAD).then(() => {
            console.log("🎉 Aplicação inicializada com sucesso!");
        });
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
                // Para arquivos locais, usamos a função de carregamento de arquivos nativa do web-ifc-viewer
                // Não é necessário usar loadMultipleIfcs (que é otimizada para URLs)
                try {
                    const model = await viewer.IFC.loadIfc(file, true); // true para limpar modelos existentes
                    
                    if (model && model.modelID !== undefined) {
                         // Limpa a lista de modelos existentes (já que loadIfc limpa o viewer)
                        loadedModels.clear(); 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        updateVisibilityControls();
                        viewer.context.fitToFrame([model.modelID]);
                    }
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
                document.getElementById('properties-panel').style.display = 'none';
                // O objeto URL.createObjectURL não é necessário aqui
            }
        });
    }

});
