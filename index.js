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
                await highlightAndShowProperties(mesh, expressID);
            }
        }
    });
}

// =============================================
// FUNÇÕES DE PROPRIEDADES IFC
// =============================================

// Destaca mesh e mostra propriedades IFC
async function highlightAndShowProperties(mesh, expressID) {
    try {
        // Remove highlight anterior
        removeHighlight();
        
        // Destaca o mesh
        highlightMesh(mesh);
        
        // Obtém propriedades IFC
        const properties = await getIFCProperties(expressID);
        
        // Mostra propriedades na interface
        showPropertiesPanel(properties, expressID);
        
        console.log('🟩 Elemento selecionado - ID:', expressID);
        console.log('📋 Propriedades:', properties);
        
    } catch (error) {
        console.error('❌ Erro ao obter propriedades:', error);
    }
}

// Obtém propriedades IFC do elemento
async function getIFCProperties(expressID) {
    if (!currentModelID || !expressID) return null;
    
    try {
        // Obtém propriedades completas do elemento
        const properties = await ifcLoader.ifcManager.getItemProperties(
            currentModelID, 
            expressID, 
            true // recursive - obtém propriedades aninhadas
        );
        
        return properties;
        
    } catch (error) {
        console.error('❌ Erro ao obter propriedades IFC:', error);
        return null;
    }
}

// Obtém todas as propriedades do modelo (para debug)
async function getAllModelProperties() {
    if (!currentModelID) return;
    
    try {
        // Obtém a estrutura espacial completa
        const spatialStructure = await ifcLoader.ifcManager.getSpatialStructure(currentModelID);
        console.log('🏗️ Estrutura espacial do modelo:', spatialStructure);
        
        // Conta elementos por tipo
        const elementsCount = await countElementsByType();
        console.log('📊 Estatísticas do modelo:', elementsCount);
        
    } catch (error) {
        console.error('❌ Erro ao obter estrutura do modelo:', error);
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
        { name: 'IfcPlate', type: 113 }
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

// Mostra painel de propriedades
function showPropertiesPanel(properties, expressID) {
    // Remove painel anterior se existir
    const existingPanel = document.getElementById('properties-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    // Cria o painel
    const panel = document.createElement('div');
    panel.id = 'properties-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        max-height: 80vh;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        font-size: 12px;
        overflow-y: auto;
        z-index: 1000;
    `;
    
    // Conteúdo do painel
    let content = `<h3 style="margin: 0 0 15px 0; color: #333;">📋 Propriedades do Elemento</h3>`;
    content += `<div style="margin-bottom: 10px;"><strong>ID:</strong> ${expressID}</div>`;
    
    if (properties) {
        content += formatProperties(properties);
    } else {
        content += `<div style="color: #666;">Nenhuma propriedade encontrada</div>`;
    }
    
    // Botão de fechar
    content += `
        <button onclick="document.getElementById('properties-panel').remove()" 
                style="margin-top: 15px; padding: 5px 10px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
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
    
    for (const [key, value] of Object.entries(properties)) {
        if (value === null || value === undefined) continue;
        
        if (typeof value === 'object' && value !== null) {
            // Propriedade aninhada
            if (value.value !== undefined) {
                // Propriedade IFC com valor
                html += `<div style="margin: 2px 0;">${indent}<strong>${key}:</strong> ${formatValue(value.value)}</div>`;
            } else {
                // Objeto complexo
                html += `<div style="margin: 5px 0;">${indent}<strong>${key}:</strong></div>`;
                html += formatProperties(value, level + 1);
            }
        } else {
            // Propriedade simples
            html += `<div style="margin: 2px 0;">${indent}<strong>${key}:</strong> ${formatValue(value)}</div>`;
        }
    }
    
    return html;
}

// Formata valores para exibição
function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
        if (value.trim() === '') return '(vazio)';
        return value;
    }
    return JSON.stringify(value);
}

// =============================================
// FUNÇÕES AUXILIARES (mantidas do código anterior)
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
// FUNÇÕES GLOBAIS PARA DEBUG (opcional)
// =============================================

// Adiciona no console para testar
window.debugIFC = {
    getModelInfo: () => getAllModelProperties(),
    getElementsByType: () => countElementsByType(),
    getCurrentModelID: () => currentModelID
};