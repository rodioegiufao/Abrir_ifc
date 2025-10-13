import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three';

// Variáveis globais
let scene, renderer, camera, controls, ifcLoader;
let currentModel = null;
let currentModelID = null;

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('viewer-container');
    
    // 1. INICIALIZAÇÃO DA CENA THREE.JS
    initScene(container);
    
    // 2. INICIALIZA IFC LOADER
    await initIFCLoader();
    
    // 3. CARREGA O MODELO IFC
    await loadIFCModel('models/01.ifc');
    
    // 4. CONFIGURA SELEÇÃO
    setupSelection();
    
    // 5. INICIA ANIMAÇÃO
    animate();
    
    // 6. DEBUG: Mostra informações do modelo no console
    setTimeout(() => {
        console.log('🔍 Modelo carregado, use debugIFC no console para explorar:');
        console.log('- debugIFC.getModelInfo() - Estrutura completa');
        console.log('- debugIFC.getElementsByType() - Estatísticas');
        console.log('- debugIFC.getCurrentModelID() - ID do modelo');
    }, 2000);
});

// =============================================
// 1. INICIALIZAÇÃO DA CENA
// =============================================
function initScene(container) {
    // Cria a cena
    scene = new Scene();
    scene.background = new Color(0xeeeeee);
    
    // Cria a câmera
    camera = new PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(50, 50, 50);
    
    // Cria o renderizador
    renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Configura controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Adiciona iluminação
    addLights();
    
    // Configura redimensionamento
    setupResize(container);
}

// =============================================
// 2. INICIALIZA IFC LOADER
// =============================================
async function initIFCLoader() {
    ifcLoader = new IFCLoader();
    await ifcLoader.ifcManager.setWasmPath('/wasm/');
    console.log('✅ IFC Loader inicializado');
}

// =============================================
// 3. CARREGAMENTO DO MODELO IFC
// =============================================
async function loadIFCModel(url) {
    try {
        console.log('🔄 Carregando modelo IFC...');
        
        // Remove modelo anterior se existir
        if (currentModel) {
            scene.remove(currentModel);
        }
        
        // Carrega o modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        
        // Obtém o ID do modelo para consultas IFC
        currentModelID = currentModel.modelID;
        
        // Ajusta a câmera para visualizar o modelo
        fitCameraToObject(currentModel);
        
        console.log('✅ Modelo IFC carregado com sucesso!');
        console.log('📊 Model ID:', currentModelID);
        
        // DEBUG: Mostra informações básicas do modelo
        await showBasicModelInfo();
        
    } catch (error) {
        console.error('❌ Erro ao carregar modelo IFC:', error);
    }
}

// =============================================
// 4. SELEÇÃO DE ELEMENTOS COM PROPRIEDADES IFC
// =============================================
function setupSelection() {
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    
    const container = document.getElementById('viewer-container');
    
    container.addEventListener('dblclick', async (event) => {
        // Calcula posição do mouse
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        // Faz raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(currentModel, true);
        
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            const expressID = getExpressID(mesh);
            
            if (expressID) {
                console.log(`🎯 Clicou no elemento ID: ${expressID}`);
                await highlightAndShowProperties(mesh, expressID);
            } else {
                console.log('❌ Mesh sem expressID encontrado');
            }
        } else {
            console.log('❌ Nenhum elemento clicado');
            removeHighlight();
            hidePropertiesPanel();
        }
    });
}

// =============================================
// FUNÇÕES DE PROPRIEDADES IFC
// =============================================

// Mostra informações básicas do modelo
async function showBasicModelInfo() {
    try {
        console.log('📋 Obtendo informações básicas do modelo...');
        
        // Obtém a estrutura espacial
        const spatialStructure = await ifcLoader.ifcManager.getSpatialStructure(currentModelID);
        console.log('🏗️ Estrutura espacial:', spatialStructure);
        
        // Conta elementos
        const elementsCount = await countElementsByType();
        console.log('📊 Elementos no modelo:', elementsCount);
        
        // Mostra no painel de informações
        showModelInfoPanel(elementsCount);
        
    } catch (error) {
        console.error('❌ Erro ao obter informações do modelo:', error);
    }
}

// Destaca mesh e mostra propriedades IFC
async function highlightAndShowProperties(mesh, expressID) {
    try {
        // Remove highlight anterior
        removeHighlight();
        
        // Destaca o mesh
        highlightMesh(mesh);
        
        // Obtém propriedades IFC
        console.log(`🔍 Buscando propriedades para ID: ${expressID}`);
        const properties = await getIFCProperties(expressID);
        
        if (properties) {
            // Mostra propriedades na interface
            showPropertiesPanel(properties, expressID);
            console.log('✅ Propriedades encontradas:', properties);
        } else {
            console.log('❌ Nenhuma propriedade encontrada para este elemento');
            showPropertiesPanel(null, expressID);
        }
        
    } catch (error) {
        console.error('❌ Erro ao obter propriedades:', error);
        showPropertiesPanel(null, expressID, error.message);
    }
}

// Obtém propriedades IFC do elemento
async function getIFCProperties(expressID) {
    if (!currentModelID || !expressID) {
        console.log('❌ Model ID ou Express ID não definido');
        return null;
    }
    
    try {
        console.log(`📡 Consultando IFC Manager para ID: ${expressID}`);
        
        // Método 1: Propriedades completas
        const properties = await ifcLoader.ifcManager.getItemProperties(
            currentModelID, 
            expressID, 
            true
        );
        
        return properties;
        
    } catch (error) {
        console.error('❌ Erro no getItemProperties:', error);
        
        // Método 2: Tenta propriedades simples
        try {
            const simpleProperties = await ifcLoader.ifcManager.getItemProperties(
                currentModelID, 
                expressID, 
                false
            );
            return simpleProperties;
        } catch (error2) {
            console.error('❌ Erro também no método simples:', error2);
            return null;
        }
    }
}

// Conta elementos por tipo IFC
async function countElementsByType() {
    const types = [
        { name: 'IfcWall', type: 106 },
        { name: 'IfcSlab', type: 108 },
        { name: 'IfcBeam', type: 109 },
        { name: 'IfcColumn', type: 110 },
        { name: 'IfcDoor', type: 111 },
        { name: 'IfcWindow', type: 112 },
        { name: 'IfcPlate', type: 113 },
        { name: 'IfcBuilding', type: 3 },
        { name: 'IfcBuildingStorey', type: 4 }
    ];
    
    const counts = {};
    
    for (const elementType of types) {
        try {
            const elements = await ifcLoader.ifcManager.getAllItemsOfType(
                currentModelID,
                elementType.type,
                false
            );
            counts[elementType.name] = elements.length;
        } catch (error) {
            counts[elementType.name] = 0;
        }
    }
    
    return counts;
}

// =============================================
// INTERFACE DE PROPRIEDADES
// =============================================

// Mostra informações gerais do modelo
function showModelInfoPanel(elementsCount) {
    const panel = document.createElement('div');
    panel.id = 'model-info-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 15px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 999;
        max-width: 300px;
    `;
    
    let content = `<h3 style="margin: 0 0 10px 0;">🏗️ Modelo IFC</h3>`;
    content += `<div><strong>ID:</strong> ${currentModelID}</div>`;
    content += `<div style="margin-top: 10px;"><strong>Elementos:</strong></div>`;
    
    for (const [type, count] of Object.entries(elementsCount)) {
        if (count > 0) {
            content += `<div>• ${type}: ${count}</div>`;
        }
    }
    
    content += `<div style="margin-top: 10px; color: #666; font-size: 11px;">Duplo-clique em qualquer elemento para ver propriedades</div>`;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

// Mostra painel de propriedades do elemento
function showPropertiesPanel(properties, expressID, error = null) {
    // Remove painel anterior se existir
    hidePropertiesPanel();
    
    // Cria o painel
    const panel = document.createElement('div');
    panel.id = 'properties-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background: rgba(255, 255, 255, 0.98);
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        font-size: 12px;
        overflow-y: auto;
        z-index: 1000;
    `;
    
    // Conteúdo do painel
    let content = `<h3 style="margin: 0 0 15px 0; color: #2E7D32;">📋 Propriedades do Elemento</h3>`;
    content += `<div style="margin-bottom: 10px; padding: 8px; background: #f0f8f0; border-radius: 4px;">
                   <strong>ID:</strong> ${expressID}
                 </div>`;
    
    if (error) {
        content += `<div style="color: #d32f2f; margin: 10px 0;">Erro: ${error}</div>`;
    } else if (properties) {
        content += formatProperties(properties);
    } else {
        content += `<div style="color: #666; margin: 10px 0;">Nenhuma propriedade encontrada</div>`;
    }
    
    // Botão de fechar
    content += `
        <button onclick="hidePropertiesPanel()" 
                style="margin-top: 15px; padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
            Fechar
        </button>
    `;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

// Formata as propriedades para exibição
function formatProperties(properties, level = 0) {
    let html = '';
    const indent = '&nbsp;'.repeat(level * 4);
    
    // Propriedades principais primeiro
    const mainProperties = ['type', 'Name', 'GlobalId', 'ObjectType', 'Tag'];
    
    // Mostra propriedades principais
    for (const key of mainProperties) {
        if (properties[key] !== undefined && properties[key] !== null) {
            const value = properties[key];
            html += `<div style="margin: 4px 0; padding: 2px 0;">
                       ${indent}<strong>${key}:</strong> ${formatValue(value)}
                     </div>`;
        }
    }
    
    // Linha separadora
    html += `<hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">`;
    
    // Demais propriedades
    for (const [key, value] of Object.entries(properties)) {
        if (mainProperties.includes(key) || value === null || value === undefined) continue;
        
        if (typeof value === 'object' && value !== null) {
            if (value.value !== undefined) {
                html += `<div style="margin: 3px 0;">${indent}<strong>${key}:</strong> ${formatValue(value.value)}</div>`;
            } else if (Object.keys(value).length > 0) {
                html += `<details style="margin: 5px 0;">
                           <summary style="cursor: pointer; font-weight: bold;">${key}</summary>
                           <div style="margin-left: 10px; margin-top: 5px;">
                             ${formatProperties(value, level + 1)}
                           </div>
                         </details>`;
            }
        } else {
            html += `<div style="margin: 3px 0;">${indent}<strong>${key}:</strong> ${formatValue(value)}</div>`;
        }
    }
    
    return html;
}

// Formata valores para exibição
function formatValue(value) {
    if (value === null || value === undefined) return '<em>N/A</em>';
    if (typeof value === 'boolean') return value ? '✅ Sim' : '❌ Não';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
        if (value.trim() === '') return '<em>(vazio)</em>';
        return value;
    }
    if (Array.isArray(value)) return `[${value.length} itens]`;
    return JSON.stringify(value).substring(0, 100) + '...';
}

// Esconde o painel de propriedades
function hidePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) panel.remove();
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Obtém ExpressID do mesh
function getExpressID(mesh) {
    let current = mesh;
    while (current) {
        if (current.userData && current.userData.expressID) {
            return current.userData.expressID;
        }
        current = current.parent;
    }
    return null;
}

// Destaca um mesh
function highlightMesh(mesh) {
    mesh.userData.originalMaterial = mesh.material;
    mesh.material = mesh.material.clone();
    mesh.material.emissive.setHex(0x00ff00);
    mesh.material.emissiveIntensity = 0.3;
}

// Remove highlight
function removeHighlight() {
    if (currentModel) {
        currentModel.traverse(child => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
            }
        });
    }
}

// Adiciona iluminação
function addLights() {
    const ambientLight = new AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
}

// Ajusta câmera
function fitCameraToObject(object) {
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    camera.position.copy(center);
    camera.position.z += maxDim * 2;
    controls.target.copy(center);
    controls.update();
}

// Configura redimensionamento
function setupResize(container) {
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Loop de animação
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// =============================================
// FUNÇÕES GLOBAIS PARA DEBUG
// =============================================

window.debugIFC = {
    getModelInfo: () => {
        console.log('🔍 Obtendo informações do modelo...');
        return showBasicModelInfo();
    },
    getElementsByType: () => {
        console.log('📊 Contando elementos por tipo...');
        return countElementsByType();
    },
    getCurrentModelID: () => {
        console.log('🆔 Model ID:', currentModelID);
        return currentModelID;
    },
    testProperties: async (expressID = 22620) => {
        console.log(`🧪 Testando propriedades para ID: ${expressID}`);
        const props = await getIFCProperties(expressID);
        console.log('📋 Propriedades:', props);
        return props;
    }
};