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
    
    // 🔥 CONFIGURA O IFC MANAGER PARA ANEXAR EXPRESS ID AOS MESHES
    ifcLoader.ifcManager.setupThreeMeshBVH(
        require('three-mesh-bvh'),
        ifcLoader.ifcManager
    );
    
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
        
        // 🔥 CARREGA O MODELO COM CONFIGURAÇÃO PARA PRESERVAR EXPRESS ID
        ifcLoader.ifcManager.useWebIFC = true;
        
        // Carrega o modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        
        // Obtém o ID do modelo para consultas IFC
        currentModelID = currentModel.modelID;
        
        // 🔥 VERIFICA E ANEXA EXPRESS ID AOS MESHES
        await attachExpressIDsToMeshes();
        
        // Ajusta a câmera para visualizar o modelo
        fitCameraToObject(currentModel);
        
        console.log('✅ Modelo IFC carregado com sucesso!');
        console.log('📊 Model ID:', currentModelID);
        
        // Mostra informações básicas do modelo
        await showBasicModelInfo();
        
    } catch (error) {
        console.error('❌ Erro ao carregar modelo IFC:', error);
    }
}

// =============================================
// 🔥 FUNÇÃO CRÍTICA: ANEXA EXPRESS ID AOS MESHES
// =============================================
async function attachExpressIDsToMeshes() {
    if (!currentModel || !currentModelID) return;
    
    console.log('🔍 Anexando Express IDs aos meshes...');
    
    let meshCount = 0;
    let expressIDCount = 0;
    
    currentModel.traverse((child) => {
        if (child.isMesh) {
            meshCount++;
            
            // 🔥 MÉTODO 1: Tenta obter expressID da geometria
            if (child.geometry && child.geometry.attributes) {
                const attributes = child.geometry.attributes;
                
                // Verifica se há atributos de expressID
                if (attributes.expressID) {
                    const expressIDs = attributes.expressID.array;
                    if (expressIDs.length > 0) {
                        // Pega o primeiro expressID (pode haver vários para o mesmo mesh)
                        child.userData.expressID = expressIDs[0];
                        expressIDCount++;
                        console.log(`🔹 Mesh ${meshCount}: ExpressID ${expressIDs[0]}`);
                    }
                }
            }
            
            // 🔥 MÉTODO 2: Se ainda não tem expressID, tenta encontrar via ifcManager
            if (!child.userData.expressID) {
                try {
                    // Tenta encontrar o expressID usando a posição do mesh
                    const expressID = ifcLoader.ifcManager.getExpressId(child.geometry, child.faceIndex);
                    if (expressID) {
                        child.userData.expressID = expressID;
                        expressIDCount++;
                        console.log(`🔹 Mesh ${meshCount}: ExpressID ${expressID} (via faceIndex)`);
                    }
                } catch (error) {
                    // Ignora erro
                }
            }
            
            // 🔥 MÉTODO 3: Marca o mesh como IFC para fácil identificação
            child.userData.isIFCMesh = true;
        }
    });
    
    console.log(`📊 Meshes processados: ${meshCount}, Com ExpressID: ${expressIDCount}`);
    
    // Se nenhum mesh tem expressID, usa método alternativo
    if (expressIDCount === 0) {
        console.log('⚠️ Nenhum ExpressID encontrado, usando método alternativo...');
        await useAlternativeSelectionMethod();
    }
}

// =============================================
// 🔥 MÉTODO ALTERNATIVO DE SELEÇÃO
// =============================================
async function useAlternativeSelectionMethod() {
    console.log('🔄 Configurando seleção alternativa...');
    
    // Obtém todos os elementos do modelo
    try {
        const allElements = await ifcLoader.ifcManager.getAllItemsOfType(currentModelID, 0, true);
        console.log(`📋 Elementos no modelo: ${allElements.length}`);
        
        // Para cada elemento, tenta encontrar o mesh correspondente
        for (const expressID of allElements.slice(0, 10)) { // Limita aos primeiros 10 para teste
            try {
                const mesh = ifcLoader.ifcManager.getMesh(currentModelID, expressID);
                if (mesh) {
                    mesh.userData.expressID = expressID;
                    console.log(`🔹 Elemento ${expressID}: Mesh encontrado`);
                }
            } catch (error) {
                // Ignora erro
            }
        }
    } catch (error) {
        console.error('❌ Erro no método alternativo:', error);
    }
}

// =============================================
// 4. SELEÇÃO DE ELEMENTOS
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
        
        // 🔥 INTERSECTA COM TODOS OS MESHES IFC
        const ifcMeshes = getAllIFCMeshes();
        const intersects = raycaster.intersectObjects(ifcMeshes, true);
        
        console.log(`🎯 Raycasting: ${ifcMeshes.length} meshes, ${intersects.length} intersects`);
        
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            console.log('🔍 Mesh clicado:', mesh);
            console.log('📋 UserData:', mesh.userData);
            
            const expressID = getExpressID(mesh);
            
            if (expressID) {
                console.log(`✅ Elemento selecionado - ID: ${expressID}`);
                await highlightAndShowProperties(mesh, expressID);
            } else {
                console.log('❌ Mesh sem expressID, tentando método alternativo...');
                // Tenta encontrar expressID pelo método alternativo
                const altExpressID = await findExpressIDByGeometry(mesh);
                if (altExpressID) {
                    console.log(`✅ Elemento selecionado (alternativo) - ID: ${altExpressID}`);
                    await highlightAndShowProperties(mesh, altExpressID);
                } else {
                    console.log('❌ Não foi possível encontrar ExpressID para este mesh');
                    showErrorPanel('Não foi possível identificar este elemento');
                }
            }
        } else {
            console.log('❌ Nenhum elemento clicado');
            removeHighlight();
            hidePropertiesPanel();
        }
    });
}

// =============================================
// 🔥 FUNÇÕES AUXILIARES DE SELEÇÃO
// =============================================

// Obtém todos os meshes IFC
function getAllIFCMeshes() {
    const meshes = [];
    if (currentModel) {
        currentModel.traverse(child => {
            if (child.isMesh && child.userData?.isIFCMesh) {
                meshes.push(child);
            }
        });
    }
    return meshes;
}

// Obtém ExpressID do mesh (método principal)
function getExpressID(mesh) {
    return mesh.userData?.expressID || null;
}

// Método alternativo para encontrar ExpressID pela geometria
async function findExpressIDByGeometry(mesh) {
    try {
        if (!mesh.geometry) return null;
        
        // Tenta usar o ifcManager para encontrar o expressID
        const expressID = ifcLoader.ifcManager.getExpressId(mesh.geometry, 0);
        if (expressID) {
            // Salva para uso futuro
            mesh.userData.expressID = expressID;
            return expressID;
        }
    } catch (error) {
        console.error('❌ Erro ao buscar ExpressID pela geometria:', error);
    }
    return null;
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
        
        // Mostra no painel de informações
        showModelInfoPanel(spatialStructure);
        
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
    if (!currentModelID || !expressID) return null;
    
    try {
        // Tenta obter propriedades
        const properties = await ifcLoader.ifcManager.getItemProperties(
            currentModelID, 
            expressID, 
            false // Não recursivo primeiro
        );
        
        return properties;
        
    } catch (error) {
        console.error('❌ Erro ao obter propriedades:', error);
        return null;
    }
}

// =============================================
// INTERFACE (mantida do código anterior)
// =============================================

// Mostra informações gerais do modelo
function showModelInfoPanel(spatialStructure) {
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
    content += `<div><strong>Projeto:</strong> ${spatialStructure?.Name?.value || 'N/A'}</div>`;
    content += `<div style="margin-top: 10px; color: #666; font-size: 11px;">Duplo-clique em qualquer elemento para ver propriedades</div>`;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

// Mostra painel de propriedades (simplificado)
function showPropertiesPanel(properties, expressID, error = null) {
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
    content += `<div><strong>ID:</strong> ${expressID}</div>`;
    
    if (error) {
        content += `<div style="color: red;">Erro: ${error}</div>`;
    } else if (properties) {
        content += `<div><strong>Tipo:</strong> ${properties.type || 'N/A'}</div>`;
        content += `<div><strong>Nome:</strong> ${properties.Name?.value || 'N/A'}</div>`;
        content += `<div><strong>GlobalId:</strong> ${properties.GlobalId?.value || 'N/A'}</div>`;
    } else {
        content += `<div>Nenhuma propriedade encontrada</div>`;
    }
    
    content += `<button onclick="hidePropertiesPanel()" style="margin-top: 15px; padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Fechar</button>`;
    
    panel.innerHTML = content;
    document.body.appendChild(panel);
}

function hidePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) panel.remove();
}

function showErrorPanel(message) {
    hidePropertiesPanel();
    
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffebee;
        border: 1px solid #f44336;
        border-radius: 8px;
        padding: 15px;
        font-family: Arial, sans-serif;
        z-index: 1000;
    `;
    panel.innerHTML = `<div style="color: #d32f2f;">⚠️ ${message}</div>`;
    document.body.appendChild(panel);
    
    setTimeout(() => panel.remove(), 3000);
}

// =============================================
// FUNÇÕES AUXILIARES RESTANTES
// =============================================

function highlightMesh(mesh) {
    mesh.userData.originalMaterial = mesh.material;
    mesh.material = mesh.material.clone();
    mesh.material.emissive.setHex(0x00ff00);
    mesh.material.emissiveIntensity = 0.3;
}

function removeHighlight() {
    if (currentModel) {
        currentModel.traverse(child => {
            if (child.isMesh && child.userData?.originalMaterial) {
                child.material = child.userData.originalMaterial;
            }
        });
    }
}

function addLights() {
    const ambientLight = new AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
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

// Debug functions
window.debugIFC = {
    getModelInfo: () => showBasicModelInfo(),
    testSelection: () => {
        console.log('🧪 Testando seleção...');
        const meshes = getAllIFCMeshes();
        console.log(`📊 Meshes IFC: ${meshes.length}`);
        meshes.forEach((mesh, i) => {
            console.log(`Mesh ${i}:`, {
                expressID: mesh.userData?.expressID,
                userData: mesh.userData
            });
        });
    }
};