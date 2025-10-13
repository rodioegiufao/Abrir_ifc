import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three';

// Variáveis globais
let scene, renderer, camera, controls;
let currentModel = null;

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('viewer-container');
    
    // 1. INICIALIZAÇÃO DA CENA THREE.JS
    initScene(container);
    
    // 2. CARREGA O MODELO IFC
    await loadIFCModel('models/01.ifc');
    
    // 3. CONFIGURA SELEÇÃO
    setupSelection();
    
    // 4. INICIA ANIMAÇÃO
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
// 2. CARREGAMENTO DO MODELO IFC
// =============================================
async function loadIFCModel(url) {
    try {
        console.log('🔄 Carregando modelo IFC...');
        
        // Cria o loader IFC
        const ifcLoader = new IFCLoader();
        await ifcLoader.ifcManager.setWasmPath('/wasm/');
        
        // Carrega o modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        
        // Ajusta a câmera para visualizar o modelo
        fitCameraToObject(currentModel);
        
        console.log('✅ Modelo IFC carregado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar modelo IFC:', error);
    }
}

// =============================================
// 3. SELEÇÃO DE ELEMENTOS
// =============================================
function setupSelection() {
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    
    const container = document.getElementById('viewer-container');
    
    container.addEventListener('dblclick', (event) => {
        // Calcula posição do mouse
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        // Faz raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(currentModel, true);
        
        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            highlightMesh(mesh);
        }
    });
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Adiciona iluminação à cena
function addLights() {
    // Luz ambiente
    const ambientLight = new AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Luz direcional
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
}

// Ajusta a câmera para visualizar o objeto
function fitCameraToObject(object) {
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Posiciona a câmera
    camera.position.copy(center);
    camera.position.z += maxDim * 2;
    controls.target.copy(center);
    controls.update();
    
    console.log('📐 Câmera ajustada para visualização 3D');
}

// Destaca um mesh (apenas visualmente)
function highlightMesh(mesh) {
    // Remove highlight anterior
    removeHighlight();
    
    // Salva material original
    mesh.userData.originalMaterial = mesh.material;
    
    // Aplica material destacado
    mesh.material = mesh.material.clone();
    mesh.material.emissive.setHex(0x00ff00); // Verde para destaque
    mesh.material.emissiveIntensity = 0.3;
    
    console.log('🟩 Elemento destacado');
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

// Configura redimensionamento da janela
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