// index.js (CÓDIGO FINAL E SIMPLIFICADO)
import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// --- VARIÁVEIS GLOBAIS ---
let currentModelID = -1;
let lastPickedItem = null; // Para a funcionalidade 'Ocultar Selecionado'

document.addEventListener('DOMContentLoaded', () => {

    // --- Configurações e Elementos ---
    const container = document.getElementById('viewer-container');
    let viewer; 

    function CreateViewer(container) {
        // Cor de fundo do viewer
        let newViewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xeeeeee) }); 
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true; 
        return newViewer;
    }
    
    // --- Lógica de Carregamento ---
    async function loadIfc(url) {
        if (viewer) {
            await viewer.dispose();
        }
        viewer = CreateViewer(container);
        
        // Caminho do WASM (o que resolvemos)
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        const model = await viewer.IFC.loadIfcUrl(url);
        
        currentModelID = model.modelID;

        viewer.shadowDropper.renderShadow(currentModelID);
        
        return model;
    }

    // --- Inicialização e Event Listeners ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc'); // Carrega o modelo de exemplo ao iniciar
    
    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById('hide-selected');
    const showAllButton = document.getElementById('show-all');
    
    // Listener para carregar arquivo
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }
    
    // Visibilidade Geral: Ocultar Selecionado
    if (hideSelectedButton) {
        hideSelectedButton.onclick = () => {
            if (!lastPickedItem || currentModelID === -1) {
                alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
                return;
            }
            // SINTAXE MODERNA E CORRETA PARA A VERSÃO 1.0.218
            viewer.IFC.loader.ifcManager.setVisibility(currentModelID, [lastPickedItem.id], false);
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        };
    }

    // Visibilidade Geral: Exibir Tudo
    if (showAllButton) {
        showAllButton.onclick = () => {
             // SINTAXE MODERNA E CORRETA PARA A VERSÃO 1.0.218
            viewer.IFC.loader.ifcManager.setVisibility(true); 
        };
    }
    
    // Interações do Mouse (Pré-seleção)
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    // Duplo clique: Seleciona e SALVA o item
    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        
        if (!item || item.modelID === undefined || item.id === undefined) return;
        
        lastPickedItem = item; 
        console.log(await viewer.IFC.getProperties(item.modelID, item.id, true));
    }

    // Mantendo os atalhos de teclado (para corte)
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        }
        else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        }
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null; 
        }
    };
});