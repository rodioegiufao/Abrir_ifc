import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3, Group
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three';

let scene, renderer, camera, controls;
let currentModel = null;
let selectedMesh = null;
let meshMap = new Map(); // Mapeia expressID para array de meshes

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
    
    // 🔥 ORBIT CONTROLS - Navegação profissional
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI;
    
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
    
    // 🔥 ORGANIZA OS MESHES POR EXPRESS ID
    organizeMeshesByExpressID(currentModel);
    
    // Ajusta a câmera automaticamente
    fitCameraToObject(currentModel);
    
    // Raycasting para seleção
    setupRaycasting();
    
    // 🔥 FUNÇÃO PARA ORGANIZAR MESHES POR ID
    function organizeMeshesByExpressID(model) {
        meshMap.clear();
        
        model.traverse((child) => {
            if (child.isMesh && child.userData && child.userData.expressID) {
                const expressID = child.userData.expressID;
                
                if (!meshMap.has(expressID)) {
                    meshMap.set(expressID, []);
                }
                meshMap.get(expressID).push(child);
                
                // Marca o mesh para fácil identificação
                child.userData.isIFCMesh = true;
            }
        });
        
        console.log(`🔹 Organizados ${meshMap.size} elementos únicos`);
    }
    
    // 🔥 RAYCASTING CORRIGIDO
    function setupRaycasting() {
        const raycaster = new Raycaster();
        const mouse = new Vector2();
        
        container.addEventListener('dblclick', (event) => {
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            
            // 🔹 IMPORTANTE: Usa todos os meshes do modelo
            const allMeshes = getAllMeshes();
            const intersects = raycaster.intersectObjects(allMeshes, true);
            
            if (intersects.length > 0) {
                const selected = intersects[0].object;
                const expressID = selected.userData?.expressID;
                
                if (expressID) {
                    selectElement(expressID);
                    console.log('✅ Elemento selecionado - ExpressID:', expressID);
                }
            } else {
                deselectElement();
            }
        });
    }
    
    // 🔹 OBTÉM TODOS OS MESHES DO MODELO
    function getAllMeshes() {
        const meshes = [];
        currentModel.traverse(child => {
            if (child.isMesh && child.userData?.isIFCMesh) {
                meshes.push(child);
            }
        });
        return meshes;
    }
    
    // 🔥 SELEÇÃO POR EXPRESS ID (TODO O ELEMENTO)
    function selectElement(expressID) {
        // Desseleciona anterior
        deselectElement();
        
        // Encontra todos os meshes com este expressID
        const elementMeshes = meshMap.get(expressID);
        if (!elementMeshes) return;
        
        // 🔹 DESTACA TODOS OS MESHES DO ELEMENTO
        elementMeshes.forEach(mesh => {
            mesh.originalMaterial = mesh.material;
            // Apenas muda a cor para destaque
            mesh.material = mesh.material.clone();
            mesh.material.emissive.setHex(0x444400); // Amarelo escuro para destaque
        });
        
        selectedMesh = { expressID, meshes: elementMeshes };
        
        // Feedback visual
        const infoDiv = document.getElementById('selection-info');
        if (infoDiv) {
            infoDiv.textContent = `Elemento selecionado (ID: ${expressID})`;
            infoDiv.style.display = 'block';
        }
        
        console.log(`🔹 Selecionado elemento ${expressID} com ${elementMeshes.length} meshes`);
    }
    
    // 🔥 DESSELECIONA ELEMENTO
    function deselectElement() {
        if (selectedMesh && selectedMesh.meshes) {
            selectedMesh.meshes.forEach(mesh => {
                if (mesh.originalMaterial) {
                    mesh.material = mesh.originalMaterial;
                }
            });
        }
        selectedMesh = null;
        
        const infoDiv = document.getElementById('selection-info');
        if (infoDiv) infoDiv.style.display = 'none';
    }
    
    // 🔥 OCULTAR SELECIONADO (AGORA OCULTA TODO O ELEMENTO)
    function hideSelected() {
        if (selectedMesh && selectedMesh.expressID) {
            const elementMeshes = meshMap.get(selectedMesh.expressID);
            
            if (elementMeshes) {
                elementMeshes.forEach(mesh => {
                    mesh.visible = false;
                });
                
                console.log(`🔹 Ocultado elemento ${selectedMesh.expressID} com ${elementMeshes.length} meshes`);
                deselectElement();
            }
        } else {
            alert('Selecione um elemento primeiro (duplo clique)');
        }
    }
    
    // 🔥 MOSTRAR TODOS OS ELEMENTOS
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
    
    // 🔥 AJUSTA CÂMERA PARA VISUALIZAR O MODELO
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
        
        console.log('📐 Câmera 3D ajustada para visualização completa');
    }
    
    // 🔥 CARREGAR NOVO ARQUIVO IFC
    async function loadNewIfc(url) {
        // Remove modelo anterior
        if (currentModel) {
            scene.remove(currentModel);
            meshMap.clear();
            deselectElement();
        }
        
        // Carrega novo modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        
        // Reorganiza os meshes
        organizeMeshesByExpressID(currentModel);
        
        // Ajusta câmera
        fitCameraToObject(currentModel);
        
        console.log('✅ Novo modelo IFC carregado');
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
        controls.update(); // 🔹 IMPORTANTE: Atualiza controles
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