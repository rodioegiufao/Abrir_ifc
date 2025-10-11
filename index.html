// index.js (CÓDIGO COMPLETO E CORRIGIDO)
import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// --- VARIÁVEIS GLOBAIS ---
let currentModelID = -1;
let lastPickedItem = null; // Para a funcionalidade 'Ocultar Selecionado'
let modelCategories = {}; // Para o controle de categorias

document.addEventListener('DOMContentLoaded', () => {

    // --- Configurações e Elementos ---
    const container = document.getElementById('viewer-container');
    const categorySelect = document.getElementById('category-select');
    let viewer; 

    function CreateViewer(container) {
        let newViewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xeeeeee) }); 
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true; 
        return newViewer;
    }

    // --- Lógica de Categoria ---
    async function populateCategoryDropdown(modelID) {
        if (!categorySelect || currentModelID === -1) return;

        const ifcManager = viewer.IFC.loader.ifcManager;
        
        // CORREÇÃO CRÍTICA: Verifica se a função existe na versão atual
        if (typeof ifcManager.getAllCategories !== 'function') {
             console.warn("A função getAllCategories não está disponível nesta versão da biblioteca. Pulando o controle de categorias.");
             // Oculta o painel de controle se a função não existir
             const categoryControls = document.getElementById('category-controls');
             if (categoryControls) categoryControls.style.display = 'none';
             return;
        }

        categorySelect.innerHTML = '<option value="" disabled selected>Escolha a Categoria</option>';
        
        modelCategories = await ifcManager.getAllCategories(modelID);

        for (const category in modelCategories) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        }
    }
    
    function setCategoryVisibility(isVisible) {
        const categoryName = categorySelect.value;
        if (!categoryName || currentModelID === -1) return;

        const categoryIds = modelCategories[categoryName];
        if (!categoryIds) {
             console.warn(`Categoria ${categoryName} não encontrada neste modelo.`);
             return;
        }
        viewer.IFC.setIfcVisibility(currentModelID, categoryIds, isVisible);
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
        
        await populateCategoryDropdown(currentModelID);

        return model;
    }

    // --- Inicialização e Event Listeners ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc'); // Carrega o modelo de exemplo ao iniciar
    
    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById('hide-selected');
    const showAllButton = document.getElementById('show-all');
    const hideCategoryButton = document.getElementById('hide-category');
    const showCategoryButton = document.getElementById('show-category');

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
            viewer.IFC.setIfcVisibility(currentModelID, [lastPickedItem.id], false);
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        };
    }

    // Visibilidade Geral: Exibir Tudo
    if (showAllButton) {
        showAllButton.onclick = () => {
            viewer.IFC.loader.ifcManager.setVisibility(true); 
        };
    }
    
    // Visibilidade por Categoria: Ocultar
    if (hideCategoryButton) {
        hideCategoryButton.onclick = () => {
            setCategoryVisibility(false);
        };
    }
    
    // Visibilidade por Categoria: Exibir
    if (showCategoryButton) {
        showCategoryButton.onclick = () => {
            setCategoryVisibility(true);
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