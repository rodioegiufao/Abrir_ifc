import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

// --- VARIÁVEIS GLOBAIS ---
let currentModelID = -1;
let lastPickedItem = null; // 🚨 CRUCIAL: Armazena o último item selecionado.

// 🚨 TUDO ENVOLVIDO AQUI PARA GARANTIR QUE OS ELEMENTOS ESTEJAM CARREGADOS
document.addEventListener('DOMContentLoaded', () => {

    // --- Configurações Iniciais ---
    const container = document.getElementById('viewer-container');
    const categorySelect = document.getElementById('category-select');
    
    let viewer; // Variável global para o viewer
    let modelCategories = {}; 

    function CreateViewer(container) {
        let newViewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xeeeeee) }); 
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    async function loadIfc(url) {
        if (viewer) {
            await viewer.dispose();
        }
        viewer = CreateViewer(container);
        
        // Use o caminho WASM conforme seu vercel.json
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        const model = await viewer.IFC.loadIfcUrl(url);
        
        // 🚨 CRUCIAL: Salva o ID do modelo carregado
        currentModelID = model.modelID;

        viewer.shadowDropper.renderShadow(currentModelID);
        
        await populateCategoryDropdown(currentModelID);

        return model;
    }
    
    // --- Lógica de Categoria (Opcional, mas completa) ---
    async function populateCategoryDropdown(modelID) {
        // ... (código para popular o dropdown)
        // Omitido aqui para brevidade, mas deve ser mantido no seu arquivo.
        // Se você usou o código completo do meu passo anterior, ele está aqui.
        categorySelect.innerHTML = '<option value="" disabled selected>Escolha a Categoria</option>';
        if (categorySelect) {
            const ifcManager = viewer.IFC.loader.ifcManager;
            modelCategories = await ifcManager.getAllCategories(modelID);

            for (const category in modelCategories) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            }
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
    
    // --- Carregamento Inicial ---
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

    // 2. Visibilidade Geral: Ocultar Selecionado (USA lastPickedItem)
    if (hideSelectedButton) {
        hideSelectedButton.onclick = () => {
            // Verifica se um item foi selecionado e se o modelo está carregado
            if (!lastPickedItem || currentModelID === -1) {
                alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
                return;
            }
            
            // Oculta o item usando o ID salvo
            viewer.IFC.setIfcVisibility(currentModelID, [lastPickedItem.id], false);
            
            // Limpa a seleção e o destaque
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        };
    } else {
        console.error("Erro: Botão 'hide-selected' não encontrado. Verifique o index.html.");
    }

    // 3. Visibilidade Geral: Exibir Tudo
    if (showAllButton) {
        showAllButton.onclick = () => {
            viewer.IFC.loader.ifcManager.setVisibility(true); 
        };
    }
    
    // 4. Visibilidade por Categoria: Ocultar
    if (hideCategoryButton) {
        hideCategoryButton.onclick = () => {
            setCategoryVisibility(false);
        };
    }
    
    // 5. Visibilidade por Categoria: Exibir
    if (showCategoryButton) {
        showCategoryButton.onclick = () => {
            setCategoryVisibility(true);
        };
    }

    // 6. Interações do Mouse (Pré-seleção)
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    // 7. Duplo clique: Seleciona, SALVA o item e mostra propriedades
    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        
        // 🚨 CORREÇÃO DO TYPE ERROR: Se o item for nulo, interrompe.
        if (!item || item.modelID === undefined || item.id === undefined) return;
        
        // 🚨 AÇÃO CRUCIAL: Salva o item selecionado
        lastPickedItem = item; 
        
        // Mostra as propriedades no console
        console.log(await viewer.IFC.getProperties(item.modelID, item.id, true));
    }

    // 8. Mantendo os atalhos de teclado (para corte)
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        }
        else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        }
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null; // Limpa o item selecionado ao pressionar ESC
        }
    };
});