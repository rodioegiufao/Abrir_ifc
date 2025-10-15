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

    // 🔥 FUNÇÃO PARA SINCRONIZAR CÂMERAS (Fundamental para manter os dois viewers alinhados)
    const syncCameras = (threeJSCamera, orbitControls, xeokitViewer) => {
        if (!xeokitViewer || !xeokitViewer.camera) return;

        const threePos = threeJSCamera.position;
        const threeTarget = orbitControls.target;

        // 1. Sincroniza posição e orientação
        xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
        xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
        xeokitViewer.camera.up = [0, 0, 1]; // Assume que o Up-axis do IFC é Z
        
        // 2. Sincroniza projeção
        if (threeJSCamera.isPerspectiveCamera) {
            xeokitViewer.camera.projection = "perspective";
        } else {
             xeokitViewer.camera.projection = "perspective";
        }
    };

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES (VERSÃO CORRIGIDA)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            
            // CORREÇÃO ESSENCIAL: Cria o wrapper DIV e o elemento CANVAS para o xeokit
            xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-wrapper';
            xeokitContainer.style.position = 'absolute';
            xeokitContainer.style.top = '0';
            xeokitContainer.style.left = '0';
            xeokitContainer.style.width = '100%';
            xeokitContainer.style.height = '100%';
            xeokitContainer.style.pointerEvents = 'none'; // Importante para permitir cliques no IFC.js por padrão
            container.appendChild(xeokitContainer);
            
            // Cria o CANVAS real que o xeokit precisa
            const xeokitCanvas = document.createElement('canvas');
            const canvasId = 'xeokit-canvas';
            xeokitCanvas.id = canvasId;
            xeokitCanvas.style.width = '100%';
            xeokitCanvas.style.height = '100%';
            xeokitContainer.appendChild(xeokitCanvas);


            // Importa o xeokit (disponível globalmente devido ao index.html)
            // NOTA: Removemos DistanceMeasurement da desestruturação para evitar o TypeError
            const { Viewer, DistanceMeasurementsPlugin } = window.xeokitSDK;

            // O construtor agora recebe o ID do CANVAS
            xeokitViewer = new Viewer({
                canvasId: canvasId, 
                transparent: true, 
                backgroundColor: [0, 0, 0, 0], 
                sao: false,
                pbr: false
            });

            // Plugin de Medições
            distanceMeasurements = new DistanceMeasurementsPlugin(xeokitViewer, {});

            // CORREÇÃO: Cria a medição usando o método createMeasurement() do plugin
            distanceMeasurementsControl = distanceMeasurements.createMeasurement();
            distanceMeasurementsControl.visible = false; // Começa invisível

            console.log("✅ xeokit viewer inicializado com sucesso.");

            // Adiciona listener de sincronização da câmera (Three.js -> xeokit)
            viewer.context.renderer.onBeforeRender = () => {
                // Checa se os controles da câmera estão prontos antes de tentar acessá-los
                const orbitControls = viewer.context.ifcCamera.getCameraControls();
                if (orbitControls) {
                    syncCameras(viewer.context.camera, orbitControls, xeokitViewer);
                }
            };

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }

    // 🔥 FUNÇÃO PARA CARREGAR MODELOS IFC MULTIPLOS (para URLs estáticas)
    async function loadMultipleIfcs(urls) {
        let loadedCount = 0;
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);

        loadedModels.clear(); 
        document.getElementById('visibility-controls').innerHTML = '';

        for (const url of urls) {
            if (typeof url !== 'string') {
                console.error("❌ Erro de carregamento: URL inválida (não é uma string):", url);
                continue; 
            }

            console.log(`📦 Tentando carregar: ${url}`);
            try {
                // O web-ifc-viewer precisa de um URL ou de um objeto File
                const model = await viewer.IFC.loadIfcUrl(url, true); 
                
                if (model && model.modelID !== undefined) {
                    const name = url.split('/').pop();
                    loadedModels.set(model.modelID, { visible: true, name, url });
                    
                    loadedCount++;
                    console.log(`✅ Sucesso no carregamento: ${name} (ID: ${model.modelID})`);
                } else {
                     console.warn(`⚠️ Modelo IFC carregado, mas sem ID válido: ${url}`);
                }

            } catch (e) {
                console.error("❌ Erro ao carregar IFC.", e);
            }
        }
        
        console.log(`🎉 ${loadedCount}/${urls.length} modelo(s) carregados!`);
        updateVisibilityControls();

        if (loadedCount > 0) {
            viewer.context.fitToFrame(Array.from(loadedModels.keys()));
        }
    }

    // 🔥 FUNÇÃO PARA EXIBIR PROPRIEDADES 
    function showProperties(props, id) {
        const panel = document.getElementById('properties-panel');
        const details = document.getElementById('element-details');
        const title = document.getElementById('element-title');

        if (!props) {
            title.textContent = "Nenhuma propriedade encontrada";
            details.innerHTML = '';
            panel.style.display = 'block';
            return;
        }

        title.textContent = props.type ? `${props.type} (ID: ${id})` : `Elemento IFC (ID: ${id})`;
        details.innerHTML = ''; 

        const formatValue = (value) => {
            if (typeof value === 'object' && value !== null && value.value) {
                return formatValue(value.value); 
            }
            if (typeof value === 'object' && value !== null) {
                return `<pre>${JSON.stringify(value, null, 2)}</pre>`;
            }
            return value;
        };

        const createPropertyItem = (key, value) => {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `<span class="property-key">${key}:</span> <span class="property-value">${formatValue(value)}</span>`;
            return div;
        };
        
        // Adiciona as propriedades diretas (como GlobalId)
        for (const key in props) {
            if (key !== 'expressID' && key !== 'type' && key !== 'pset') {
                details.appendChild(createPropertyItem(key, props[key]));
            }
        }

        // Adiciona Psets (Propriedades de Conjunto)
        if (props.hasPsets && props.psets) {
            props.psets.forEach(pset => {
                const psetHeader = document.createElement('h5');
                psetHeader.className = 'pset-header';
                psetHeader.textContent = `Conjunto de Propriedades: ${pset.Name?.value || 'Sem Nome'}`;
                details.appendChild(psetHeader);

                if (pset.properties) {
                    pset.properties.forEach(prop => {
                        details.appendChild(createPropertyItem(prop.Name?.value || 'Propriedade', prop.NominalValue?.value || 'N/A'));
                    });
                }
            });
        }

        panel.style.display = 'block';
    }


    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO
    function toggleMeasurement() {
        const btn = document.getElementById('start-measurement');

        isMeasuring = !isMeasuring;

        if (isMeasuring) {
            // ATIVA
            btn.textContent = 'Parar Medição (ESC)';
            btn.classList.add('active');
            
            // O xeokit container precisa aceitar eventos do mouse no modo de medição
            if (xeokitContainer) xeokitContainer.style.pointerEvents = 'auto'; 
            
            if (distanceMeasurementsControl) {
                distanceMeasurementsControl.visible = true;
                distanceMeasurementsControl.plotting = true;
            }
            console.log("📏 Modo de medição ATIVADO (xeokit). Clique nos vértices.");
        } else {
            // DESATIVA
            btn.textContent = 'Iniciar Medição';
            btn.classList.remove('active');
            
            // O xeokit container deve ignorar eventos do mouse fora do modo de medição
            if (xeokitContainer) xeokitContainer.style.pointerEvents = 'none'; 

            if (distanceMeasurementsControl) {
                distanceMeasurementsControl.plotting = false; // Para de desenhar
            }
            console.log("📏 Modo de medição DESATIVADO.");
        }
    }

    // 🔥 FUNÇÃO PARA CRIAR CONTROLES DE VISIBILIDADE DOS MODELOS 
    function updateVisibilityControls() {
        const controlsDiv = document.getElementById('visibility-controls');
        const modelKeys = Array.from(loadedModels.keys());

        if (modelKeys.length === 0) {
            controlsDiv.style.display = 'none';
            return;
        }

        controlsDiv.style.display = 'block';
        controlsDiv.innerHTML = '<h4>👁️ Modelos Carregados</h4>';

        loadedModels.forEach((model, modelID) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'model-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `model-toggle-${modelID}`;
            checkbox.checked = model.visible;
            checkbox.onchange = () => {
                const isVisible = checkbox.checked;
                viewer.IFC.loader.ifcManager.setVisibility(modelID, isVisible);
                model.visible = isVisible;
                loadedModels.set(modelID, model);
            };

            const label = document.createElement('label');
            label.htmlFor = `model-toggle-${modelID}`;
            label.textContent = model.name;

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            controlsDiv.appendChild(itemDiv);
        });
    }

    // ============== INICIALIZAÇÃO PRINCIPAL ==============
    viewer = CreateViewer(container);
    
    // Configura eventos de botão
    const startBtn = document.getElementById('start-measurement');
    const clearBtn = document.getElementById('clear-measurements');

    if (startBtn) {
        startBtn.onclick = toggleMeasurement;
    }
    if (clearBtn) {
        // Limpa todas as medições visuais na cena do xeokit
        clearBtn.onclick = () => {
            if (distanceMeasurements) {
                distanceMeasurements.clear();
            }
            console.log("Medições limpas.");
        };
    }

    // Carrega os modelos IFC iniciais e inicializa o xeokit
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);
    // Chama o inicializador do xeokit APÓS o THREE.js para que ele se sobreponha
    initializeXeokitViewer();

    console.log("🎉 Aplicação inicializada com sucesso!");

    // ============== EVENTOS DE INTERAÇÃO COM O USUÁRIO ==============
    
    // EVENTO DE DUPLO CLIQUE (Para Seleção/Propriedades)
    window.ondblclick = async () => {
        // Ignora a seleção se estiver no modo de medição
        if (isMeasuring) return; 

        // Tenta selecionar o elemento no web-ifc-viewer
        const result = await viewer.IFC.selector.pickIfcItem(true); 

        if (!result || !result.modelID || result.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.modelID, result.id, false);
        
        // O parâmetro 'true' (pesquisa profunda/recursiva) funciona agora que forçamos o cache.
        const props = await viewer.IFC.getProperties(result.modelID, result.id, true);
        
        lastProps = props; 
        console.log("🟩 Item selecionado:", lastProps);
        
        showProperties(props, result.id);
    };

    // EVENTO DE TECLA (ESC)
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
