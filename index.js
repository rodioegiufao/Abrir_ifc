import { 
    Color, Scene, WebGLRenderer, PerspectiveCamera, 
    AmbientLight, DirectionalLight, Raycaster, Vector2,
    Box3, Vector3
} from 'three';
import { IFCLoader } from 'web-ifc-three';

let scene, renderer, camera;
let currentModel = null;
let selectedMesh = null;

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('viewer-container');
    
    // Setup básico do Three.js
    scene = new Scene();
    scene.background = new Color(0xeeeeee);
    
    camera = new PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(50, 50, 50); // Posição inicial mais afastada
    
    renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Luz - MAIS LUZ para melhor visualização
    scene.add(new AmbientLight(0xffffff, 0.6)); // Luz ambiente mais forte
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
    
    // Loader IFC
    const ifcLoader = new IFCLoader();
    await ifcLoader.ifcManager.setWasmPath('/wasm/');
    
    // Carrega modelo
    currentModel = await ifcLoader.loadAsync('models/01.ifc');
    scene.add(currentModel);
    
    // 🔥 AJUSTA A CÂMERA para visualizar o modelo completo
    fitCameraToObject(currentModel);
    
    // Controles de órbita para navegação 3D
    setupOrbitControls();
    
    // Raycasting para seleção
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    
    container.addEventListener('dblclick', (event) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(currentModel, true);
        
        if (intersects.length > 0) {
            selectedMesh = intersects[0].object;
            console.log('✅ Mesh selecionado:', selectedMesh);
            
            // Feedback visual
            const infoDiv = document.getElementById('selection-info');
            if (infoDiv) {
                const expressID = selectedMesh.userData?.expressID || 'N/A';
                infoDiv.textContent = `Elemento selecionado (ID: ${expressID})`;
                infoDiv.style.display = 'block';
            }
        } else {
            // Desseleciona se clicar em área vazia
            selectedMesh = null;
            const infoDiv = document.getElementById('selection-info');
            if (infoDiv) infoDiv.style.display = 'none';
        }
    });
    
    // 🔥 FUNÇÃO OCULTAR - SIMPLES E DIRETA
    function hideSelected() {
        if (selectedMesh) {
            selectedMesh.visible = false;
            console.log('🔹 Mesh ocultado');
            
            // Limpa seleção
            selectedMesh = null;
            const infoDiv = document.getElementById('selection-info');
            if (infoDiv) infoDiv.style.display = 'none';
        } else {
            alert('Selecione um elemento primeiro (duplo clique)');
        }
    }
    
    // 🔥 FUNÇÃO MOSTRAR TODOS - SIMPLES E DIRETA
    function showAll() {
        if (currentModel) {
            currentModel.traverse(child => {
                if (child.isMesh) child.visible = true;
            });
            console.log('🔹 Todos os elementos visíveis');
        }
    }
    
    // 🔥 FUNÇÃO PARA AJUSTAR CÂMERA AO MODELO
    function fitCameraToObject(object) {
        const box = new Box3().setFromObject(object);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        
        // Calcula a distância necessária para caber o modelo na tela
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
        
        // Posiciona a câmera
        camera.position.copy(center);
        camera.position.z += cameraZ * 1.5; // Um pouco mais afastado
        camera.lookAt(center);
        
        console.log('📐 Câmera ajustada para visualizar modelo 3D');
    }
    
    // 🔥 CONTROLES DE ÓRBITA PARA NAVEGAÇÃO 3D
    function setupOrbitControls() {
        let isMouseDown = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        container.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        });
        
        container.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        container.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };
            
            // Rotação
            camera.position.x -= deltaMove.x * 0.01;
            camera.position.y += deltaMove.y * 0.01;
            
            // Mantém a câmera olhando para o centro
            camera.lookAt(new Vector3(0, 0, 0));
            
            previousMousePosition = { x: event.clientX, y: event.clientY };
        });
        
        // Zoom com roda do mouse
        container.addEventListener('wheel', (event) => {
            camera.position.z += event.deltaY * 0.01;
        });
    }
    
    // Conecta aos botões
    document.getElementById('hide-selected').onclick = hideSelected;
    document.getElementById('show-all').onclick = showAll;
    
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
});