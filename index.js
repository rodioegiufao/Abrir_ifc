import { 
    Color, 
    Scene, 
    WebGLRenderer, 
    PerspectiveCamera, 
    AmbientLight, 
    DirectionalLight,
    Raycaster,
    Vector2,
    Box3,
    Vector3,
    MeshPhongMaterial
} from 'three';
import { IFCLoader } from 'web-ifc-three';

let scene, renderer, camera, ifcLoader;
let currentModel = null;
let allMeshes = []; // Array para armazenar todos os meshes
let selectedMesh = null;

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');
    
    // --- Inicializa Three.js Scene ---
    function initThreeJS() {
        // Cena
        scene = new Scene();
        scene.background = new Color(0xeeeeee);
        
        // Câmera
        camera = new PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(10, 10, 10);
        camera.lookAt(0, 0, 0);
        
        // Renderer
        renderer = new WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        
        // Iluminação
        const ambientLight = new AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 15);
        scene.add(directionalLight);
        
        // IFC Loader
        ifcLoader = new IFCLoader();
        ifcLoader.ifcManager.setWasmPath('/wasm/');
        
        // Animação
        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();
        
        // Redimensionamento
        window.addEventListener('resize', () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    // --- Carrega IFC ---
    async function loadIfc(url) {
        // Remove modelo anterior se existir
        if (currentModel) {
            scene.remove(currentModel);
            allMeshes = [];
        }
        
        // Carrega novo modelo
        currentModel = await ifcLoader.loadAsync(url);
        scene.add(currentModel);
        
        // Coleta todos os meshes do modelo
        collectAllMeshes(currentModel);
        
        console.log(`✅ Modelo carregado com ${allMeshes.length} meshes`);
        
        // Ajusta a câmera para visualizar o modelo
        fitCameraToObject(currentModel);
        
        return currentModel;
    }

    // --- Coleta todos os meshes recursivamente ---
    function collectAllMeshes(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                allMeshes.push(child);
                // Armazena o expressID se disponível
                if (child.userData && child.userData.expressID) {
                    console.log(`🔹 Mesh encontrado: ${child.userData.expressID}`);
                }
            }
        });
    }

    // --- Ajusta câmera para visualizar objeto ---
    function fitCameraToObject(object) {
        const box = new Box3().setFromObject(object);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
    }

    // --- Seleciona mesh por raycasting ---
    function setupRaycasting() {
        const raycaster = new Raycaster();
        const mouse = new Vector2();
        
        container.addEventListener('dblclick', (event) => {
            // Calcula posição do mouse normalizada
            const rect = container.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
            
            // Raycasting
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(allMeshes, true);
            
            if (intersects.length > 0) {
                const selected = intersects[0].object;
                selectMesh(selected);
            } else {
                deselectMesh();
            }
        });
    }

    // --- Seleciona um mesh ---
    function selectMesh(mesh) {
        // Desseleciona anterior
        deselectMesh();
        
        // Seleciona novo
        selectedMesh = mesh;
        
        // Destaca visualmente (muda cor)
        mesh.originalMaterial = mesh.material;
        mesh.material = new MeshPhongMaterial({ 
            color: 0xff0000, 
            emissive: 0x440000 
        });
        
        console.log(`🟩 Mesh selecionado:`, mesh);
        
        // Mostra informações
        showMeshInfo(mesh);
    }

    // --- Desseleciona mesh ---
    function deselectMesh() {
        if (selectedMesh && selectedMesh.originalMaterial) {
            selectedMesh.material = selectedMesh.originalMaterial;
        }
        selectedMesh = null;
        hideMeshInfo();
    }

    // --- OCULTAR SELECIONADO (SIMPLES E DIRETO) ---
    function hideSelected() {
        if (!selectedMesh) {
            alert("Nenhum mesh selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }
        
        console.log(`🔹 Ocultando mesh:`, selectedMesh);
        selectedMesh.visible = false;
        
        // Remove da lista de meshes visíveis para raycasting
        allMeshes = allMeshes.filter(mesh => mesh !== selectedMesh);
        
        deselectMesh();
        console.log(`✅ Mesh ocultado com sucesso`);
    }

    // --- MOSTRAR TODOS ---
    function showAll() {
        // Restaura visibilidade de TODOS os meshes
        if (currentModel) {
            currentModel.traverse((child) => {
                if (child.isMesh) {
                    child.visible = true;
                }
            });
            
            // Recarrega lista de meshes
            allMeshes = [];
            collectAllMeshes(currentModel);
        }
        
        deselectMesh();
        console.log(`✅ Todos os ${allMeshes.length} meshes visíveis`);
    }

    // --- Informações do mesh ---
    function showMeshInfo(mesh) {
        const infoDiv = document.getElementById('selection-info') || createInfoDiv();
        let info = `Mesh selecionado`;
        
        if (mesh.userData && mesh.userData.expressID) {
            info += ` (ID: ${mesh.userData.expressID})`;
        }
        
        infoDiv.textContent = info;
        infoDiv.style.display = 'block';
    }

    function hideMeshInfo() {
        const infoDiv = document.getElementById('selection-info');
        if (infoDiv) infoDiv.style.display = 'none';
    }

    function createInfoDiv() {
        const div = document.createElement('div');
        div.id = 'selection-info';
        div.style.cssText = `
            position: fixed; 
            top: 10px; 
            left: 50%; 
            transform: translateX(-50%); 
            background: rgba(0,0,0,0.8); 
            color: white; 
            padding: 10px 20px; 
            border-radius: 5px; 
            z-index: 1000; 
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(div);
        return div;
    }

    // --- Inicialização ---
    initThreeJS();
    setupRaycasting();
    
    // Carrega modelo inicial
    loadIfc('models/01.ifc');

    // Controles da UI
    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        });
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // Atalhos
    window.onkeydown = (event) => {
        if (event.code === 'Escape') deselectMesh();
        else if (event.code === 'KeyH' && !event.ctrlKey) {
            event.preventDefault();
            hideSelected();
        }
        else if (event.code === 'KeyS' && !event.ctrlKey) {
            event.preventDefault();
            showAll();
        }
    };
});