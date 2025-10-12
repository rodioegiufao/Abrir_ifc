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

        // Configura o viewer para NÃO criar subsets automáticos na seleção
        viewer.IFC.selector.autoPickOnMouseMove = false;
        
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
            
            // Se encontrou elementos, retorna
            if (allIds.length > 0) return allIds;
            
            // Método 2: Tenta tipos específicos sequencialmente
            console.log("🔹 Tentando via tipos específicos...");
            const typeRanges = [
                { start: 1, end: 150 },    // Tipos básicos e elementos
                { start: 250, end: 350 },  // Mais tipos
                { start: 1000, end: 1150 } // Tipos específicos
            ];
            
            for (const range of typeRanges) {
                for (let type = range.start; type <= range.end; type++) {
                    try {
                        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                            currentModelID,
                            type,
                            false
                        );
                        if (ids.length > 0) {
                            allIds.push(...ids);
                            console.log(`🔹 Tipo ${type}: ${ids.length} elementos`);
                        }
                    } catch (e) {
                        // Tipo não existe, continua
                    }
                }
            }
            
            // Remove duplicatas
            const uniqueIds = [...new Set(allIds)];
            console.log(`🔹 Total único: ${uniqueIds.length} elementos`);
            
            return uniqueIds;
            
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
    // 🔹 CONTROLE DE VISIBILIDADE CORRIGIDO
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
        
        // Limpa seleção mas MANTÉM a highlight para feedback visual
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO CORRIGIDAS
    // =======================================================
    
    window.onmousemove = () => {
        if (viewer && viewer.IFC && viewer.IFC.selector) {
            viewer.IFC.selector.prePickIfcItem();
        }
    };

    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        // 🔹 IMPORTANTE: Desativa a criação automática de subsets
        const originalValue = viewer.IFC.selector.autoPickOnMouseMove;
        viewer.IFC.selector.autoPickOnMouseMove = false;
        
        const item = await viewer.IFC.selector.pickIfcItem(false); // false = não cria subset automático
        
        // Restaura o valor original
        viewer.IFC.selector.autoPickOnMouseMove = originalValue;
        
        if (!item || item.modelID === undefined || item.id === undefined) {
            console.log("Nenhum item IFC selecionado");
            return;
        }
        
        lastPickedItem = item;
        
        // Apenas destaca visualmente, SEM modificar subsets
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        console.log("🟩 Item selecionado:", props);
        
        // 🔹 FEEDBACK VISUAL: Mostra qual item está selecionado
        const selectionInfo = document.getElementById('selection-info');
        if (selectionInfo) {
            selectionInfo.textContent = `Item selecionado: ${props.Name?.value || 'Sem nome'} (ID: ${item.id})`;
            selectionInfo.style.display = 'block';
        }
    };

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
            
            // Limpa feedback visual
            const selectionInfo = document.getElementById('selection-info');
            if (selectionInfo) selectionInfo.style.display = 'none';
        } else if (event.code === 'KeyH' && !event.ctrlKey) {
            event.preventDefault();
            hideSelected();
        } else if (event.code === 'KeyS' && !event.ctrlKey) {
            event.preventDefault();
            showAll();
        }
    };
});