import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// 🚨 TUDO ENVOLVIDO AQUI PARA GARANTIR QUE OS ELEMENTOS ESTEJAM CARREGADOS
document.addEventListener('DOMContentLoaded', () => {

    // --- Funções Auxiliares ---

    function CreateViewer(container) {
        // Cor de fundo do seu blog é mais próxima do branco.
        let viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xeeeeee) }); 
        viewer.axes.setAxes();
        viewer.grid.setGrid();
        return viewer;
    }

    async function loadIfc(url) {
        // Redefine o viewer e o container a cada novo arquivo carregado
        await viewer.dispose();
        viewer = CreateViewer(container);
        
        // O caminho correto que resolvemos
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        const model = await viewer.IFC.loadIfcUrl(url);
        viewer.shadowDropper.renderShadow(model.modelID);
    }
    
    // --- Inicialização ---

    const container = document.getElementById('viewer-container');
    let viewer = CreateViewer(container);

    // Carrega o modelo inicial
    loadIfc('models/01.ifc');
    
    // --- Event Listeners do DOM (Agora Seguro) ---

    const input = document.getElementById("file-input");
    const createPlaneButton = document.getElementById('create-plane');
    const deletePlaneButton = document.getElementById('delete-plane');
    
    viewer.clipper.active = true;

    // Listener para carregar arquivo
    if (input) {
        input.addEventListener("change",
            async (changed) => {
                const file = changed.target.files[0];
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL); // Usar await para garantir que o modelo carregue antes de prosseguir
            },
            false
        );
    }

    // Mapeamento de Botões da UI
    if (createPlaneButton) {
        createPlaneButton.onclick = () => {
            viewer.clipper.createPlane();
        };
    }

    if (deletePlaneButton) {
        deletePlaneButton.onclick = () => {
            viewer.clipper.deletePlane();
        };
    }
    
    // Interações do Mouse
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (item.modelID === undefined || item.id === undefined) return;
        console.log(await viewer.IFC.getProperties(item.modelID, item.id, true));
    }

    // Mantendo os atalhos de teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        }
        else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        }
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
        }
    };
});