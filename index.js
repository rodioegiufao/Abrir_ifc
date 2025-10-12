import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three';

let scene, renderer, camera, controls;
let currentModel = null;
let selectedElement = null; // { expressID: number, meshes: THREE.Mesh[] }

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('viewer-container');
    
    // Setup básico do Three.js
    scene = new Scene();
    scene.background = new Color(0xeeeeee);
    
    camera = new PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(50, 50, 50);
    
    renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Luz
    scene.add(new AmbientLight(0xffffff, 0.6));
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
    
    // Loader IFC
    const ifcLoader = new IFCLoader();
    await ifcLoader.ifcManager.setWasmPath('/wasm/');
    
    // Carrega modelo
    currentModel = await ifcLoader.loadAsync('models/01.ifc');
    scene.add(currentModel);
    
    // Ajusta a câmera automaticamente
    fitCameraToObject(currentModel);
    
    // 🔥 SETUP SIMPLIFICADO DE SELEÇÃO
    setupSelection();
    
    function setupSelection() {
        const raycaster = new Raycaster();
        const mouse = new Vector2();
        
        container.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            
            // 🔹 MÉTODO DIRETO: Intersecta com o modelo inteiro
            const intersects = raycaster.intersectObject(currentModel, true);
            
            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                const expressID = getExpressID(clickedMesh);
                
                if (expressID) {
                    selectElement(expressID);
                    console.log('✅ Elemento selecionado - ExpressID:', expressID);
                } else {
                    console.log('❌ Mesh sem expressID:', clickedMesh);
                }
            } else {
                console.log('❌ Nenhum mesh intersectado');
                deselectElement();
            }
        });
    }
    
    // 🔹 FUNÇÃO PARA OBTER EXPRESSID DE QUALQUER MESH
    function getExpressID(mesh) {
        // Procura o expressID no mesh ou em seus pais
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.expressID) {
                return current.userData.expressID;
            }
            current = current.parent;
        }
        return null;
    }
    
    // 🔹 SELECIONA ELEMENTO POR EXPRESSID
    function selectElement(expressID) {
        // Desseleciona anterior
        deselectElement();
        
        // Encontra TODOS os meshes com este expressID
        const elementMeshes = findAllMeshesByExpressID(expressID);
        
        if (elementMeshes.length === 0) {
            console.log('❌ Nenhum mesh encontrado para expressID:', expressID);
            return;
        }
        
        // 🔹 DESTACA TODOS OS MESHES
        elementMeshes.forEach(mesh => {
            mesh.originalMaterial = mesh.material;
            // Cria material destacado
            mesh.material = mesh.material.clone();
            mesh.material.emissive.setHex(0xFF0000); // Vermelho para destaque
            mesh.material.emissiveIntensity = 0.3;
        });
        
        selectedElement = { expressID, meshes: elementMeshes };
        
        // Feedback visual
        updateSelectionInfo(expressID);
        console.log(`🔹 Selecionado: ${expressID} (${elementMeshes.length} meshes)`);
    }
    
    // 🔹 ENCONTRA TODOS OS MESHES COM MESMO EXPRESSID
    function findAllMeshesByExpressID(expressID) {
        const meshes = [];
        currentModel.traverse((child) => {
            if (child.isMesh) {
                const childExpressID = getExpressID(child);
                if (childExpressID === expressID) {
                    meshes.push(child);
                }
            }
        });
        return meshes;
    }
    
    // 🔹 DESSELECIONA ELEMENTO
    function deselectElement() {
        if (selectedElement && selectedElement.meshes) {
            selectedElement.meshes.forEach(mesh => {
                if (mesh.originalMaterial) {
                    mesh.material = mesh.originalMaterial;
                }
            });
        }
        selectedElement = null;
        updateSelectionInfo(null);
    }
    
    // 🔹 ATUALIZA INFO DE SELEÇÃO NA TELA
    function updateSelectionInfo(expressID) {
        const infoDiv = document.getElementById('selection-info');
        if (!infoDiv) return;
        
        if (expressID) {
            infoDiv.textContent = `Elemento selecionado (ID: ${expressID})`;
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    }
    
    // 🔥 OCULTAR SELECIONADO
    function hideSelected() {
        if (selectedElement && selectedElement.expressID) {
            const elementMeshes = selectedElement.meshes;
            
            elementMeshes.forEach(mesh => {
                mesh.visible = false;
            });
            
            console.log(`🔹 Ocultado elemento ${selectedElement.expressID}`);
            deselectElement();
        } else {
            alert('Selecione um elemento primeiro (duplo clique)');
        }
    }
    
    // 🔥 MOSTRAR TODOS
    function showAll() {
        if (currentModel) {
            currentModel.traverse(child => {
                if (child.isMesh) {
                    child.visible = true;
                }
            });
            console.log('🔹 Todos os elementos visíveis');
        }
        deselectElement();
    }
    
    // 🔥 AJUSTA CÂMERA
    function fitCameraToObject(object) {
        const box = new Box3().setFromObject(object);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        camera.position.copy(center);
        camera.position.z += maxDim * 2;
        controls.target.copy(center);
        controls.update();
        
        console.log('📐 Câmera ajustada');
    }
    
    // 🔥 CARREGAR NOVO ARQUIVO
    async function loadNewIfc(url) {
        if (currentModel) {
            scene.remove(currentModel);
            deselectElement();
        }
        
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        fitCameraToObject(currentModel);
        
        console.log('✅ Novo modelo carregado');
    }
    
    // Conecta aos botões
    document.getElementById('hide-selected').onclick = hideSelected;
    document.getElementById('show-all').onclick = showAll;
    
    // Upload de arquivo
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                await loadNewIfc(ifcURL);
            }
        });
    }
    
    // Animação
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    
    // Redimensionamento
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
});