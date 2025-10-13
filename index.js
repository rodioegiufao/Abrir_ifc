import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three';

// 🔥 VARIÁVEIS GLOBAIS - ESTRATÉGIA DE ARMAZENAMENTO
let scene, renderer, camera, controls, ifcLoader;
let currentModel = null;
let currentModelID = null;

// 🔥 ARMAZENAMENTO DOS ELEMENTOS IFC
let ifcElements = new Map(); // Map<expressID, { meshes: THREE.Mesh[], properties: any }>
let allOriginalMeshes = []; // Todos os meshes originais
let visibleMeshes = []; // Meshes atualmente visíveis
let hiddenElements = new Set(); // IDs dos elementos ocultos

// 🔥 ELEMENTO SELECIONADO ATUAL
let selectedElement = null; // { expressID: number, meshes: THREE.Mesh[] }

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
    scene = new Scene();
    scene.background = new Color(0xeeeeee);
    
    camera = new PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(50, 50, 50);
    
    renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    addLights();
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
// 3. CARREGAMENTO DO MODELO IFC - ESTRATÉGIA CORRETA
// =============================================
async function loadIFCModel(url) {
    try {
        console.log('🔄 Carregando modelo IFC...');
        
        // Limpa dados anteriores
        cleanupPreviousModel();
        
        // Carrega o modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        currentModelID = currentModel.modelID;
        
        // 🔥 ESTRATÉGIA CRÍTICA: ORGANIZA TODOS OS ELEMENTOS
        await organizeIFCElements();
        
        // Ajusta a câmera
        fitCameraToObject(currentModel);
        
        console.log('✅ Modelo IFC carregado e organizado!');
        console.log(`📊 Elementos carregados: ${ifcElements.size}`);
        
        showModelInfoPanel();
        
    } catch (error) {
        console.error('❌ Erro ao carregar modelo IFC:', error);
    }
}

// 🔥 LIMPA MODELO ANTERIOR
function cleanupPreviousModel() {
    if (currentModel) {
        scene.remove(currentModel);
    }
    ifcElements.clear();
    allOriginalMeshes = [];
    visibleMeshes = [];
    hiddenElements.clear();
    selectedElement = null;
}

// 🔥 ORGANIZA TODOS OS ELEMENTOS IFC
async function organizeIFCElements() {
    if (!currentModel || !currentModelID) return;
    
    console.log('🏗️ Organizando elementos IFC...');
    
    // Coleta todos os meshes do modelo
    collectAllMeshes();
    
    // Agrupa meshes por expressID
    groupMeshesByExpressID();
    
    // Carrega propriedades para cada elemento
    await loadElementsProperties();
    
    console.log(`📊 Organização concluída: ${ifcElements.size} elementos únicos`);
}

// 🔥 COLETA TODOS OS MESHES
function collectAllMeshes() {
    allOriginalMeshes = [];
    
    currentModel.traverse((child) => {
        if (child.isMesh) {
            allOriginalMeshes.push(child);
            child.userData.isIFCMesh = true;
        }
    });
    
    // Inicialmente, todos os meshes estão visíveis
    visibleMeshes = [...allOriginalMeshes];
    
    console.log(`📊 Meshes coletados: ${allOriginalMeshes.length}`);
}

// 🔥 AGRUPA MESHES POR EXPRESSID
function groupMeshesByExpressID() {
    let meshesWithID = 0;
    
    allOriginalMeshes.forEach(mesh => {
        const expressID = findExpressID(mesh);
        
        if (expressID) {
            meshesWithID++;
            
            if (!ifcElements.has(expressID)) {
                ifcElements.set(expressID, {
                    meshes: [],
                    properties: null
                });
            }
            
            ifcElements.get(expressID).meshes.push(mesh);
        }
    });
    
    console.log(`📊 Meshes com ExpressID: ${meshesWithID}/${allOriginalMeshes.length}`);
    
    // Se poucos meshes têm ID, usa agrupamento por geometria
    if (meshesWithID < allOriginalMeshes.length * 0.5) {
        console.log('⚠️ Poucos ExpressIDs, usando agrupamento alternativo...');
        groupMeshesByGeometry();
    }
}

// 🔥 ENCONTRA EXPRESSID DO MESH
function findExpressID(mesh) {
    // Método 1: UserData direto
    if (mesh.userData?.expressID) {
        return mesh.userData.expressID;
    }
    
    // Método 2: Atributos da geometria
    if (mesh.geometry?.attributes?.expressID) {
        const expressIDs = mesh.geometry.attributes.expressID.array;
        if (expressIDs.length > 0) {
            mesh.userData.expressID = expressIDs[0];
            return expressIDs[0];
        }
    }
    
    // Método 3: Atributos itemID
    if (mesh.geometry?.attributes?.itemID) {
        const itemIDs = mesh.geometry.attributes.itemID.array;
        if (itemIDs.length > 0) {
            mesh.userData.expressID = itemIDs[0];
            return itemIDs[0];
        }
    }
    
    return null;
}

// 🔥 AGRUPAMENTO ALTERNATIVO POR GEOMETRIA
function groupMeshesByGeometry() {
    let geometryGroupID = 100000; // ID inicial para grupos
    
    allOriginalMeshes.forEach(mesh => {
        if (!mesh.userData.expressID && mesh.geometry) {
            // Cria um ID baseado na geometria
            const geometryID = geometryGroupID++;
            mesh.userData.expressID = geometryID;
            
            if (!ifcElements.has(geometryID)) {
                ifcElements.set(geometryID, {
                    meshes: [],
                    properties: { type: 'GeometryGroup', Name: { value: 'Elemento Geométrico' } }
                });
            }
            
            ifcElements.get(geometryID).meshes.push(mesh);
        }
    });
}

// 🔥 CARREGA PROPRIEDADES DOS ELEMENTOS
async function loadElementsProperties() {
    console.log('📋 Carregando propriedades dos elementos...');
    
    let loadedProperties = 0;
    
    for (const [expressID, element] of ifcElements) {
        try {
            // Tenta carregar propriedades apenas para IDs numéricos (não os de geometria)
            if (typeof expressID === 'number' && expressID < 100000) {
                const properties = await ifcLoader.ifcManager.getItemProperties(
                    currentModelID, 
                    expressID, 
                    false
                );
                
                if (properties) {
                    element.properties = properties;
                    loadedProperties++;
                }
            }
        } catch (error) {
            // Ignora erros - alguns elementos podem não ter propriedades
        }
    }
    
    console.log(`📊 Propriedades carregadas: ${loadedProperties}/${ifcElements.size}`);
}

// =============================================
// 4. SELEÇÃO DE ELEMENTOS - ESTRATÉGIA CORRETA
// =============================================
function setupSelection() {
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    
    const container = document.getElementById('viewer-container');
    
    container.addEventListener('dblclick', (event) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        // 🔥 INTERSECTA APENAS COM MESHES VISÍVEIS
        const intersects = raycaster.intersectObjects(visibleMeshes, true);
        
        console.log(`🎯 Raycasting: ${visibleMeshes.length} meshes visíveis, ${intersects.length} intersects`);
        
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const expressID = clickedMesh.userData?.expressID;
            
            if (expressID && ifcElements.has(expressID)) {
                selectElement(expressID);
            } else {
                console.log('❌ Elemento não encontrado no mapa IFC');
            }
        } else {
            deselectElement();
        }
    });
}

// 🔥 SELECIONA ELEMENTO
function selectElement(expressID) {
    // Desseleciona anterior
    deselectElement();
    
    const element = ifcElements.get(expressID);
    if (!element) return;
    
    // Define como selecionado
    selectedElement = {
        expressID: expressID,
        meshes: element.meshes
    };
    
    // Destaca visualmente
    highlightElement(selectedElement);
    
    // Mostra propriedades
    showElementProperties(element.properties, expressID);
    
    console.log(`✅ Elemento selecionado: ${expressID} (${element.meshes.length} meshes)`);
}

// 🔥 DESSELECIONA ELEMENTO
function deselectElement() {
    if (selectedElement) {
        removeHighlight(selectedElement);
        selectedElement = null;
    }
    hidePropertiesPanel();
}

// 🔥 DESTACA ELEMENTO VISUALMENTE
function highlightElement(element) {
    element.meshes.forEach(mesh => {
        mesh.userData.originalMaterial = mesh.material;
        mesh.material = mesh.material.clone();
        mesh.material.emissive.setHex(0x00ff00);
        mesh.material.emissiveIntensity = 0.3;
    });
}

// 🔥 REMOVE DESTAQUE
function removeHighlight(element) {
    element.meshes.forEach(mesh => {
        if (mesh.userData.originalMaterial) {
            mesh.material = mesh.userData.originalMaterial;
        }
    });
}

// =============================================
// 🔥 CONTROLE DE VISIBILIDADE - PULO DO GATO
// =============================================

// OCULTAR ELEMENTO SELECIONADO
function hideSelectedElement() {
    if (!selectedElement) {
        alert('Selecione um elemento primeiro (duplo clique)');
        return;
    }
    
    const expressID = selectedElement.expressID;
    
    // Remove os meshes da lista de visíveis
    selectedElement.meshes.forEach(mesh => {
        const index = visibleMeshes.indexOf(mesh);
        if (index > -1) {
            visibleMeshes.splice(index, 1);
        }
        mesh.visible = false;
    });
    
    // Adiciona à lista de ocultos
    hiddenElements.add(expressID);
    
    console.log(`🔹 Elemento ${expressID} ocultado`);
    
    // Atualiza contador
    updateHiddenCounter();
    
    deselectElement();
}

// MOSTRAR TODOS OS ELEMENTOS
function showAllElements() {
    // Restaura todos os meshes para visíveis
    allOriginalMeshes.forEach(mesh => {
        mesh.visible = true;
    });
    
    // Reseta a lista de visíveis
    visibleMeshes = [...allOriginalMeshes];
    
    // Limpa lista de ocultos
    hiddenElements.clear();
    
    console.log('🔹 Todos os elementos visíveis');
    
    // Atualiza contador
    updateHiddenCounter();
    
    deselectElement();
}

// MOSTRAR ELEMENTO ESPECÍFICO
function showElement(expressID) {
    const element = ifcElements.get(expressID);
    if (!element) return;
    
    element.meshes.forEach(mesh => {
        mesh.visible = true;
        // Adiciona de volta à lista de visíveis se não estiver
        if (!visibleMeshes.includes(mesh)) {
            visibleMeshes.push(mesh);
        }
    });
    
    hiddenElements.delete(expressID);
    updateHiddenCounter();
}

// =============================================
// INTERFACE
// =============================================

function showModelInfoPanel() {
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
    content += `<div><strong>Elementos:</strong> ${ifcElements.size}</div>`;
    content += `<div><strong>Meshes:</strong> ${allOriginalMeshes.length}</div>`;
    content += `<div id="hidden-counter"><strong>Ocultos:</strong> 0</div>`;
    content += `<div style="margin-top: 10px; color: #666; font-size: 11px;">
                   Duplo-clique: Selecionar<br>
                   Botão: Ocultar/Mostrar
                </div>`;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

function updateHiddenCounter() {
    const counter = document.getElementById('hidden-counter');
    if (counter) {
        counter.innerHTML = `<strong>Ocultos:</strong> ${hiddenElements.size}`;
    }
}

function showElementProperties(properties, expressID) {
    hidePropertiesPanel();
    
    const panel = document.createElement('div');
    panel.id = 'properties-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        font-size: 12px;
        overflow-y: auto;
        z-index: 1000;
    `;
    
    let content = `<h3 style="margin: 0 0 15px 0;">📋 Propriedades</h3>`;
    content += `<div style="margin-bottom: 10px;"><strong>ID:</strong> ${expressID}</div>`;
    
    if (properties) {
        content += `<div><strong>Tipo:</strong> ${properties.type || 'N/A'}</div>`;
        content += `<div><strong>Nome:</strong> ${properties.Name?.value || 'N/A'}</div>`;
        content += `<div><strong>GlobalId:</strong> ${properties.GlobalId?.value || 'N/A'}</div>`;
    } else {
        content += `<div style="color: #666;">Propriedades IFC não disponíveis</div>`;
    }
    
    content += `<button onclick="hidePropertiesPanel()" style="margin-top: 15px; padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Fechar</button>`;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

function hidePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) panel.remove();
}

// =============================================
// FUNÇÕES RESTANTES
// =============================================

function addLights() {
    scene.add(new AmbientLight(0xffffff, 0.6));
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
}

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

function setupResize(container) {
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// =============================================
// CONEXÃO COM OS BOTÕES HTML
// =============================================

// Conecta aos botões existentes
document.addEventListener('DOMContentLoaded', () => {
    const hideButton = document.getElementById('hide-selected');
    const showButton = document.getElementById('show-all');
    
    if (hideButton) {
        hideButton.onclick = hideSelectedElement;
    }
    
    if (showButton) {
        showButton.onclick = showAllElements;
    }
});

// Debug functions
window.debugIFC = {
    getStats: () => {
        console.log('📊 Estatísticas do modelo:');
        console.log('- Elementos únicos:', ifcElements.size);
        console.log('- Meshes totais:', allOriginalMeshes.length);
        console.log('- Meshes visíveis:', visibleMeshes.length);
        console.log('- Elementos ocultos:', hiddenElements.size);
        console.log('- Elementos:', ifcElements);
    },
    showElement: (expressID) => showElement(expressID),
    hideElement: (expressID) => {
        const element = ifcElements.get(expressID);
        if (element) {
            element.meshes.forEach(mesh => {
                mesh.visible = false;
                const index = visibleMeshes.indexOf(mesh);
                if (index > -1) visibleMeshes.splice(index, 1);
            });
            hiddenElements.add(expressID);
            updateHiddenCounter();
        }
    }
};