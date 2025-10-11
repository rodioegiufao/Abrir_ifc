import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// Variável para armazenar o ID do modelo atualmente carregado
let currentModelID = -1;

// 🚨 TUDO ENVOLVIDO AQUI PARA GARANTIR QUE OS ELEMENTOS ESTEJAM CARREGADOS
document.addEventListener('DOMContentLoaded', () => {

    // --- Configurações Iniciais ---

    const container = document.getElementById('viewer-container');
    const categorySelect = document.getElementById('category-select');
    
    let viewer; // Variável global para o viewer
    
    // Armazena as categorias encontradas no modelo para popular o dropdown
    let modelCategories = {}; 

    function CreateViewer(container) {
        // Cor de fundo neutra
        let newViewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xeeeeee) }); 
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    async function loadIfc(url) {
        // Redefine o viewer
        if (viewer) {
            await viewer.dispose();
        }
        viewer = CreateViewer(container);
        
        // Define o caminho WASM
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        const model = await viewer.IFC.loadIfcUrl(url);
        
        // 🚨 CORREÇÃO CRUCIAL: Salva o ID do modelo carregado
        currentModelID = model.modelID;

        viewer.shadowDropper.renderShadow(currentModelID);
        
        // Popula as categorias após o carregamento
        await populateCategoryDropdown(currentModelID);

        return model;
    }
    
    // --- Lógica de Categoria (Avançado) ---
    
    async function populateCategoryDropdown(modelID) {
        // Limpa o dropdown
        categorySelect.innerHTML = '<option value="" disabled selected>Escolha a Categoria</option>';
        
        const ifcManager = viewer.IFC.loader.ifcManager;
        
        // Obtém todas as categorias do modelo
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

        // Verifica se a categoria foi encontrada no modelo
        const categoryIds = modelCategories[categoryName];
        if (!categoryIds) {
             console.warn(`Categoria ${categoryName} não encontrada neste modelo.`);
             return;
        }

        // Oculta/Exibe os elementos usando os IDs da categoria
        viewer.IFC.setIfcVisibility(currentModelID, categoryIds, isVisible);
    }
    
    // --- Carregamento Inicial ---

    // O viewer é inicializado aqui para que os listeners iniciais possam funcionar
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');
    
    // --- Event Listeners do DOM ---

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById('hide-selected');
    const showAllButton = document.getElementById('show-all');
    const hideCategoryButton = document.getElementById('hide-category');
    const showCategoryButton = document.getElementById('show-category');

    // 1. Listener para carregar arquivo
    if (input) {
        input.addEventListener("change",
            async (changed) => {
                const file = changed.target.files[0];
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL);
            },
            false
        );
    }

    // 2. Visibilidade Geral: Ocultar Selecionado
    if (hideSelectedButton) {
        hideSelectedButton.onclick = async () => {
            if (currentModelID === -1) return;
            const item = await viewer.IFC.selector.pickIfcItem(true);
            if (!item) return;
            
            // Oculta o item selecionado
            viewer.IFC.setIfcVisibility(currentModelID, [item.id], false);
        };
    }

    // 3. Visibilidade Geral: Exibir Tudo
    if (showAllButton) {
        showAllButton.onclick = () => {
            // Exibe todos os elementos em todos os modelos.
            viewer.IFC.loader.ifcManager.setVisibility(true); 
        };
    }
    
    // 4. Visibilidade por Categoria: Ocultar
    if (hideCategoryButton) {
        hideCategoryButton.onclick = () => {
             // Oculta a categoria selecionada (false)
            setCategoryVisibility(false);
        };
    }
    
    // 5. Visibilidade por Categoria: Exibir
    if (showCategoryButton) {
        showCategoryButton.onclick = () => {
             // Exibe a categoria selecionada (true)
            setCategoryVisibility(true);
        };
    }

    // 6. Interações do Mouse
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    // 7. Duplo clique: Oculta e mostra propriedades
    window.ondblclick = async () => {
        // CORREÇÃO CRUCIAL: Verificação de null
        const item = await viewer.IFC.selector.pickIfcItem(true);
        
        // Se a seleção falhar (clicar no fundo), 'item' será null ou undefined. Apenas retorna.
        if (!item || item.modelID === undefined || item.id === undefined) return;
        
        // Oculta o item (Agora o item existe)
        viewer.IFC.setIfcVisibility(item.modelID, [item.id], false); 

        // Mostra as propriedades no console
        console.log(await viewer.IFC.getProperties(item.modelID, item.id, true));
    }

    // 8. Mantendo os atalhos de teclado (para corte, caso queira reativar)
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