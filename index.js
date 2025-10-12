import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer ---
    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // Aguarda o carregamento completo
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Cria subset com TODOS os elementos visíveis
        await showAll();
        
        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Obtém TODOS os IDs do modelo ---
    async function getAllExpressIDs() {
        if (currentModelID === -1) return [];
        
        try {
            console.log("🔹 Buscando todos os IDs do modelo...");
            
            // Método 1: Via estrutura espacial (mais confiável)
            const spatialStructure = await viewer.IFC.loader.ifcManager.getSpatialStructure(currentModelID, false);
            const allIds = [];
            
            function extractIDs(node) {
                if (node.expressID) {
                    allIds.push(node.expressID);
                }
                if (node.children) {
                    node.children.forEach(child => extractIDs(child));
                }
            }
            
            extractIDs(spatialStructure);
            console.log(`🔹 Encontrados ${allIds.length} elementos via estrutura espacial`);
            
            return allIds;
            
        } catch (error) {
            console.error("❌ Erro ao obter IDs:", error);
            return [];
        }
    }

    // --- Mostra TODOS os elementos ---
    async function showAll() {
        if (currentModelID === -1) return;

        console.log("🔹 Mostrando todos os elementos...");
        
        try {
            const allIds = await getAllExpressIDs();
            
            if (allIds.length === 0) {
                console.warn("⚠️ Nenhum ID encontrado, usando fallback...");
                // Fallback: remove todos os subsets para mostrar geometria original
                viewer.IFC.loader.ifcManager.removeSubset(currentModelID);
                return;
            }
            
            viewer.IFC.loader.ifcManager.createSubset({
                modelID: currentModelID,
                ids: allIds,
                removePrevious: true,
                customID: "visibleSubset"
            });
            
            console.log(`✅ ${allIds.length} elementos visíveis`);
            
        } catch (error) {
            console.error("❌ Erro ao mostrar todos:", error);
        }
    }

    // --- Inicializa ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    // --- Upload manual ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // =======================================================
    // 🔹 CONTROLE DE VISIBILIDADE
    // =======================================================

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;
        console.log(`🔹 Ocultando item ${expressID}`);

        try {
            // Remove o item do subset visível
            viewer.IFC.loader.ifcManager.removeFromSubset(
                currentModelID,
                [expressID],
                "visibleSubset"
            );

            console.log(`✅ Item ${expressID} ocultado com sucesso.`);
            
        } catch (error) {
            console.error("❌ Erro ao ocultar item:", error);
        }
        
        // Limpa seleção
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
        lastPickedItem = null;
        
        // Atualiza feedback visual
        updateSelectionInfo(null);
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO - VERSÃO SIMPLIFICADA
    // =======================================================
    
    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        try {
            // 🔹 SOLUÇÃO SIMPLES: Primeiro restaura tudo, depois seleciona
            await showAll();
            
            // Aguarda um pouco para garantir que o subset foi restaurado
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Agora seleciona o item
            const item = await viewer.IFC.selector.pickIfcItem();
            
            if (!item || item.modelID === undefined || item.id === undefined) {
                console.log("Nenhum item IFC selecionado");
                return;
            }
            
            lastPickedItem = item;
            
            // Apenas destaca visualmente
            viewer.IFC.selector.highlightIfcItem(item, false);
            
            const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
            console.log("🟩 Item selecionado:", props);
            
            // Atualiza feedback visual
            updateSelectionInfo(props, item.id);
            
        } catch (error) {
            console.error("Erro na seleção:", error);
        }
    };

    // 🔹 FUNÇÃO PARA ATUALIZAR O FEEDBACK VISUAL
    function updateSelectionInfo(props, expressID = null) {
        const selectionInfo = document.getElementById('selection-info');
        if (!selectionInfo) return;
        
        if (!props || !expressID) {
            selectionInfo.style.display = 'none';
            return;
        }
        
        const name = props.Name?.value || props.type || 'Elemento';
        selectionInfo.textContent = `Selecionado: ${name} (ID: ${expressID})`;
        selectionInfo.style.display = 'block';
    }

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') {
            viewer.clipper.createPlane();
        } else if (event.code === 'KeyO') {
            viewer.clipper.deletePlane();
        } else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            lastPickedItem = null;
            updateSelectionInfo(null);
        } else if (event.code === 'KeyH' && !event.ctrlKey) {
            event.preventDefault();
            hideSelected();
        } else if (event.code === 'KeyS' && !event.ctrlKey) {
            event.preventDefault();
            showAll();
        }
    };
});